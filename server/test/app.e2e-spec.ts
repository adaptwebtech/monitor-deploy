import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Pipeline Monitor (e2e)', () => {
  let app: INestApplication;

  const VALID_API_KEY = 'bWludGluaG8=';

  // Prisma mock — prevents real DB connections in e2e bootstrap
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    pipeline_queue: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    pipeline_steps: {
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
    id: 'e2e-user-uuid-1',
    name: 'E2E Test User',
    email: 'e2e@example.com',
    password: '$2b$10$hashedpassword',
    salt: '$2b$10$uniquesalt',
    root: false,
    del: false,
    githubId: null,
    profilePictureUrl: null,
    refreshToken: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQueue = {
    id: 'e2e-queue-uuid-1',
    event: 'queued',
    app: 'whiz-server',
    environment: 'development',
    commitSha: 'e2e-sha-001',
    commitMessage: 'feat: e2e test',
    commitAuthor: 'E2E Author',
    commitAuthorAvatar: 'https://github.com/e2e.png',
    commitAuthorId: null,
    status: 'Queued',
    id_user: null,
    del: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let accessToken: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('AC-6: POST /auth/login', () => {
    it('returns 200 with accessToken and refreshToken on valid credentials', async () => {
      // Arrange
      const bcrypt = await import('bcrypt');
      const plainPassword = 'password123';
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(plainPassword, salt);
      const userWithHash = { ...mockUser, password: hashed, salt };

      prismaMock.user.findUnique.mockResolvedValue(userWithHash);
      prismaMock.user.update.mockResolvedValue({
        ...userWithHash,
        refreshToken: 'refresh-token-value',
      });

      // Act
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'e2e@example.com', password: plainPassword });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
      });

      accessToken = res.body.accessToken;
    });
  });

  describe('AC-5: POST /webhook — authentication', () => {
    it('AC-5: returns 401 when apikey is missing', async () => {
      // Act
      const res = await request(app.getHttpServer()).post('/webhook').send({
        event: 'queued',
        app: 'whiz-server',
        environment: 'development',
        commitSha: 'abc123',
        commitMessage: 'feat: test',
        commitAuthor: 'Author',
        commitAuthorAvatar: 'https://github.com/avatar.png',
      });

      // Assert
      expect(res.status).toBe(401);
    });

    it('AC-5: returns 401 when apikey is wrong', async () => {
      // Act
      const res = await request(app.getHttpServer())
        .post('/webhook')
        .set('apikey', 'wrong-key')
        .send({
          event: 'queued',
          app: 'whiz-server',
          environment: 'development',
          commitSha: 'abc123',
          commitMessage: 'feat: test',
          commitAuthor: 'Author',
          commitAuthorAvatar: 'https://github.com/avatar.png',
        });

      // Assert
      expect(res.status).toBe(401);
    });
  });

  describe('AC-1: POST /webhook — queued event', () => {
    it('AC-1: returns 201 immediately with valid apikey and queued event', async () => {
      // Arrange
      prismaMock.pipeline_queue.create.mockResolvedValue(mockQueue);
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act
      const res = await request(app.getHttpServer())
        .post('/webhook')
        .set('apikey', VALID_API_KEY)
        .send({
          event: 'queued',
          app: 'whiz-server',
          environment: 'development',
          commitSha: 'e2e-sha-001',
          commitMessage: 'feat: e2e test',
          commitAuthor: 'E2E Author',
          commitAuthorAvatar: 'https://github.com/e2e.png',
        });

      // Assert
      expect(res.status).toBe(201);
    });
  });

  describe('AC-11: GET /pipeline-queue — date filter', () => {
    it('AC-11: returns 200 with pipeline queue records when authenticated with JWT', async () => {
      // Arrange
      prismaMock.pipeline_queue.findMany.mockResolvedValue([mockQueue]);
      prismaMock.pipeline_queue.count.mockResolvedValue(1);

      // JWT login first if not already done
      if (!accessToken) {
        const bcrypt = await import('bcrypt');
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

        const loginRes = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'e2e@example.com', password: 'password123' });
        accessToken = loginRes.body.accessToken;
      }

      // Act
      const res = await request(app.getHttpServer())
        .get('/pipeline-queue')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          dateStart: '2024-01-01T00:00:00Z',
          dateEnd: '2024-12-31T23:59:59Z',
          page: 1,
          limit: 10,
        });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: expect.any(Array),
        total: expect.any(Number),
      });
    });
  });

  describe('GET /dashboard/kpis', () => {
    it('returns 200 with KPI data when authenticated', async () => {
      // Arrange
      prismaMock.pipeline_queue.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(2);

      if (!accessToken) {
        const bcrypt = await import('bcrypt');
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

        const loginRes = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ email: 'e2e@example.com', password: 'password123' });
        accessToken = loginRes.body.accessToken;
      }

      // Act
      const res = await request(app.getHttpServer())
        .get('/dashboard/kpis')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          dateStart: '2024-01-01T00:00:00Z',
          dateEnd: '2024-12-31T23:59:59Z',
        });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total: expect.any(Number),
        succeeded: expect.any(Number),
        failed: expect.any(Number),
        errorRate: expect.any(Number),
      });
    });
  });
});
