import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import * as http from 'http';
import request from 'supertest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserResponseDto } from './dto/user-response.dto';

describe('UsersController (integration)', () => {
  let app: INestApplication;
  let usersService: jest.Mocked<UsersService>;

  const softDeleteMock = jest.fn<
    ReturnType<UsersService['softDelete']>,
    Parameters<UsersService['softDelete']>
  >();

  const mockUserResponse: UserResponseDto = {
    id: 'user-uuid-1',
    name: 'Pedro Miranda',
    email: 'pedro@example.com',
    root: false,
    del: false,
    githubId: null,
    profilePictureUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    const usersServiceMock: Partial<jest.Mocked<UsersService>> = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: softDeleteMock,
      regenerateToken: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersServiceMock }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user: { id: string; root: boolean };
          }>();
          const userId = req.headers['x-test-user'] ?? 'user-uuid-1';
          const role = req.headers['x-test-role'] ?? 'user';
          req.user = { id: userId, root: role === 'root' };
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

    usersService = moduleRef.get(UsersService);
  });

  afterAll(() => app.close());

  beforeEach(() => jest.resetAllMocks());

  describe('POST /users', () => {
    it('AC-8: returns 201 with UserResponseDto without password, salt or refreshToken', async () => {
      // Arrange
      usersService.create.mockResolvedValue(mockUserResponse);

      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .post('/users')
        .set('x-test-role', 'root')
        .set('x-test-user', 'root-uuid')
        .send({
          name: 'Pedro Miranda',
          email: 'pedro@example.com',
          password: 'password123',
        });

      // Assert
      expect(res.status).toBe(201);
      expect(res.body).not.toHaveProperty('password');
      expect(res.body).not.toHaveProperty('salt');
      expect(res.body).not.toHaveProperty('refreshToken');
    });
  });

  describe('GET /users', () => {
    it('returns 200 with pagination shape { data, total, page, limit }', async () => {
      // Arrange
      usersService.findAll.mockResolvedValue({
        data: [mockUserResponse],
        total: 1,
        page: 1,
        limit: 10,
      });

      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .get('/users')
        .set('x-test-user', 'user-uuid-1')
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
      expect(typeof body.total).toBe('number');
      expect(typeof body.page).toBe('number');
      expect(typeof body.limit).toBe('number');
    });
  });

  describe('GET /users/:id', () => {
    it('returns 404 when user does not exist', async () => {
      // Arrange
      usersService.findById.mockRejectedValue(
        new NotFoundException('Usuário não encontrado'),
      );

      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .get('/users/non-existent-id')
        .set('x-test-user', 'user-uuid-1');

      // Assert
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /users/:id', () => {
    it('AC-10: returns 403 when non-root tries to edit another user', async () => {
      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .patch('/users/different-user-uuid')
        .set('x-test-user', 'user-uuid-1')
        .set('x-test-role', 'user')
        .send({ name: 'Hacker Name' });

      // Assert
      expect(res.status).toBe(403);
    });

    it('returns 200 when user edits their own profile', async () => {
      // Arrange
      usersService.update.mockResolvedValue({
        ...mockUserResponse,
        name: 'Updated Name',
      });

      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .patch('/users/user-uuid-1')
        .set('x-test-user', 'user-uuid-1')
        .set('x-test-role', 'user')
        .send({ name: 'Updated Name' });

      // Assert
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /users/:id', () => {
    it('AC-10: returns 403 for non-root', async () => {
      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .delete('/users/user-uuid-1')
        .set('x-test-user', 'user-uuid-1')
        .set('x-test-role', 'user');

      // Assert
      expect(res.status).toBe(403);
    });

    it('returns 200 for root and sets del=true', async () => {
      // Arrange
      softDeleteMock.mockResolvedValue(undefined);

      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .delete('/users/user-uuid-1')
        .set('x-test-user', 'root-uuid')
        .set('x-test-role', 'root');

      // Assert
      expect(res.status).toBe(200);
      expect(softDeleteMock).toHaveBeenCalledWith('user-uuid-1');
    });
  });

  describe('POST /users/:id/regenerate-token', () => {
    it('returns 403 for non-root', async () => {
      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .post('/users/user-uuid-1/regenerate-token')
        .set('x-test-user', 'user-uuid-1')
        .set('x-test-role', 'user');

      // Assert
      expect(res.status).toBe(403);
    });

    it('returns 200 with refreshToken for root', async () => {
      // Arrange
      usersService.regenerateToken.mockResolvedValue('new-refresh-token');

      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .post('/users/user-uuid-1/regenerate-token')
        .set('x-test-user', 'root-uuid')
        .set('x-test-role', 'root');

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as { refreshToken: string };
      expect(typeof body.refreshToken).toBe('string');
    });
  });
});
