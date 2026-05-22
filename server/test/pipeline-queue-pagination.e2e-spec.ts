import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as http from 'http';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PipelineQueue — paginação (e2e AC-1..5)', () => {
  let app: INestApplication;

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
    id: 'e2e-pag-user-1',
    name: 'Pagination Test User',
    email: 'paginacao@example.com',
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

  const makeMockQueue = (id: string, createdAt?: Date) => ({
    id,
    event: 'push',
    app: 'whiz-server',
    environment: 'development',
    commitSha: `sha-${id}`,
    commitMessage: 'feat: paginacao',
    commitAuthor: 'E2E Author',
    commitAuthorAvatar: 'https://github.com/e2e.png',
    commitAuthorId: null,
    status: 'Completed',
    id_user: 'e2e-pag-user-1',
    del: false,
    createdAt: createdAt ?? new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    steps: [],
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
      .send({ email: 'paginacao@example.com', password: 'password123' });
    const body = loginRes.body as { accessToken: string };
    return body.accessToken;
  }

  beforeEach(async () => {
    if (!accessToken) {
      accessToken = await loginAndGetToken();
    }
  });

  // AC-1: GET /pipeline-queue?page=1&limit=100&orderBy=desc retorna PaginatedResponse
  describe('AC-1: GET /pipeline-queue retorna PaginatedResponse', () => {
    it('200 com data, total, page, limit quando autenticado', async () => {
      // Arrange
      const items = Array.from({ length: 100 }, (_, i) =>
        makeMockQueue(`q-${i}`),
      );
      prismaMock.pipelineQueue.findMany.mockResolvedValue(items);
      prismaMock.pipelineQueue.count.mockResolvedValue(342);

      if (!accessToken) accessToken = await loginAndGetToken();

      // Act
      const res = await request(server())
        .get('/pipeline-queue')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 1, limit: 100, orderBy: 'desc' });

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as {
        data: unknown[];
        total: number;
        page: number;
        limit: number;
      };
      expect(Array.isArray(body.data)).toBe(true);
      expect(typeof body.total).toBe('number');
      expect(body.total).toBe(342);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(100);
    });
  });

  // AC-2: GET /pipeline-queue?page=2&limit=100 retorna segundo lote
  describe('AC-2: GET /pipeline-queue página 2 retorna segundo lote', () => {
    it('200 com page=2 na resposta', async () => {
      // Arrange
      const items = Array.from({ length: 100 }, (_, i) =>
        makeMockQueue(`q2-${i}`),
      );
      prismaMock.pipelineQueue.findMany.mockResolvedValue(items);
      prismaMock.pipelineQueue.count.mockResolvedValue(342);

      if (!accessToken) accessToken = await loginAndGetToken();

      // Act
      const res = await request(server())
        .get('/pipeline-queue')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 2, limit: 100 });

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as { page: number; limit: number };
      expect(body.page).toBe(2);
      expect(body.limit).toBe(100);
    });
  });

  // AC-3: GET /pipeline-queue/mine?page=1&limit=10 retorna no máximo 10 itens
  describe('AC-3: GET /pipeline-queue/mine retorna itens do usuário', () => {
    it('200 com no máximo 10 itens e shape correto', async () => {
      // Arrange
      const items = Array.from({ length: 10 }, (_, i) =>
        makeMockQueue(`mine-${i}`),
      );
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        githubId: null,
      });
      prismaMock.pipelineQueue.findMany.mockResolvedValue(items);
      prismaMock.pipelineQueue.count.mockResolvedValue(87);

      if (!accessToken) accessToken = await loginAndGetToken();

      // Act
      const res = await request(server())
        .get('/pipeline-queue/mine')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 1, limit: 10 });

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as {
        data: unknown[];
        total: number;
        page: number;
        limit: number;
      };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeLessThanOrEqual(10);
      expect(body.total).toBe(87);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(10);
    });
  });

  // AC-4: GET /pipeline-queue/mine?limit=100&page=2&orderBy=asc retorna segundo lote asc
  describe('AC-4: GET /pipeline-queue/mine com orderBy=asc e page=2', () => {
    it('200 com page=2 e orderBy asc aceito', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        githubId: null,
      });
      prismaMock.pipelineQueue.findMany.mockResolvedValue([
        makeMockQueue('mine-asc-1'),
      ]);
      prismaMock.pipelineQueue.count.mockResolvedValue(250);

      if (!accessToken) accessToken = await loginAndGetToken();

      // Act
      const res = await request(server())
        .get('/pipeline-queue/mine')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ limit: 100, page: 2, orderBy: 'asc' });

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as { page: number; limit: number };
      expect(body.page).toBe(2);
      expect(body.limit).toBe(100);
    });
  });

  // AC-5: GET /pipeline-queue/mine?limit=50 retorna 400
  describe('AC-5: GET /pipeline-queue/mine com limit inválido retorna 400', () => {
    it('400 quando limit=50 (não permitido para /mine)', async () => {
      // Arrange
      if (!accessToken) accessToken = await loginAndGetToken();

      // Act
      const res = await request(server())
        .get('/pipeline-queue/mine')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ limit: 50 });

      // Assert
      expect(res.status).toBe(400);
    });
  });

  // Sem autenticação deve retornar 401
  describe('Autenticação', () => {
    it('401 quando token ausente em GET /pipeline-queue', async () => {
      const res = await request(server()).get('/pipeline-queue');
      expect(res.status).toBe(401);
    });

    it('401 quando token ausente em GET /pipeline-queue/mine', async () => {
      const res = await request(server()).get('/pipeline-queue/mine');
      expect(res.status).toBe(401);
    });
  });
});
