import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as http from 'http';
import request from 'supertest';
import { DashboardController } from '../dashboard.controller';
import { DashboardService } from '../dashboard.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

// dashboard-filters: integration tests for DashboardController
// These tests are RED until DashboardQueryDto gains app/environment/status fields
// with the proper validation decorators (IsIn for environment).

describe('DashboardController (integration) — dashboard-filters', () => {
  let app: INestApplication;
  let dashboardService: jest.Mocked<DashboardService>;

  const mockKpis = {
    total: 10,
    succeeded: 7,
    failed: 2,
    errorRate: 20.0,
  };

  beforeAll(async () => {
    const dashboardServiceMock: Partial<jest.Mocked<DashboardService>> = {
      getKpis: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx
            .switchToHttp()
            .getRequest<{ user: { id: string; root: boolean } }>();
          req.user = { id: 'test-user', root: false };
          return true;
        },
      })
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

    dashboardService = moduleRef.get(DashboardService);
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

  describe('AC-1: GET /dashboard/kpis?environment=production', () => {
    it('AC-1: returns 200 when environment=production is passed', async () => {
      dashboardService.getKpis.mockResolvedValue(mockKpis);

      const res = await request(server())
        .get('/dashboard/kpis')
        .query({ ...BASE_QUERY, environment: 'production' });

      expect(res.status).toBe(200);
    });
  });

  describe('AC-2: GET /dashboard/kpis?app=my-api', () => {
    it('AC-2: returns 200 when app=my-api is passed', async () => {
      dashboardService.getKpis.mockResolvedValue(mockKpis);

      const res = await request(server())
        .get('/dashboard/kpis')
        .query({ ...BASE_QUERY, app: 'my-api' });

      expect(res.status).toBe(200);
    });
  });

  describe('AC-3: GET /dashboard/kpis?status=Failed', () => {
    it('AC-3: returns 200 when status=Failed is passed', async () => {
      dashboardService.getKpis.mockResolvedValue({
        total: 4,
        succeeded: 0,
        failed: 4,
        errorRate: 100,
      });

      const res = await request(server())
        .get('/dashboard/kpis')
        .query({ ...BASE_QUERY, status: 'Failed' });

      expect(res.status).toBe(200);
    });
  });

  describe('AC-4: retrocompatibility — no new params', () => {
    it('AC-4: returns 200 with no app/environment/status params (same as before)', async () => {
      dashboardService.getKpis.mockResolvedValue(mockKpis);

      const res = await request(server())
        .get('/dashboard/kpis')
        .query(BASE_QUERY);

      expect(res.status).toBe(200);
      const body = res.body as {
        total: number;
        succeeded: number;
        failed: number;
        errorRate: number;
      };
      expect(typeof body.total).toBe('number');
      expect(typeof body.succeeded).toBe('number');
      expect(typeof body.failed).toBe('number');
      expect(typeof body.errorRate).toBe('number');
    });
  });

  describe('AC-5: GET /dashboard/kpis?environment=invalid → 400', () => {
    it('AC-5: returns 400 when environment=invalid is passed', async () => {
      const res = await request(server())
        .get('/dashboard/kpis')
        .query({ ...BASE_QUERY, environment: 'invalid' });

      expect(res.status).toBe(400);
    });
  });
});
