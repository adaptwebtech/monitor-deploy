import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as http from 'http';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// dashboard-filters: e2e tests
// Uses a mocked PrismaService (consistent with the project's e2e pattern — see app.e2e-spec.ts).
// ApiKeyGuard passes automatically when an Authorization: Bearer header is present.
// A real JWT is obtained by mocking the user login flow.
// Tests are RED until DashboardQueryDto and DashboardService forward the new filters.

describe('Dashboard Filters (e2e) — AC-1..5', () => {
  let app: INestApplication;
  let accessToken: string;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    pipelineQueue: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
    pipelineStep: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  const mockUser = {
    id: 'df-e2e-user-1',
    name: 'Dashboard Filter E2E User',
    email: 'dashboard-filters@example.com',
    password: '$2b$10$placeholder',
    salt: '$2b$10$placeholder',
    root: false,
    del: false,
    githubId: null,
    profilePictureUrl: null,
    refreshToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    // Obtain a real JWT via mocked login — ApiKeyGuard passes Bearer tokens,
    // JwtAuthGuard validates the JWT issued by the real JwtService.
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash('password123', salt);
    prismaMock.user.findUnique.mockResolvedValue({
      ...mockUser,
      password: hashed,
      salt,
    });
    prismaMock.user.update.mockResolvedValue({
      ...mockUser,
      refreshToken: 'rt',
    });

    const loginRes = await request(app.getHttpServer() as http.Server)
      .post('/auth/login')
      .send({
        email: 'dashboard-filters@example.com',
        password: 'password123',
      });

    const body = loginRes.body as { accessToken: string };
    accessToken = body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  function server(): http.Server {
    return app.getHttpServer() as http.Server;
  }

  const BASE_QUERY = {
    dateStart: '2024-01-01T00:00:00Z',
    dateEnd: '2024-12-31T23:59:59Z',
  };

  // ---------------------------------------------------------------------------
  // AC-1: filter by environment=production
  // ---------------------------------------------------------------------------
  describe('AC-1: filter by environment=production', () => {
    it('AC-1: GET /dashboard/kpis?environment=production returns 200 with counts restricted to production', async () => {
      // Simulate DB returning counts for production only
      prismaMock.pipelineQueue.count
        .mockResolvedValueOnce(5) // total production
        .mockResolvedValueOnce(3) // succeeded production
        .mockResolvedValueOnce(1); // failed production

      const res = await request(server())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ ...BASE_QUERY, environment: 'production' });

      expect(res.status).toBe(200);
      const body = res.body as {
        total: number;
        succeeded: number;
        failed: number;
        errorRate: number;
      };
      expect(body.total).toBe(5);
      expect(body.succeeded).toBe(3);
      expect(body.failed).toBe(1);

      // Verify that prisma was called with environment=production in every where clause
      const allCalls = prismaMock.pipelineQueue.count.mock.calls as Array<
        [{ where?: Record<string, unknown> }]
      >;
      allCalls.forEach((call) => {
        expect(call[0]?.where).toMatchObject({ environment: 'production' });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // AC-2: filter by app=my-api
  // ---------------------------------------------------------------------------
  describe('AC-2: filter by app=my-api', () => {
    it('AC-2: GET /dashboard/kpis?app=my-api returns 200 with counts restricted to app=my-api', async () => {
      prismaMock.pipelineQueue.count
        .mockResolvedValueOnce(4) // total for my-api
        .mockResolvedValueOnce(4) // succeeded
        .mockResolvedValueOnce(0); // failed

      const res = await request(server())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ ...BASE_QUERY, app: 'my-api' });

      expect(res.status).toBe(200);
      const body = res.body as {
        total: number;
        succeeded: number;
        failed: number;
        errorRate: number;
      };
      expect(body.total).toBe(4);
      expect(body.succeeded).toBe(4);
      expect(body.failed).toBe(0);

      // Verify prisma received app filter in every count call
      const allCalls = prismaMock.pipelineQueue.count.mock.calls as Array<
        [{ where?: Record<string, unknown> }]
      >;
      allCalls.forEach((call) => {
        expect(call[0]?.where).toMatchObject({ app: 'my-api' });
      });
    });
  });

  // ---------------------------------------------------------------------------
  // AC-3: filter by status=Failed → total = failed, succeeded = 0, errorRate = 100
  // ---------------------------------------------------------------------------
  describe('AC-3: filter by status=Failed', () => {
    it('AC-3: GET /dashboard/kpis?status=Failed returns total=failed, succeeded=0, errorRate=100', async () => {
      prismaMock.pipelineQueue.count
        .mockResolvedValueOnce(6) // total (all Failed)
        .mockResolvedValueOnce(0) // succeeded (Completed ∩ Failed = 0)
        .mockResolvedValueOnce(6); // failed

      const res = await request(server())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ ...BASE_QUERY, status: 'Failed' });

      expect(res.status).toBe(200);
      const body = res.body as {
        total: number;
        succeeded: number;
        failed: number;
        errorRate: number;
      };
      expect(body.total).toBe(6);
      expect(body.succeeded).toBe(0);
      expect(body.errorRate).toBe(100);

      // The total count call must include status: Failed
      const totalCall = prismaMock.pipelineQueue.count.mock.calls[0] as [
        { where?: Record<string, unknown> },
      ];
      expect(totalCall[0]?.where).toMatchObject({ status: 'Failed' });
    });
  });

  // ---------------------------------------------------------------------------
  // AC-4: no new params → identical behavior to current (retrocompatibility)
  // ---------------------------------------------------------------------------
  describe('AC-4: retrocompatibility — no new params', () => {
    it('AC-4: GET /dashboard/kpis without new params returns 200 same as before', async () => {
      prismaMock.pipelineQueue.count
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(15) // succeeded
        .mockResolvedValueOnce(3); // failed

      const res = await request(server())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${accessToken}`)
        .query(BASE_QUERY);

      expect(res.status).toBe(200);
      const body = res.body as {
        total: number;
        succeeded: number;
        failed: number;
        errorRate: number;
      };
      expect(body.total).toBe(20);
      expect(body.succeeded).toBe(15);
      expect(body.failed).toBe(3);

      // The total count call must NOT contain app/environment/status
      const totalCallWhere = (
        prismaMock.pipelineQueue.count.mock.calls[0] as [
          { where?: Record<string, unknown> },
        ]
      )[0]?.where;
      expect(totalCallWhere).not.toHaveProperty('app');
      expect(totalCallWhere).not.toHaveProperty('environment');
      expect(totalCallWhere).not.toHaveProperty('status');
    });
  });

  // ---------------------------------------------------------------------------
  // AC-5: environment=invalid → 400
  // ---------------------------------------------------------------------------
  describe('AC-5: environment=invalid → 400', () => {
    it('AC-5: GET /dashboard/kpis?environment=invalid returns 400', async () => {
      const res = await request(server())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ ...BASE_QUERY, environment: 'invalid' });

      expect(res.status).toBe(400);
    });
  });
});
