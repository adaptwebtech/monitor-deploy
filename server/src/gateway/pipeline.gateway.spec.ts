import { Server } from 'socket.io';
import { PipelineGateway } from './pipeline.gateway';

describe('PipelineGateway', () => {
  let gateway: PipelineGateway;
  let mockServer: { emit: jest.Mock };

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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockServer = { emit: jest.fn() };

    gateway = new PipelineGateway();
    // Inject mock socket server
    gateway.server = mockServer as unknown as Server;
  });

  describe('emitPipelineCreated', () => {
    it('AC-1: broadcasts "pipeline.created" event with PipelineQueueResponseDto payload', () => {
      // Act
      gateway.emitPipelineCreated(mockQueue);

      // Assert
      expect(mockServer.emit).toHaveBeenCalledWith(
        'pipeline.created',
        mockQueue,
      );
    });

    it('broadcasts to all connected clients (server-level emit)', () => {
      // Act
      gateway.emitPipelineCreated(mockQueue);

      // Assert
      expect(mockServer.emit).toHaveBeenCalledTimes(1);
      const [eventName] = mockServer.emit.mock.calls[0] as [
        string,
        ...unknown[],
      ];
      expect(eventName).toBe('pipeline.created');
    });
  });

  describe('emitPipelineUpdated', () => {
    it('AC-2/3/4: broadcasts "pipeline.updated" event with PipelineQueueResponseDto payload', () => {
      // Arrange
      const updatedQueue = { ...mockQueue, status: 'Running' };

      // Act
      gateway.emitPipelineUpdated(updatedQueue);

      // Assert
      expect(mockServer.emit).toHaveBeenCalledWith(
        'pipeline.updated',
        updatedQueue,
      );
    });

    it('broadcasts to all connected clients (server-level emit)', () => {
      // Arrange
      const updatedQueue = { ...mockQueue, status: 'Completed' };

      // Act
      gateway.emitPipelineUpdated(updatedQueue);

      // Assert
      expect(mockServer.emit).toHaveBeenCalledTimes(1);
      const [eventName] = mockServer.emit.mock.calls[0] as [
        string,
        ...unknown[],
      ];
      expect(eventName).toBe('pipeline.updated');
    });
  });
});
