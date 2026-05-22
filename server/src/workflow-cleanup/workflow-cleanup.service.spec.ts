import { PipelineStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { PipelineGateway } from '../gateway/pipeline.gateway';
import { WorkflowCleanupService } from './workflow-cleanup.service';

describe('WorkflowCleanupService', () => {
  let service: WorkflowCleanupService;

  const prismaMock = {
    pipelineQueue: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const gatewayMock = {
    emitPipelineUpdated: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new WorkflowCleanupService(
      prismaMock as unknown as PrismaService,
      gatewayMock as unknown as PipelineGateway,
    );
  });

  describe('cleanupStaleWorkflows()', () => {
    it('AC-1: pipeline Running há 61 min → marca Timeout e emite pipeline.updated via gateway', async () => {
      // Arrange
      const now = new Date();
      const updatedAt61MinAgo = new Date(now.getTime() - 61 * 60 * 1000);

      const stalePipeline = {
        id: 'pipeline-stale-id',
        status: 'Running',
        createdAt: updatedAt61MinAgo,
        updatedAt: updatedAt61MinAgo,
      };

      const updatedPipeline = {
        ...stalePipeline,
        status: PipelineStatus.Timeout,
      };

      prismaMock.pipelineQueue.findMany.mockResolvedValue([stalePipeline]);
      prismaMock.pipelineQueue.update.mockResolvedValue(updatedPipeline);

      // Act
      await service.cleanupStaleWorkflows();

      // Assert
      expect(prismaMock.pipelineQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: stalePipeline.id },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({ status: PipelineStatus.Timeout }),
        }),
      );
      expect(gatewayMock.emitPipelineUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ id: stalePipeline.id }),
      );
    });

    it('AC-2: nenhum pipeline stale encontrado → nenhuma alteração', async () => {
      // Arrange — DB filtra e retorna vazio (nenhum Running com updatedAt > 1h)
      prismaMock.pipelineQueue.findMany.mockResolvedValue([]);

      // Act
      await service.cleanupStaleWorkflows();

      // Assert
      expect(prismaMock.pipelineQueue.update).not.toHaveBeenCalled();
      expect(gatewayMock.emitPipelineUpdated).not.toHaveBeenCalled();
    });

    it('AC-3: múltiplos pipelines stale → todos marcados Timeout, gateway emite para cada um', async () => {
      // Arrange
      const now = new Date();
      const updatedAt90MinAgo = new Date(now.getTime() - 90 * 60 * 1000);
      const updatedAt120MinAgo = new Date(now.getTime() - 120 * 60 * 1000);

      const pipelineA = {
        id: 'pipeline-a-id',
        status: 'Running',
        createdAt: updatedAt120MinAgo,
        updatedAt: updatedAt120MinAgo,
      };

      const pipelineB = {
        id: 'pipeline-b-id',
        status: 'Running',
        createdAt: updatedAt90MinAgo,
        updatedAt: updatedAt90MinAgo,
      };

      prismaMock.pipelineQueue.findMany.mockResolvedValue([
        pipelineA,
        pipelineB,
      ]);
      prismaMock.pipelineQueue.update
        .mockResolvedValueOnce({ ...pipelineA, status: PipelineStatus.Timeout })
        .mockResolvedValueOnce({
          ...pipelineB,
          status: PipelineStatus.Timeout,
        });

      // Act
      await service.cleanupStaleWorkflows();

      // Assert — ambos marcados Timeout
      expect(prismaMock.pipelineQueue.update).toHaveBeenCalledTimes(3);
      expect(gatewayMock.emitPipelineUpdated).toHaveBeenCalledTimes(3);
      expect(gatewayMock.emitPipelineUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ id: pipelineA.id }),
      );
      expect(gatewayMock.emitPipelineUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ id: pipelineB.id }),
      );
    });

    it('AC-4: Prisma lança erro durante update → exceção capturada e logada, não propaga', async () => {
      // Arrange
      const now = new Date();
      const updatedAt61MinAgo = new Date(now.getTime() - 61 * 60 * 1000);

      const stalePipeline = {
        id: 'pipeline-error-id',
        status: 'Running',
        createdAt: updatedAt61MinAgo,
        updatedAt: updatedAt61MinAgo,
      };

      prismaMock.pipelineQueue.findMany.mockResolvedValue([stalePipeline]);
      prismaMock.pipelineQueue.update.mockRejectedValue(
        new Error('DB connection error'),
      );

      // Act + Assert — não deve lançar exceção
      await expect(service.cleanupStaleWorkflows()).resolves.not.toThrow();

      // gateway não deve ser chamado quando update falha
      expect(gatewayMock.emitPipelineUpdated).not.toHaveBeenCalled();
    });
  });
});
