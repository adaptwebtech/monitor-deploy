import { Test, TestingModule } from '@nestjs/testing';
import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import * as http from 'http';
import request from 'supertest';
import { PipelineStepsController } from './pipeline-steps.controller';
import { PipelineStepsService } from './pipeline-steps.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PipelineStepResponseDto } from './dto/pipeline-step-response.dto';

describe('PipelineStepsController (integration)', () => {
  let app: INestApplication;
  let pipelineStepsService: jest.Mocked<PipelineStepsService>;

  const mockStep: PipelineStepResponseDto = {
    id: 'step-uuid-1',
    id_pipeline_queue: 'queue-uuid-1',
    event: 'step',
    workflowName: 'whiz-server-ci-cd-dev-j8klp',
    stepName: 'build',
    del: false,
    createdAt: new Date(),
  };

  beforeAll(async () => {
    const pipelineStepsServiceMock: Partial<jest.Mocked<PipelineStepsService>> =
      {
        findAllByQueue: jest.fn(),
        findById: jest.fn(),
      };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PipelineStepsController],
      providers: [
        { provide: PipelineStepsService, useValue: pipelineStepsServiceMock },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          const req = ctx
            .switchToHttp()
            .getRequest<{ user: { id: string; root: boolean } }>();
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

    pipelineStepsService = moduleRef.get(PipelineStepsService);
  });

  afterAll(() => app.close());

  beforeEach(() => jest.resetAllMocks());

  describe('GET /pipeline-steps', () => {
    it('without page/limit returns all records (no page/limit in response shape)', async () => {
      // Arrange
      pipelineStepsService.findAllByQueue.mockResolvedValue({
        data: [
          mockStep,
          { ...mockStep, id: 'step-uuid-2', stepName: 'deploy' },
        ],
        total: 2,
      });

      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .get('/pipeline-steps')
        .query({ pipelineQueueId: 'queue-uuid-1' });

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as { data: unknown[]; total: number };
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
      expect(res.body).not.toHaveProperty('page');
      expect(res.body).not.toHaveProperty('limit');
    });

    it('with page and limit returns paginated shape', async () => {
      // Arrange
      pipelineStepsService.findAllByQueue.mockResolvedValue({
        data: [mockStep],
        total: 10,
        page: 1,
        limit: 5,
      });

      // Act
      const res = await request(app.getHttpServer() as http.Server)
        .get('/pipeline-steps')
        .query({ pipelineQueueId: 'queue-uuid-1', page: 1, limit: 5 });

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as {
        data: unknown[];
        total: number;
        page: number;
        limit: number;
      };
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.total).toBe(10);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(5);
    });

    it('returns 400 when pipelineQueueId query param is missing', async () => {
      // Act
      const res = await request(app.getHttpServer() as http.Server).get(
        '/pipeline-steps',
      );

      // Assert
      expect(res.status).toBe(400);
    });
  });

  describe('GET /pipeline-steps/:id', () => {
    it('returns 404 when step does not exist', async () => {
      // Arrange
      pipelineStepsService.findById.mockRejectedValue(
        new NotFoundException('Step não encontrado'),
      );

      // Act
      const res = await request(app.getHttpServer() as http.Server).get(
        '/pipeline-steps/non-existent-id',
      );

      // Assert
      expect(res.status).toBe(404);
    });

    it('returns 200 with step data when found', async () => {
      // Arrange
      pipelineStepsService.findById.mockResolvedValue(mockStep);

      // Act
      const res = await request(app.getHttpServer() as http.Server).get(
        `/pipeline-steps/${mockStep.id}`,
      );

      // Assert
      expect(res.status).toBe(200);
      const body = res.body as { id: string };
      expect(body.id).toBe(mockStep.id);
    });
  });
});
