/**
 * Unit tests for WebhookService — pipeline queue timestamp behaviour
 * Feature: pipeline-queue-timestamps
 * ACs covered: AC-2, AC-3, AC-4, AC-5
 */
import { WebhookService } from '../webhook.service';
import { PipelineQueueService } from '../../pipeline-queue/pipeline-queue.service';
import { PipelineStepsService } from '../../pipeline-steps/pipeline-steps.service';
import { UsersService } from '../../users/users.service';
import { PipelineGateway } from '../../gateway/pipeline.gateway';
import { PipelineStepResponseDto } from '../../pipeline-steps/dto/pipeline-step-response.dto';

describe('WebhookService — timestamps (pipeline-queue-timestamps)', () => {
  let service: WebhookService;
  let pipelineQueueService: jest.Mocked<PipelineQueueService>;
  let pipelineStepsService: jest.Mocked<PipelineStepsService>;
  let usersService: jest.Mocked<UsersService>;
  let pipelineGateway: jest.Mocked<PipelineGateway>;

  const basePayload = {
    app: 'whiz-server',
    environment: 'development',
    commitSha: 'ts-commit-sha',
    commitMessage: 'feat: timestamps',
    commitAuthor: 'Pedro Miranda',
    commitAuthorAvatar: 'https://github.com/pedro.png',
    commitAuthorId: null as string | null,
    workflowName: 'workflow-ci' as string | null,
    stepName: 'build' as string | null,
  };

  // Pipeline with startedAt = null (never started)
  const queueQueued = {
    id: 'queue-ts-uuid-1',
    event: 'queued',
    app: 'whiz-server',
    environment: 'development',
    commitSha: 'ts-commit-sha',
    commitMessage: 'feat: timestamps',
    commitAuthor: 'Pedro Miranda',
    commitAuthorAvatar: 'https://github.com/pedro.png',
    commitAuthorId: null,
    status: 'Queued',
    id_user: null,
    del: false,
    startedAt: null,
    finalizedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    currentStep: null,
  };

  // Pipeline already Running with startedAt already set (for AC-5 idempotency test)
  const queueRunningWithStartedAt = {
    ...queueQueued,
    status: 'Running',
    startedAt: new Date('2025-01-01T09:00:00Z'),
  };

  const mockStep: PipelineStepResponseDto = {
    id: 'step-ts-uuid-1',
    id_pipeline_queue: 'queue-ts-uuid-1',
    event: 'step',
    stepName: 'build',
    workflowName: 'workflow-ci',
    del: false,
    createdAt: new Date(),
  };

  const pipelineQueueCreateMock = jest.fn<
    ReturnType<PipelineQueueService['create']>,
    Parameters<PipelineQueueService['create']>
  >();
  const pipelineQueueUpdateMock = jest.fn<
    ReturnType<PipelineQueueService['update']>,
    Parameters<PipelineQueueService['update']>
  >();
  const pipelineQueueFindByCommitMock = jest.fn<
    ReturnType<PipelineQueueService['findByCommit']>,
    Parameters<PipelineQueueService['findByCommit']>
  >();
  const pipelineStepsCreateMock = jest.fn<
    ReturnType<PipelineStepsService['create']>,
    Parameters<PipelineStepsService['create']>
  >();
  const gatewayEmitUpdatedMock = jest.fn<
    ReturnType<PipelineGateway['emitPipelineUpdated']>,
    Parameters<PipelineGateway['emitPipelineUpdated']>
  >();
  const gatewayEmitCreatedMock = jest.fn<
    ReturnType<PipelineGateway['emitPipelineCreated']>,
    Parameters<PipelineGateway['emitPipelineCreated']>
  >();

  beforeEach(() => {
    jest.resetAllMocks();

    pipelineQueueService = {
      create: pipelineQueueCreateMock,
      update: pipelineQueueUpdateMock,
      findByCommit: pipelineQueueFindByCommitMock,
      findAll: jest.fn(),
      findMine: jest.fn(),
      findById: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<PipelineQueueService>;

    pipelineStepsService = {
      create: pipelineStepsCreateMock,
      findAllByQueue: jest.fn(),
      findById: jest.fn(),
    } as unknown as jest.Mocked<PipelineStepsService>;

    usersService = {
      findByGithubId: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    pipelineGateway = {
      emitPipelineCreated: gatewayEmitCreatedMock,
      emitPipelineUpdated: gatewayEmitUpdatedMock,
    } as unknown as jest.Mocked<PipelineGateway>;

    service = new WebhookService(
      pipelineQueueService,
      pipelineStepsService,
      usersService,
      pipelineGateway,
    );
  });

  describe('handleEvent — step (Queued → Running)', () => {
    it('AC-2: sets startedAt = now() when transitioning Queued → Running (startedAt was null)', async () => {
      // Arrange — queue is Queued with startedAt = null
      pipelineQueueFindByCommitMock.mockResolvedValue(queueQueued);
      pipelineQueueUpdateMock.mockResolvedValue({
        ...queueQueued,
        status: 'Running',
        startedAt: new Date(),
      });
      pipelineStepsCreateMock.mockResolvedValue(mockStep);

      const beforeCall = new Date();

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'step',
      });

      const afterCall = new Date();

      // Assert — update must have been called with startedAt set to a Date within test window
      expect(pipelineQueueUpdateMock).toHaveBeenCalledWith(
        queueQueued.id,
        expect.objectContaining({
          status: 'Running',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          startedAt: expect.any(Date),
        }),
      );

      // Verify the startedAt value is within the test window
      const updateArgs = pipelineQueueUpdateMock.mock.calls.find(
        ([, data]) =>
          (data as Record<string, unknown>)['startedAt'] instanceof Date,
      );
      expect(updateArgs).toBeDefined();
      const startedAt = (updateArgs![1] as Record<string, unknown>)[
        'startedAt'
      ] as Date;
      expect(startedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(startedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('AC-5: does NOT overwrite startedAt when pipeline already has startedAt set (idempotent retry)', async () => {
      // Arrange — queue is already Running with startedAt set
      pipelineQueueFindByCommitMock.mockResolvedValue(
        queueRunningWithStartedAt,
      );
      pipelineQueueUpdateMock.mockResolvedValue({
        ...queueRunningWithStartedAt,
        status: 'Running',
      });
      pipelineStepsCreateMock.mockResolvedValue(mockStep);

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'step',
      });

      // Assert — update must NOT include startedAt (already set, must not be overwritten)
      const statusUpdateCall = pipelineQueueUpdateMock.mock.calls.find(
        ([id]) => id === queueRunningWithStartedAt.id,
      );
      expect(statusUpdateCall).toBeDefined();
      const updateData = statusUpdateCall![1] as Record<string, unknown>;
      // startedAt must not be present (or must be undefined) in the update payload
      expect(updateData).not.toHaveProperty('startedAt');
    });
  });

  describe('handleEvent — Succeeded (Running → Completed)', () => {
    it('AC-3: sets finalizedAt = now() when transitioning to Completed', async () => {
      // Arrange — queue is Running
      const queueRunning = {
        ...queueQueued,
        status: 'Running',
        startedAt: new Date(),
      };
      pipelineQueueFindByCommitMock.mockResolvedValue(queueRunning);
      pipelineQueueUpdateMock.mockResolvedValue({
        ...queueRunning,
        status: 'Completed',
        finalizedAt: new Date(),
      });

      const beforeCall = new Date();

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'Succeeded',
      });

      const afterCall = new Date();

      // Assert — update must include finalizedAt as a Date
      expect(pipelineQueueUpdateMock).toHaveBeenCalledWith(
        queueRunning.id,
        expect.objectContaining({
          status: 'Completed',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          finalizedAt: expect.any(Date),
        }),
      );

      const updateArgs = pipelineQueueUpdateMock.mock.calls.find(
        ([, data]) =>
          (data as Record<string, unknown>)['finalizedAt'] instanceof Date,
      );
      expect(updateArgs).toBeDefined();
      const finalizedAt = (updateArgs![1] as Record<string, unknown>)[
        'finalizedAt'
      ] as Date;
      expect(finalizedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCall.getTime(),
      );
      expect(finalizedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });
  });

  describe('handleEvent — Error (Running → Failed)', () => {
    it('AC-4: sets finalizedAt = now() when transitioning to Failed', async () => {
      // Arrange — queue is Running
      const queueRunning = {
        ...queueQueued,
        status: 'Running',
        startedAt: new Date(),
      };
      pipelineQueueFindByCommitMock.mockResolvedValue(queueRunning);
      pipelineQueueUpdateMock.mockResolvedValue({
        ...queueRunning,
        status: 'Failed',
        finalizedAt: new Date(),
      });

      const beforeCall = new Date();

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'Error',
      });

      const afterCall = new Date();

      // Assert — update must include finalizedAt as a Date
      expect(pipelineQueueUpdateMock).toHaveBeenCalledWith(
        queueRunning.id,
        expect.objectContaining({
          status: 'Failed',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          finalizedAt: expect.any(Date),
        }),
      );

      const updateArgs = pipelineQueueUpdateMock.mock.calls.find(
        ([, data]) =>
          (data as Record<string, unknown>)['finalizedAt'] instanceof Date,
      );
      expect(updateArgs).toBeDefined();
      const finalizedAt = (updateArgs![1] as Record<string, unknown>)[
        'finalizedAt'
      ] as Date;
      expect(finalizedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCall.getTime(),
      );
      expect(finalizedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });
  });
});
