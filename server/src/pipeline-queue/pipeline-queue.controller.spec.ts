import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PipelineQueueController } from './pipeline-queue.controller';
import { PipelineQueueService } from './pipeline-queue.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('PipelineQueueController (integration)', () => {
  let app: INestApplication;
  let pipelineQueueService: jest.Mocked<PipelineQueueService>;

  const mockQueue = {
    id: 'queue-uuid-1',
    event: 'queued',
    app: 'whiz-server',
    environment: 'development',
    commitSha: 'abc123sha',
    commitMessage: 'feat: add monitoring',
    commitAuthor: 'Pedro Miranda',
    commitAuthorAvatar: 'https://github.com/pedro.png',
    commitAuthorId: null,
    status: 'Queued',
    id_user: 'user-uuid-1',
    del: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    const pipelineQueueServiceMock: Partial<jest.Mocked<PipelineQueueService>> =
      {
        findAll: jest.fn(),
        findMine: jest.fn(),
        findById: jest.fn(),
        update: jest.fn(),
        softDelete: jest.fn(),
      };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PipelineQueueController],
      providers: [
        { provide: PipelineQueueService, useValue: pipelineQueueServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          req.user = {
            id: req.headers['x-test-user'] ?? 'user-uuid-1',
            root: req.headers['x-test-role'] === 'root',
          };
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

    pipelineQueueService = moduleRef.get(PipelineQueueService);
  });

  afterAll(() => app.close());

  beforeEach(() => jest.resetAllMocks());

  describe('GET /pipeline-queue', () => {
    it('AC-11: returns only records within the dateStart/dateEnd range', async () => {
      // Arrange
      pipelineQueueService.findAll.mockResolvedValue({
        data: [mockQueue as any],
        total: 1,
        page: 1,
        limit: 10,
      });

      // Act
      const res = await request(app.getHttpServer())
        .get('/pipeline-queue')
        .set('x-test-user', 'user-uuid-1')
        .query({
          dateStart: '2024-01-01T00:00:00Z',
          dateEnd: '2024-01-31T23:59:59Z',
          page: 1,
          limit: 10,
        });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: expect.any(Array),
        total: 1,
        page: 1,
        limit: 10,
      });
      expect(pipelineQueueService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          dateStart: '2024-01-01T00:00:00Z',
          dateEnd: '2024-01-31T23:59:59Z',
        }),
      );
    });
  });

  describe('GET /pipeline-queue/mine', () => {
    it('returns only the authenticated user records', async () => {
      // Arrange
      pipelineQueueService.findMine.mockResolvedValue({
        data: [mockQueue as any],
        total: 1,
        page: 1,
        limit: 10,
      });

      // Act
      const res = await request(app.getHttpServer())
        .get('/pipeline-queue/mine')
        .set('x-test-user', 'user-uuid-1')
        .query({ page: 1, limit: 10 });

      // Assert
      expect(res.status).toBe(200);
      expect(pipelineQueueService.findMine).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.anything(),
      );
    });
  });

  describe('GET /pipeline-queue/:id', () => {
    it('returns 404 when pipeline queue not found', async () => {
      // Arrange
      const { NotFoundException } = await import('@nestjs/common');
      pipelineQueueService.findById.mockRejectedValue(
        new NotFoundException('Pipeline não encontrado'),
      );

      // Act
      const res = await request(app.getHttpServer())
        .get('/pipeline-queue/non-existent-id')
        .set('x-test-user', 'user-uuid-1');

      // Assert
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /pipeline-queue/:id', () => {
    it('returns 200 with updated pipeline queue', async () => {
      // Arrange
      pipelineQueueService.update.mockResolvedValue({
        ...mockQueue,
        status: 'Running',
      } as any);

      // Act
      const res = await request(app.getHttpServer())
        .patch('/pipeline-queue/queue-uuid-1')
        .set('x-test-user', 'user-uuid-1')
        .send({ status: 'Running' });

      // Assert
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /pipeline-queue/:id', () => {
    it('returns 200 when soft-deleting an existing pipeline queue', async () => {
      // Arrange
      pipelineQueueService.softDelete.mockResolvedValue(undefined);

      // Act
      const res = await request(app.getHttpServer())
        .delete('/pipeline-queue/queue-uuid-1')
        .set('x-test-user', 'user-uuid-1');

      // Assert
      expect(res.status).toBe(200);
    });
  });
});
