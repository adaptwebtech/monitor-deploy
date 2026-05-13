import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import * as http from 'http';
import request from 'supertest';
import { PipelineQueueController } from './pipeline-queue.controller';
import { PipelineQueueService } from './pipeline-queue.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PipelineQueueResponseDto } from './dto/pipeline-queue-response.dto';

describe('PipelineQueueController (integration)', () => {
  let app: INestApplication;
  let pipelineQueueService: jest.Mocked<PipelineQueueService>;

  const findAllMock = jest.fn<
    ReturnType<PipelineQueueService['findAll']>,
    Parameters<PipelineQueueService['findAll']>
  >();
  const findMineMock = jest.fn<
    ReturnType<PipelineQueueService['findMine']>,
    Parameters<PipelineQueueService['findMine']>
  >();

  const mockQueue: PipelineQueueResponseDto = {
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    const pipelineQueueServiceMock: Partial<jest.Mocked<PipelineQueueService>> =
      {
        findAll: findAllMock,
        findMine: findMineMock,
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
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx.switchToHttp().getRequest<{
            headers: Record<string, string | undefined>;
            user: { id: string; root: boolean };
          }>();
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
      findAllMock.mockResolvedValue({
        data: [mockQueue],
        total: 1,
        page: 1,
        limit: 10,
      });

      // Act
      const res = await request(app.getHttpServer() as http.Server)
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
      const body = res.body as {
        data: unknown[];
        total: number;
        page: number;
        limit: number;
      };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.total).toBe(1);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(10);
      expect(findAllMock).toHaveBeenCalledWith(
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
      findMineMock.mockResolvedValue({
        data: [mockQueue],
        total: 1,
        page: 1,
        limit: 10,
      });

      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .get('/pipeline-queue/mine')
        .set('x-test-user', 'user-uuid-1')
        .query({ page: 1, limit: 10 });

      // Assert
      expect(res.status).toBe(200);
      expect(findMineMock).toHaveBeenCalledWith(
        'user-uuid-1',
        expect.anything(),
      );
    });
  });

  describe('GET /pipeline-queue/:id', () => {
    it('returns 404 when pipeline queue not found', async () => {
      // Arrange
      pipelineQueueService.findById.mockRejectedValue(
        new NotFoundException('Pipeline não encontrado'),
      );

      // Act
      const res = await request(app.getHttpServer() as http.Server)
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
      });

      // Act
      const res = await request(app.getHttpServer() as http.Server)
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
      const res = await request(app.getHttpServer() as http.Server)
        .delete('/pipeline-queue/queue-uuid-1')
        .set('x-test-user', 'user-uuid-1');

      // Assert
      expect(res.status).toBe(200);
    });
  });
});
