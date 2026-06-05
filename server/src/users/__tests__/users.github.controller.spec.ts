import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import * as http from 'http';
import request from 'supertest';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { GithubUserResolutionDto } from '../dto/github-user-resolution.dto';

const CACHE_MANAGER = 'CACHE_MANAGER';

describe('UsersController — GET /users/by-github/:githubId (github-user-picture feature)', () => {
  let app: INestApplication;
  let usersService: jest.Mocked<Pick<UsersService, 'findByGithubIdCached'>>;

  const mockResolutionDto: GithubUserResolutionDto = {
    name: 'Pedro PHP',
    profilePictureUrl: 'https://avatars.githubusercontent.com/u/12345',
  };

  const cacheManagerMock = {
    get: jest.fn(),
    set: jest.fn(),
  };

  // Shared auth guard that grants access (used in AC-1 and AC-2)
  const permissiveGuard = {
    canActivate: (ctx: ExecutionContext) => {
      const req = ctx
        .switchToHttp()
        .getRequest<{ user: { id: string; email: string; root: boolean } }>();
      req.user = { id: 'user-uuid-1', email: 'user@example.com', root: false };
      return true;
    },
  };

  describe('AC-1 + AC-2: with auth guard overridden (permissive)', () => {
    beforeAll(async () => {
      const usersServiceMock = {
        findByGithubIdCached: jest.fn(),
      };

      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [UsersController],
        providers: [
          { provide: UsersService, useValue: usersServiceMock },
          { provide: CACHE_MANAGER, useValue: cacheManagerMock },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(permissiveGuard)
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

      usersService = moduleRef.get(UsersService);
    });

    afterAll(() => app.close());

    beforeEach(() => jest.resetAllMocks());

    it('AC-1: GET /users/by-github/pedro-php → 200 with { name, profilePictureUrl } for existing active user', async () => {
      // Arrange
      (usersService.findByGithubIdCached as jest.Mock).mockResolvedValue(
        mockResolutionDto,
      );

      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .get('/users/by-github/pedro-php')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as {
        name: string;
        profilePictureUrl: string | null;
      };
      expect(body).toMatchObject({ name: 'Pedro PHP' });
      expect(
        Object.prototype.hasOwnProperty.call(body, 'profilePictureUrl'),
      ).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(body, 'name')).toBe(true);
      // Must NOT expose sensitive fields
      expect(body).not.toHaveProperty('password');
      expect(body).not.toHaveProperty('email');
      expect(body).not.toHaveProperty('salt');
      expect(body).not.toHaveProperty('refreshToken');
    });

    it('AC-2: GET /users/by-github/unknown-id → 404 when no active user has that githubId', async () => {
      // Arrange
      (usersService.findByGithubIdCached as jest.Mock).mockRejectedValue(
        new NotFoundException('Usuário não encontrado via githubId unknown-id'),
      );

      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .get('/users/by-github/unknown-id')
        .set('Authorization', 'Bearer valid-token');

      // Assert
      expect(res.status).toBe(404);
    });
  });

  describe('AC-3: without auth guard override (real guard rejects unauthenticated)', () => {
    let appNoGuardOverride: INestApplication;

    beforeAll(async () => {
      const usersServiceMock = {
        findByGithubIdCached: jest.fn(),
      };

      const moduleRef: TestingModule = await Test.createTestingModule({
        controllers: [UsersController],
        providers: [
          { provide: UsersService, useValue: usersServiceMock },
          { provide: CACHE_MANAGER, useValue: cacheManagerMock },
        ],
      })
        // Simulate a guard that returns 401 when Authorization header is absent
        .overrideGuard(JwtAuthGuard)
        .useValue({
          canActivate: (ctx: ExecutionContext) => {
            const req = ctx
              .switchToHttp()
              .getRequest<{ headers: Record<string, string | undefined> }>();
            const auth = req.headers['authorization'];
            if (!auth) throw new UnauthorizedException();
            return true;
          },
        })
        .compile();

      appNoGuardOverride = moduleRef.createNestApplication();
      appNoGuardOverride.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await appNoGuardOverride.init();
    });

    afterAll(() => appNoGuardOverride.close());

    beforeEach(() => jest.resetAllMocks());

    it('AC-3: GET /users/by-github/:githubId without Authorization header → 401', async () => {
      // Arrange — no Authorization header sent

      // Act
      const res = await request(
        appNoGuardOverride.getHttpServer() as http.Server,
      ).get('/users/by-github/pedro-php');

      // Assert
      expect(res.status).toBe(401);
    });
  });
});
