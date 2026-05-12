import { WebhookService } from './webhook.service';
import { PipelineQueueService } from '../pipeline-queue/pipeline-queue.service';
import { PipelineStepsService } from '../pipeline-steps/pipeline-steps.service';
import { UsersService } from '../users/users.service';
import { PipelineGateway } from '../gateway/pipeline.gateway';

describe('WebhookService', () => {
  let service: WebhookService;
  let pipelineQueueService: jest.Mocked<PipelineQueueService>;
  let pipelineStepsService: jest.Mocked<PipelineStepsService>;
  let usersService: jest.Mocked<UsersService>;
  let pipelineGateway: jest.Mocked<PipelineGateway>;

  const basePayload = {
    app: 'whiz-server',
    environment: 'development',
    commitSha: 'abc123sha',
    commitMessage: 'feat: add monitoring',
    commitAuthor: 'Pedro Miranda',
    commitAuthorAvatar: 'https://github.com/pedro.png',
    commitAuthorId: null as string | null,
    workflowName: null as string | null,
    stepName: null as string | null,
  };

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
    id_user: null,
    del: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser = {
    id: 'user-uuid-gh',
    githubId: 'gh-user-123',
    name: 'Pedro Miranda',
    email: 'pedro@example.com',
    root: false,
    del: false,
  };

  beforeEach(() => {
    jest.resetAllMocks();

    pipelineQueueService = {
      create: jest.fn(),
      update: jest.fn(),
      findByCommit: jest.fn(),
      findAll: jest.fn(),
      findMine: jest.fn(),
      findById: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<PipelineQueueService>;

    pipelineStepsService = {
      create: jest.fn(),
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
      emitPipelineCreated: jest.fn(),
      emitPipelineUpdated: jest.fn(),
    } as unknown as jest.Mocked<PipelineGateway>;

    service = new WebhookService(
      pipelineQueueService,
      pipelineStepsService,
      usersService,
      pipelineGateway,
    );
  });

  describe('handleEvent — queued', () => {
    it('AC-1: creates pipeline_queue with status=Queued and emits pipeline.created', async () => {
      // Arrange
      pipelineQueueService.create.mockResolvedValue(mockQueue);

      // Act
      await service.handleEvent({ ...basePayload, event: 'queued' });

      // Assert
      expect(pipelineQueueService.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Queued' }),
      );
      expect(pipelineGateway.emitPipelineCreated).toHaveBeenCalledWith(
        mockQueue,
      );
    });

    it('calls findByGithubId and sets id_user when commitAuthorId is present and user exists', async () => {
      // Arrange
      pipelineQueueService.create.mockResolvedValue(mockQueue);
      usersService.findByGithubId.mockResolvedValue(mockUser as any);
      pipelineQueueService.update.mockResolvedValue({
        ...mockQueue,
        id_user: mockUser.id,
      });

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'queued',
        commitAuthorId: 'gh-user-123',
      });

      // Assert
      expect(usersService.findByGithubId).toHaveBeenCalledWith('gh-user-123');
      expect(pipelineQueueService.update).toHaveBeenCalledWith(
        mockQueue.id,
        expect.objectContaining({ id_user: mockUser.id }),
      );
    });

    it('does NOT set id_user when commitAuthorId is present but user is not found', async () => {
      // Arrange
      pipelineQueueService.create.mockResolvedValue(mockQueue);
      usersService.findByGithubId.mockResolvedValue(null);

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'queued',
        commitAuthorId: 'unknown-github-id',
      });

      // Assert
      expect(usersService.findByGithubId).toHaveBeenCalledWith(
        'unknown-github-id',
      );
      expect(pipelineQueueService.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id_user: expect.anything() }),
      );
    });
  });

  describe('handleEvent — step', () => {
    it('AC-2: finds queue by commitSha+app+env, sets status=Running, creates step, emits pipeline.updated', async () => {
      // Arrange
      pipelineQueueService.findByCommit.mockResolvedValue(mockQueue);
      pipelineQueueService.update.mockResolvedValue({
        ...mockQueue,
        status: 'Running',
      });
      pipelineStepsService.create.mockResolvedValue({
        id: 'step-uuid-1',
        event: 'step',
        stepName: 'build',
        workflowName: 'whiz-server-ci-cd-dev-j8klp',
      } as any);

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'step',
        stepName: 'build',
        workflowName: 'whiz-server-ci-cd-dev-j8klp',
      });

      // Assert
      expect(pipelineQueueService.findByCommit).toHaveBeenCalledWith(
        'abc123sha',
        'whiz-server',
        'development',
      );
      expect(pipelineQueueService.update).toHaveBeenCalledWith(
        mockQueue.id,
        expect.objectContaining({ status: 'Running' }),
      );
      expect(pipelineStepsService.create).toHaveBeenCalled();
      expect(pipelineGateway.emitPipelineUpdated).toHaveBeenCalled();
    });

    it('does nothing if no matching pipeline_queue found for step event', async () => {
      // Arrange
      pipelineQueueService.findByCommit.mockResolvedValue(null);

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'step',
        stepName: 'build',
        workflowName: 'workflow-name',
      });

      // Assert
      expect(pipelineQueueService.update).not.toHaveBeenCalled();
      expect(pipelineStepsService.create).not.toHaveBeenCalled();
      expect(pipelineGateway.emitPipelineUpdated).not.toHaveBeenCalled();
    });

    it('links id_user on step event when id_user is null and commitAuthorId is present and user found', async () => {
      // Arrange
      const queueWithoutUser = { ...mockQueue, id_user: null };
      pipelineQueueService.findByCommit.mockResolvedValue(queueWithoutUser);
      pipelineQueueService.update.mockResolvedValue({
        ...queueWithoutUser,
        status: 'Running',
      });
      pipelineStepsService.create.mockResolvedValue({
        id: 'step-uuid-1',
      } as any);
      usersService.findByGithubId.mockResolvedValue(mockUser as any);

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'step',
        stepName: 'clone',
        workflowName: 'workflow-name',
        commitAuthorId: 'gh-user-123',
      });

      // Assert
      expect(usersService.findByGithubId).toHaveBeenCalledWith('gh-user-123');
      expect(pipelineQueueService.update).toHaveBeenCalledWith(
        queueWithoutUser.id,
        expect.objectContaining({ id_user: mockUser.id }),
      );
    });
  });

  describe('handleEvent — Succeeded', () => {
    it('AC-3: updates status=Completed and emits pipeline.updated', async () => {
      // Arrange
      pipelineQueueService.findByCommit.mockResolvedValue(mockQueue);
      pipelineQueueService.update.mockResolvedValue({
        ...mockQueue,
        status: 'Completed',
      });

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'Succeeded',
        workflowName: 'workflow-name',
      });

      // Assert
      expect(pipelineQueueService.update).toHaveBeenCalledWith(
        mockQueue.id,
        expect.objectContaining({ status: 'Completed' }),
      );
      expect(pipelineGateway.emitPipelineUpdated).toHaveBeenCalled();
    });
  });

  describe('handleEvent — Error', () => {
    it('AC-4: updates status=Failed and emits pipeline.updated', async () => {
      // Arrange
      pipelineQueueService.findByCommit.mockResolvedValue(mockQueue);
      pipelineQueueService.update.mockResolvedValue({
        ...mockQueue,
        status: 'Failed',
      });

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'Error',
        workflowName: 'workflow-name',
      });

      // Assert
      expect(pipelineQueueService.update).toHaveBeenCalledWith(
        mockQueue.id,
        expect.objectContaining({ status: 'Failed' }),
      );
      expect(pipelineGateway.emitPipelineUpdated).toHaveBeenCalled();
    });
  });
});
