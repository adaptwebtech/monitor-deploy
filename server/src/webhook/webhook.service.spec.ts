import { WebhookService } from './webhook.service';
import { PipelineQueueService } from '../pipeline-queue/pipeline-queue.service';
import { PipelineStepsService } from '../pipeline-steps/pipeline-steps.service';
import { UsersService } from '../users/users.service';
import { PipelineGateway } from '../gateway/pipeline.gateway';
import { PipelineStepResponseDto } from '../pipeline-steps/dto/pipeline-step-response.dto';

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
    profilePictureUrl: null as string | null,
    password: '$2b$10$hashedvalue',
    salt: '$2b$10$generateduniquesalt',
    root: false,
    refreshToken: null as string | null,
    del: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStep: PipelineStepResponseDto = {
    id: 'step-uuid-1',
    id_pipeline_queue: 'queue-uuid-1',
    event: 'step',
    stepName: 'build',
    workflowName: 'whiz-server-ci-cd-dev-j8klp',
    del: false,
    createdAt: new Date(),
  };

  // Standalone typed mock functions to avoid unbound-method lint errors
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
  const usersServiceFindByGithubIdMock = jest.fn<
    ReturnType<UsersService['findByGithubId']>,
    Parameters<UsersService['findByGithubId']>
  >();
  const gatewayEmitCreatedMock = jest.fn<
    ReturnType<PipelineGateway['emitPipelineCreated']>,
    Parameters<PipelineGateway['emitPipelineCreated']>
  >();
  const gatewayEmitUpdatedMock = jest.fn<
    ReturnType<PipelineGateway['emitPipelineUpdated']>,
    Parameters<PipelineGateway['emitPipelineUpdated']>
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
      findByGithubId: usersServiceFindByGithubIdMock,
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

  describe('handleEvent — queued', () => {
    it('AC-1: creates pipeline_queue with status=Queued and emits pipeline.created', async () => {
      // Arrange
      pipelineQueueCreateMock.mockResolvedValue(mockQueue);

      // Act
      await service.handleEvent({ ...basePayload, event: 'queued' });

      // Assert
      expect(pipelineQueueCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'Queued' }),
      );
      expect(gatewayEmitCreatedMock).toHaveBeenCalledWith(mockQueue);
    });

    it('calls findByGithubId and sets id_user when commitAuthorId is present and user exists', async () => {
      // Arrange
      pipelineQueueCreateMock.mockResolvedValue(mockQueue);
      usersServiceFindByGithubIdMock.mockResolvedValue(mockUser);
      pipelineQueueUpdateMock.mockResolvedValue({
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
      expect(usersServiceFindByGithubIdMock).toHaveBeenCalledWith(
        'gh-user-123',
      );
      expect(pipelineQueueUpdateMock).toHaveBeenCalledWith(
        mockQueue.id,
        expect.objectContaining({ id_user: mockUser.id }),
      );
    });

    it('does NOT set id_user when commitAuthorId is present but user is not found', async () => {
      // Arrange
      pipelineQueueCreateMock.mockResolvedValue(mockQueue);
      usersServiceFindByGithubIdMock.mockResolvedValue(null);

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'queued',
        commitAuthorId: 'unknown-github-id',
      });

      // Assert
      expect(usersServiceFindByGithubIdMock).toHaveBeenCalledWith(
        'unknown-github-id',
      );
      expect(pipelineQueueUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent — step', () => {
    it('AC-2: finds queue by commitSha+app+env, sets status=Running, creates step, emits pipeline.updated', async () => {
      // Arrange
      pipelineQueueFindByCommitMock.mockResolvedValue(mockQueue);
      pipelineQueueUpdateMock.mockResolvedValue({
        ...mockQueue,
        status: 'Running',
      });
      pipelineStepsCreateMock.mockResolvedValue(mockStep);

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'step',
        stepName: 'build',
        workflowName: 'whiz-server-ci-cd-dev-j8klp',
      });

      // Assert
      expect(pipelineQueueFindByCommitMock).toHaveBeenCalledWith(
        'abc123sha',
        'whiz-server',
        'development',
      );
      expect(pipelineQueueUpdateMock).toHaveBeenCalledWith(
        mockQueue.id,
        expect.objectContaining({ status: 'Running' }),
      );
      expect(pipelineStepsCreateMock).toHaveBeenCalled();
      expect(gatewayEmitUpdatedMock).toHaveBeenCalled();
    });

    it('does nothing if no matching pipeline_queue found for step event', async () => {
      // Arrange
      pipelineQueueFindByCommitMock.mockResolvedValue(null);

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'step',
        stepName: 'build',
        workflowName: 'workflow-name',
      });

      // Assert
      expect(pipelineQueueUpdateMock).not.toHaveBeenCalled();
      expect(pipelineStepsCreateMock).not.toHaveBeenCalled();
      expect(gatewayEmitUpdatedMock).not.toHaveBeenCalled();
    });

    it('links id_user on step event when id_user is null and commitAuthorId is present and user found', async () => {
      // Arrange
      const queueWithoutUser = { ...mockQueue, id_user: null };
      pipelineQueueFindByCommitMock.mockResolvedValue(queueWithoutUser);
      pipelineQueueUpdateMock.mockResolvedValue({
        ...queueWithoutUser,
        status: 'Running',
      });
      pipelineStepsCreateMock.mockResolvedValue(mockStep);
      usersServiceFindByGithubIdMock.mockResolvedValue(mockUser);

      // Act
      await service.handleEvent({
        ...basePayload,
        event: 'step',
        stepName: 'clone',
        workflowName: 'workflow-name',
        commitAuthorId: 'gh-user-123',
      });

      // Assert
      expect(usersServiceFindByGithubIdMock).toHaveBeenCalledWith(
        'gh-user-123',
      );
      expect(pipelineQueueUpdateMock).toHaveBeenCalledWith(
        queueWithoutUser.id,
        expect.objectContaining({ id_user: mockUser.id }),
      );
    });
  });

  describe('handleEvent — Succeeded', () => {
    it('AC-3: updates status=Completed and emits pipeline.updated', async () => {
      // Arrange
      pipelineQueueFindByCommitMock.mockResolvedValue(mockQueue);
      pipelineQueueUpdateMock.mockResolvedValue({
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
      expect(pipelineQueueUpdateMock).toHaveBeenCalledWith(
        mockQueue.id,
        expect.objectContaining({ status: 'Completed' }),
      );
      expect(gatewayEmitUpdatedMock).toHaveBeenCalled();
    });
  });

  describe('handleEvent — Error', () => {
    it('AC-4: updates status=Failed and emits pipeline.updated', async () => {
      // Arrange
      pipelineQueueFindByCommitMock.mockResolvedValue(mockQueue);
      pipelineQueueUpdateMock.mockResolvedValue({
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
      expect(pipelineQueueUpdateMock).toHaveBeenCalledWith(
        mockQueue.id,
        expect.objectContaining({ status: 'Failed' }),
      );
      expect(gatewayEmitUpdatedMock).toHaveBeenCalled();
    });
  });
});
