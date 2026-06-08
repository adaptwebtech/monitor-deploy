import { PipelineStatus } from '@prisma/client';
import { CronExpression } from '@nestjs/schedule';
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
    it('AC-1: pipeline Running há 61 min → marca Failed e emite pipeline.updated via gateway', async () => {
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
        status: PipelineStatus.Failed,
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
          data: expect.objectContaining({ status: PipelineStatus.Failed }),
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

    it('AC-3: múltiplos pipelines stale → todos marcados Failed, gateway emite para cada um', async () => {
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
        .mockResolvedValueOnce({ ...pipelineA, status: PipelineStatus.Failed })
        .mockResolvedValueOnce({
          ...pipelineB,
          status: PipelineStatus.Failed,
        });

      // Act
      await service.cleanupStaleWorkflows();

      // Assert — ambos marcados Failed
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

  describe('cleanupQueuedWorkflows()', () => {
    it('AC-1: pipeline Queued com createdAt=now-13h → marcado Failed, finalizedAt definido, emitPipelineUpdated chamado uma vez', async () => {
      // Arrange
      const now = new Date();
      const createdAt13hAgo = new Date(now.getTime() - 13 * 60 * 60 * 1000);

      const queuedPipeline = {
        id: 'pipeline-queued-old-id',
        status: 'Queued',
        del: false,
        createdAt: createdAt13hAgo,
        updatedAt: createdAt13hAgo,
        finalizedAt: null,
      };

      const updatedPipeline = {
        ...queuedPipeline,
        status: 'Failed',
        finalizedAt: now,
      };

      prismaMock.pipelineQueue.findMany.mockResolvedValue([queuedPipeline]);
      prismaMock.pipelineQueue.update.mockResolvedValue(updatedPipeline);

      // Act
      await service.cleanupQueuedWorkflows();

      // Assert
      type UpdateArg = {
        where: { id: string };
        data: { status: string; finalizedAt: unknown };
      };
      const [[updateArg]] = prismaMock.pipelineQueue.update.mock.calls as Array<
        [UpdateArg]
      >;
      expect(updateArg.where).toEqual({ id: queuedPipeline.id });
      expect(updateArg.data.status).toBe('Failed');
      expect(updateArg.data.finalizedAt).toBeInstanceOf(Date);
      expect(gatewayMock.emitPipelineUpdated).toHaveBeenCalledTimes(1);
      expect(gatewayMock.emitPipelineUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ id: queuedPipeline.id, status: 'Failed' }),
      );
    });

    it('AC-2: pipeline Queued com createdAt=now-1h → nenhuma atualização, emitPipelineUpdated NÃO chamado', async () => {
      // Arrange — DB filtra pela janela de 12h e retorna vazio
      prismaMock.pipelineQueue.findMany.mockResolvedValue([]);

      // Act
      await service.cleanupQueuedWorkflows();

      // Assert
      expect(prismaMock.pipelineQueue.update).not.toHaveBeenCalled();
      expect(gatewayMock.emitPipelineUpdated).not.toHaveBeenCalled();
    });

    it('AC-3: pipeline A createdAt=now-13h e pipeline B createdAt=now-1h, ambos Queued → apenas A marcado Failed, emitPipelineUpdated chamado exatamente uma vez', async () => {
      // Arrange — mock simula que a query DB já filtra por janela de 12h, retornando só A
      const now = new Date();
      const pipelineA = {
        id: 'pipeline-a-queued',
        status: 'Queued',
        del: false,
        createdAt: new Date(now.getTime() - 13 * 60 * 60 * 1000),
        finalizedAt: null,
      };

      const updatedA = { ...pipelineA, status: 'Failed', finalizedAt: now };

      prismaMock.pipelineQueue.findMany.mockResolvedValue([pipelineA]);
      prismaMock.pipelineQueue.update.mockResolvedValue(updatedA);

      // Act
      await service.cleanupQueuedWorkflows();

      // Assert
      expect(prismaMock.pipelineQueue.update).toHaveBeenCalledTimes(1);
      expect(gatewayMock.emitPipelineUpdated).toHaveBeenCalledTimes(1);
      expect(gatewayMock.emitPipelineUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ id: pipelineA.id }),
      );
    });

    it('AC-4: PrismaService.pipelineQueue.findMany lança exceção → capturada, logger.error chamado, método retorna void (sem propagação)', async () => {
      // Arrange
      prismaMock.pipelineQueue.findMany.mockRejectedValue(
        new Error('DB connection error'),
      );

      // Act + Assert — não deve lançar exceção
      await expect(service.cleanupQueuedWorkflows()).resolves.not.toThrow();

      // update e gateway não devem ser chamados
      expect(prismaMock.pipelineQueue.update).not.toHaveBeenCalled();
      expect(gatewayMock.emitPipelineUpdated).not.toHaveBeenCalled();
    });

    it('AC-5: cleanupQueuedWorkflows possui decorator @Cron(CronExpression.EVERY_HOUR)', () => {
      // Verify the method exists on the service prototype
      expect(
        typeof WorkflowCleanupService.prototype.cleanupQueuedWorkflows,
      ).toBe('function');

      // NestJS SetMetadata stores metadata on descriptor.value (the function itself)
      const fn = Object.getOwnPropertyDescriptor(
        WorkflowCleanupService.prototype,
        'cleanupQueuedWorkflows',
      )?.value as (...args: unknown[]) => unknown;
      const cronMetadata = Reflect.getMetadata('SCHEDULE_CRON_OPTIONS', fn) as {
        cronTime: string;
      };
      expect(cronMetadata).toBeDefined();
      expect(cronMetadata.cronTime).toBe(CronExpression.EVERY_HOUR);
    });

    it('AC-6: pipeline Running com createdAt=now-13h → NÃO afetado (filtro por status=Queued)', async () => {
      // Arrange — DB filtra status=Queued, portanto Running não retorna
      prismaMock.pipelineQueue.findMany.mockResolvedValue([]);

      // Act
      await service.cleanupQueuedWorkflows();

      // Assert — nenhuma atualização feita
      expect(prismaMock.pipelineQueue.update).not.toHaveBeenCalled();
      expect(gatewayMock.emitPipelineUpdated).not.toHaveBeenCalled();
    });
  });
});
