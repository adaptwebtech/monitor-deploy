import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PipelineStepsController } from './pipeline-steps.controller';
import { PipelineStepsService } from './pipeline-steps.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('PipelineStepsController (integration)', () => {
  let app: INestApplication;
  let pipelineStepsService: jest.Mocked<PipelineStepsService>;

  const mockStep = {
    id: 'step-uuid-1',
    id_pipeline_queue: 'queue-uuid-1',
    event: 'step',
    workflowName: 'whiz-server-ci-cd-dev-j8klp',
    stepName: 'build',
    del: false,
    createdAt: new Date().toISOString(),
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

    pipelineStepsService = moduleRef.get(PipelineStepsService);
  });

  afterAll(() => app.close());

  beforeEach(() => jest.resetAllMocks());

  describe('GET /pipeline-steps', () => {
    it('without page/limit returns all records (no page/limit in response shape)', async () => {
      // Arrange
      pipelineStepsService.findAllByQueue.mockResolvedValue({
        data: [
          mockStep as any,
          { ...mockStep, id: 'step-uuid-2', stepName: 'deploy' },
        ],
        total: 2,
      });

      // Act
      const res = await request(app.getHttpServer())
        .get('/pipeline-steps')
        .query({ pipelineQueueId: 'queue-uuid-1' });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).not.toHaveProperty('page');
      expect(res.body).not.toHaveProperty('limit');
    });

    it('with page and limit returns paginated shape', async () => {
      // Arrange
      pipelineStepsService.findAllByQueue.mockResolvedValue({
        data: [mockStep as any],
        total: 10,
        page: 1,
        limit: 5,
      });

      // Act
      const res = await request(app.getHttpServer())
        .get('/pipeline-steps')
        .query({ pipelineQueueId: 'queue-uuid-1', page: 1, limit: 5 });

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        data: expect.any(Array),
        total: 10,
        page: 1,
        limit: 5,
      });
    });

    it('returns 400 when pipelineQueueId query param is missing', async () => {
      // Act
      const res = await request(app.getHttpServer()).get('/pipeline-steps');

      // Assert
      expect(res.status).toBe(400);
    });
  });

  describe('GET /pipeline-steps/:id', () => {
    it('returns 404 when step does not exist', async () => {
      // Arrange
      const { NotFoundException } = await import('@nestjs/common');
      pipelineStepsService.findById.mockRejectedValue(
        new NotFoundException('Step não encontrado'),
      );

      // Act
      const res = await request(app.getHttpServer()).get(
        '/pipeline-steps/non-existent-id',
      );

      // Assert
      expect(res.status).toBe(404);
    });

    it('returns 200 with step data when found', async () => {
      // Arrange
      pipelineStepsService.findById.mockResolvedValue(mockStep as any);

      // Act
      const res = await request(app.getHttpServer()).get(
        `/pipeline-steps/${mockStep.id}`,
      );

      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: mockStep.id });
    });
  });
});
