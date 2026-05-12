import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('DashboardController (integration)', () => {
  let app: INestApplication;
  let dashboardService: jest.Mocked<DashboardService>;

  // Module without guard override — for 401 test
  let appWithGuard: INestApplication;

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

    // App with overridden guard (authenticated)
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = { id: 'user-uuid-1', root: false };
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

    // App with real guard (for 401 test)
    const moduleRefWithGuard: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceMock },
      ],
    }).compile();

    appWithGuard = moduleRefWithGuard.createNestApplication();
    appWithGuard.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await appWithGuard.init();
  });

  afterAll(async () => {
    await app.close();
    await appWithGuard.close();
  });

  beforeEach(() => jest.resetAllMocks());

  describe('GET /dashboard/kpis', () => {
    it('returns 200 with { total, succeeded, failed, errorRate } when dates are provided', async () => {
      // Arrange
      dashboardService.getKpis.mockResolvedValue(mockKpis);

      // Act
      const res = await request(app.getHttpServer())
        .get('/dashboard/kpis')
        .query({
          dateStart: '2024-01-01T00:00:00Z',
          dateEnd: '2024-01-31T23:59:59Z',
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

    it('returns 400 when dateStart is missing', async () => {
      // Act
      const res = await request(app.getHttpServer())
        .get('/dashboard/kpis')
        .query({ dateEnd: '2024-01-31T23:59:59Z' });

      // Assert
      expect(res.status).toBe(400);
    });

    it('returns 400 when dateEnd is missing', async () => {
      // Act
      const res = await request(app.getHttpServer())
        .get('/dashboard/kpis')
        .query({ dateStart: '2024-01-01T00:00:00Z' });

      // Assert
      expect(res.status).toBe(400);
    });

    it('returns 401 when no JWT is provided', async () => {
      // Act
      const res = await request(appWithGuard.getHttpServer())
        .get('/dashboard/kpis')
        .query({
          dateStart: '2024-01-01T00:00:00Z',
          dateEnd: '2024-01-31T23:59:59Z',
        });

      // Assert
      expect(res.status).toBe(401);
    });
  });
});
