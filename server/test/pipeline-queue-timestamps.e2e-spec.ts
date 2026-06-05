/**
 * E2E tests for pipeline-queue-timestamps feature
 * Feature: pipeline-queue-timestamps
 * ACs covered: AC-1 (schema fields), AC-8 (GET /pipeline-queue), AC-9 (GET /pipeline-queue/mine)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as http from 'http';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PipelineQueue — timestamps (e2e)', () => {
  let app: INestApplication;

  const startedAt = new Date('2025-06-01T10:05:00Z');
  const finalizedAt = new Date('2025-06-01T10:15:00Z');

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
    id: 'e2e-ts-user-1',
    name: 'Timestamps Test User',
    email: 'timestamps@example.com',
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

  const makeMockQueueWithTimestamps = (
    id: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    id,
    event: 'push',
    app: 'whiz-server',
    environment: 'development',
    commitSha: `sha-${id}`,
    commitMessage: 'feat: timestamps e2e',
    commitAuthor: 'E2E Author',
    commitAuthorAvatar: 'https://github.com/e2e.png',
    commitAuthorId: null,
    status: 'Completed',
    id_user: 'e2e-ts-user-1',
    del: false,
    createdAt: new Date('2025-06-01T10:00:00Z'),
    updatedAt: new Date('2025-06-01T10:15:00Z'),
    startedAt,
    finalizedAt,
    steps: [],
    ...overrides,
  });

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

  function server(): http.Server {
    return app.getHttpServer() as http.Server;
  }

  async function loginAndGetToken(): Promise<string> {
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
    const loginRes = await request(server())
      .post('/auth/login')
      .send({ email: 'timestamps@example.com', password: 'password123' });
    const body = loginRes.body as { accessToken: string };
    return body.accessToken;
  }

  beforeEach(async () => {
    if (!accessToken) {
      accessToken = await loginAndGetToken();
    }
  });

  /**
   * AC-1: Schema has startedAt and finalizedAt as nullable DateTime fields.
   *
   * Since we test against a mocked Prisma (no real DB in e2e), we verify that:
   *   1. The mock data with startedAt/finalizedAt passes through the service and controller
   *      without being stripped — proving the DTO and service mappings accept these fields.
   *   2. Null values for startedAt/finalizedAt are also passed through correctly.
   *
   * A true migration test would require a live DB; here we verify the application layer
   * treats both fields as nullable DateTime (accepts Date or null without errors).
   */
  describe('AC-1: schema fields startedAt and finalizedAt are nullable DateTime', () => {
    it('accepts and returns startedAt and finalizedAt as Date objects in GET /pipeline-queue response', async () => {
      // Arrange — mock returns pipeline with both timestamp fields populated
      prismaMock.pipelineQueue.findMany.mockResolvedValue([
        makeMockQueueWithTimestamps('ts-schema-1'),
      ]);
      prismaMock.pipelineQueue.count.mockResolvedValue(1);

      if (!accessToken) accessToken = await loginAndGetToken();

      // Act
      const res = await request(server())
        .get('/pipeline-queue')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 1, limit: 10 });

      // Assert — 200 and fields present in each item
      expect(res.status).toBe(200);
      const body = res.body as { data: Array<Record<string, unknown>> };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(1);

      const item = body.data[0];
      expect(item).toHaveProperty('startedAt');
      expect(item).toHaveProperty('finalizedAt');
      // JSON serialized — dates come back as ISO strings, not null
      expect(typeof item['startedAt']).toBe('string');
      expect(typeof item['finalizedAt']).toBe('string');
    });

    it('returns startedAt = null and finalizedAt = null for pipelines created before migration', async () => {
      // Arrange — mock returns pipeline with both timestamp fields as null (historical record)
      prismaMock.pipelineQueue.findMany.mockResolvedValue([
        makeMockQueueWithTimestamps('ts-schema-null', {
          startedAt: null,
          finalizedAt: null,
        }),
      ]);
      prismaMock.pipelineQueue.count.mockResolvedValue(1);

      if (!accessToken) accessToken = await loginAndGetToken();

      // Act
      const res = await request(server())
        .get('/pipeline-queue')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 1, limit: 10 });

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as { data: Array<Record<string, unknown>> };
      const item = body.data[0];
      expect(item).toHaveProperty('startedAt');
      expect(item).toHaveProperty('finalizedAt');
      expect(item['startedAt']).toBeNull();
      expect(item['finalizedAt']).toBeNull();
    });
  });

  /**
   * AC-8: GET /pipeline-queue response includes startedAt and finalizedAt per item
   */
  describe('AC-8: GET /pipeline-queue includes startedAt and finalizedAt per item', () => {
    it('200 response includes startedAt and finalizedAt on each pipeline item', async () => {
      // Arrange
      const items = [
        makeMockQueueWithTimestamps('q-ts-1'),
        makeMockQueueWithTimestamps('q-ts-2', {
          startedAt: null,
          finalizedAt: null,
        }),
        makeMockQueueWithTimestamps('q-ts-3'),
      ];
      prismaMock.pipelineQueue.findMany.mockResolvedValue(items);
      prismaMock.pipelineQueue.count.mockResolvedValue(3);

      if (!accessToken) accessToken = await loginAndGetToken();

      // Act
      const res = await request(server())
        .get('/pipeline-queue')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 1, limit: 10 });

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as {
        data: Array<Record<string, unknown>>;
        total: number;
      };
      expect(body.data.length).toBe(3);

      // Every item must expose startedAt and finalizedAt
      body.data.forEach((item) => {
        expect(item).toHaveProperty('startedAt');
        expect(item).toHaveProperty('finalizedAt');
      });

      // First item (with timestamps) must return ISO strings
      expect(typeof body.data[0]['startedAt']).toBe('string');
      expect(typeof body.data[0]['finalizedAt']).toBe('string');

      // Second item (null timestamps) must return null
      expect(body.data[1]['startedAt']).toBeNull();
      expect(body.data[1]['finalizedAt']).toBeNull();
    });

    it('401 when unauthenticated', async () => {
      const res = await request(server()).get('/pipeline-queue');
      expect(res.status).toBe(401);
    });
  });

  /**
   * AC-9: GET /pipeline-queue/mine response includes startedAt and finalizedAt per item
   */
  describe('AC-9: GET /pipeline-queue/mine includes startedAt and finalizedAt per item', () => {
    it('200 response includes startedAt and finalizedAt on each pipeline item in paginated result', async () => {
      // Arrange
      const items = [
        makeMockQueueWithTimestamps('mine-ts-1'),
        makeMockQueueWithTimestamps('mine-ts-2', {
          startedAt: null,
          finalizedAt: null,
        }),
      ];
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        githubId: null,
      });
      prismaMock.pipelineQueue.findMany.mockResolvedValue(items);
      prismaMock.pipelineQueue.count.mockResolvedValue(2);

      if (!accessToken) accessToken = await loginAndGetToken();

      // Act
      const res = await request(server())
        .get('/pipeline-queue/mine')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 1, limit: 10 });

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as {
        data: Array<Record<string, unknown>>;
        total: number;
        page: number;
        limit: number;
      };

      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBe(2);

      // Every item must expose startedAt and finalizedAt
      body.data.forEach((item) => {
        expect(item).toHaveProperty('startedAt');
        expect(item).toHaveProperty('finalizedAt');
      });

      // First item has timestamps set — must be ISO strings
      expect(typeof body.data[0]['startedAt']).toBe('string');
      expect(typeof body.data[0]['finalizedAt']).toBe('string');

      // Second item has null timestamps
      expect(body.data[1]['startedAt']).toBeNull();
      expect(body.data[1]['finalizedAt']).toBeNull();
    });

    it('401 when unauthenticated', async () => {
      const res = await request(server()).get('/pipeline-queue/mine');
      expect(res.status).toBe(401);
    });
  });
});
