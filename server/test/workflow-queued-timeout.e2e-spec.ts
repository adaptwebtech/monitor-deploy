/**
 * E2E tests for workflow-queued-timeout feature
 * AC covered: AC-7
 *
 * Pattern: mocked PrismaService (consistent with project e2e convention).
 * Gets WorkflowCleanupService directly from the NestJS app module and invokes
 * cleanupQueuedWorkflows() to verify DB interaction behaviour end-to-end
 * through the real NestJS DI container and module wiring.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { WorkflowCleanupService } from '../src/workflow-cleanup/workflow-cleanup.service';

describe('WorkflowQueuedTimeout (e2e)', () => {
  let app: INestApplication;
  let service: WorkflowCleanupService;

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

    service = app.get<WorkflowCleanupService>(WorkflowCleanupService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  /**
   * AC-7: Given Queued pipeline with createdAt backdated to now-13h in real DB —
   * when cleanupQueuedWorkflows() invoked on service —
   * DB row has status=Failed, finalizedAt!=null.
   */
  describe('AC-7: pipeline Queued com createdAt=now-13h → DB atualizado para status=Failed e finalizedAt!=null', () => {
    it('AC-7: invoca cleanupQueuedWorkflows() no serviço real e verifica que pipelineQueue.update é chamado com status=Failed e finalizedAt definido', async () => {
      // Arrange — simula pipeline Queued criado há 13h (já ultrapassou a janela de 12h)
      const now = new Date();
      const createdAt13hAgo = new Date(now.getTime() - 13 * 60 * 60 * 1000);

      const queuedPipeline = {
        id: 'e2e-queued-timeout-pipeline-1',
        event: 'push',
        app: 'whiz-server',
        environment: 'development',
        commitSha: 'sha-queued-timeout-1',
        commitMessage: 'feat: queued timeout e2e',
        commitAuthor: 'E2E Author',
        commitAuthorAvatar: 'https://github.com/e2e.png',
        commitAuthorId: null,
        status: 'Queued',
        id_user: 'e2e-user-1',
        del: false,
        createdAt: createdAt13hAgo,
        updatedAt: createdAt13hAgo,
        startedAt: null,
        finalizedAt: null,
        steps: [],
      };

      const updatedPipeline = {
        ...queuedPipeline,
        status: 'Failed',
        finalizedAt: now,
      };

      // findMany returns the backdated Queued pipeline (simulating DB query with createdAt < now-12h)
      prismaMock.pipelineQueue.findMany.mockResolvedValue([queuedPipeline]);
      // update returns the pipeline already marked as Failed with finalizedAt set
      prismaMock.pipelineQueue.update.mockResolvedValue(updatedPipeline);

      // Act — invoke real service obtained from the NestJS DI container
      await service.cleanupQueuedWorkflows();

      // Assert — pipelineQueue.update called with correct data (status=Failed, finalizedAt set)
      type UpdateArg = {
        where: { id: string };
        data: { status: string; finalizedAt: unknown };
      };
      const [[updateCall]] = prismaMock.pipelineQueue.update.mock
        .calls as Array<[UpdateArg]>;
      expect(updateCall.where).toEqual({ id: queuedPipeline.id });
      expect(updateCall.data.status).toBe('Failed');
      expect(updateCall.data.finalizedAt).toBeInstanceOf(Date);
    });
  });
});
