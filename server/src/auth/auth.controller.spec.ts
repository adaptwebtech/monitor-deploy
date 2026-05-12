import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController (integration)', () => {
  let app: INestApplication;
  let authService: jest.Mocked<AuthService>;

  const mockUserResponse = {
    id: 'user-uuid-1',
    name: 'Pedro Miranda',
    email: 'pedro@example.com',
    root: false,
    del: false,
    githubId: null,
    profilePictureUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    const authServiceMock: Partial<jest.Mocked<AuthService>> = {
      login: jest.fn(),
      refresh: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    authService = moduleRef.get(AuthService);
  });

  afterAll(() => app.close());

  beforeEach(() => jest.resetAllMocks());

  describe('POST /auth/login', () => {
    it('AC-6: returns 200 with accessToken, refreshToken and user on valid credentials', async () => {
      // Arrange
      authService.login.mockResolvedValue({
        accessToken: 'access-token-jwt',
        refreshToken: 'refresh-token-jwt',
        user: mockUserResponse as any,
      });

      // Act
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'pedro@example.com', password: 'validpassword123' });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        accessToken: 'access-token-jwt',
        refreshToken: 'refresh-token-jwt',
        user: expect.objectContaining({ email: 'pedro@example.com' }),
      });
    });

    it('returns 401 when password is wrong', async () => {
      // Arrange
      const { UnauthorizedException } = await import('@nestjs/common');
      authService.login.mockRejectedValue(
        new UnauthorizedException('Credenciais inválidas'),
      );

      // Act
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'pedro@example.com', password: 'wrongpassword' });

      // Assert
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('AC-7: returns 200 with new accessToken on valid refreshToken', async () => {
      // Arrange
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
      });

      // Act
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ accessToken: 'new-access-token' });
    });

    it('returns 401 when refreshToken is invalid or does not match DB', async () => {
      // Arrange
      const { UnauthorizedException } = await import('@nestjs/common');
      authService.refresh.mockRejectedValue(
        new UnauthorizedException('Token inválido'),
      );

      // Act
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'bad-token' });

      // Assert
      expect(res.status).toBe(401);
    });
  });
});
