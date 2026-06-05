import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as http from 'http';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// CACHE_MANAGER token — @nestjs/cache-manager not yet installed
const CACHE_MANAGER = 'CACHE_MANAGER';

describe('github-user-picture (e2e)', () => {
  let app: INestApplication;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
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

  const cacheManagerMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockPrismaUser = {
    id: 'e2e-user-uuid-gh-1',
    name: 'Pedro PHP',
    email: 'pedro@example.com',
    password: '$2b$10$hashed',
    salt: '$2b$10$salt',
    root: false,
    del: false,
    githubId: 'pedro-php',
    profilePictureUrl: 'https://avatars.githubusercontent.com/u/12345',
    refreshToken: null,
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
      .overrideProvider(CACHE_MANAGER)
      .useValue(cacheManagerMock)
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
      ...mockPrismaUser,
      password: hashed,
      salt,
    });
    prismaMock.user.update.mockResolvedValue({
      ...mockPrismaUser,
      refreshToken: 'rt',
    });
    const loginRes = await request(server())
      .post('/auth/login')
      .send({ email: 'pedro@example.com', password: 'password123' });
    const body = loginRes.body as { accessToken: string };
    return body.accessToken;
  }

  describe('AC-4: cache miss + user found → Redis key set with TTL ≤ 3600', () => {
    it('AC-4: calls cacheManager.set with key "github_user:pedro-php" and TTL ≤ 3600 on successful DB lookup', async () => {
      // Arrange
      cacheManagerMock.get.mockResolvedValue(undefined); // cache miss
      prismaMock.user.findFirst.mockResolvedValue(mockPrismaUser);
      cacheManagerMock.set.mockResolvedValue(undefined);

      if (!accessToken) {
        accessToken = await loginAndGetToken();
        jest.resetAllMocks();
        // Re-stub after login reset
        cacheManagerMock.get.mockResolvedValue(null);
        prismaMock.user.findFirst.mockResolvedValue(mockPrismaUser);
        cacheManagerMock.set.mockResolvedValue(undefined);
      }

      // Act
      const res = await request(server())
        .get('/users/by-github/pedro-php')
        .set('Authorization', `Bearer ${accessToken}`);

      // Assert
      expect(res.status).toBe(200);
      expect(cacheManagerMock.set).toHaveBeenCalledWith(
        'github_user:pedro-php',
        expect.objectContaining({ name: 'Pedro PHP' }),
        expect.any(Number),
      );
      const [, , ttl] = cacheManagerMock.set.mock.calls[0] as [
        string,
        unknown,
        number,
      ];
      expect(ttl).toBeLessThanOrEqual(3600);
      expect(ttl).toBeGreaterThan(0);
    });
  });

  describe('AC-5: cache miss + user NOT found → Redis key set with null and TTL ≤ 300', () => {
    it('AC-5: calls cacheManager.set with key "github_user:unknown-id", null value, and TTL ≤ 300 on DB miss', async () => {
      // Arrange
      cacheManagerMock.get.mockResolvedValue(undefined); // cache miss
      prismaMock.user.findFirst.mockResolvedValue(null); // not in DB
      cacheManagerMock.set.mockResolvedValue(undefined);

      if (!accessToken) {
        accessToken = await loginAndGetToken();
        jest.resetAllMocks();
        cacheManagerMock.get.mockResolvedValue(null);
        prismaMock.user.findFirst.mockResolvedValue(null);
        cacheManagerMock.set.mockResolvedValue(undefined);
      }

      // Act
      const res = await request(server())
        .get('/users/by-github/unknown-id')
        .set('Authorization', `Bearer ${accessToken}`);

      // Assert
      expect(res.status).toBe(404);
      expect(cacheManagerMock.set).toHaveBeenCalledWith(
        'github_user:unknown-id',
        '__NOT_FOUND__',
        expect.any(Number),
      );
      const [, , ttl] = cacheManagerMock.set.mock.calls[0] as [
        string,
        unknown,
        number,
      ];
      expect(ttl).toBeLessThanOrEqual(300);
      expect(ttl).toBeGreaterThan(0);
    });
  });

  describe('AC-6: cache hit → prisma.user.findFirst NOT called', () => {
    it('AC-6: serves response from Redis without touching the database when cache key exists', async () => {
      // Arrange
      const cached = {
        name: 'Pedro PHP',
        profilePictureUrl: 'https://avatars.githubusercontent.com/u/12345',
      };
      cacheManagerMock.get.mockResolvedValue(cached); // cache HIT

      if (!accessToken) {
        accessToken = await loginAndGetToken();
        jest.resetAllMocks();
        cacheManagerMock.get.mockResolvedValue(cached);
      }

      // Act
      const res = await request(server())
        .get('/users/by-github/pedro-php')
        .set('Authorization', `Bearer ${accessToken}`);

      // Assert
      expect(res.status).toBe(200);
      expect(prismaMock.user.findFirst).not.toHaveBeenCalled();
      const body = res.body as {
        name: string;
        profilePictureUrl: string | null;
      };
      expect(body.name).toBe('Pedro PHP');
    });
  });
});
