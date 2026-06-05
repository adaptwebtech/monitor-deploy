/**
 * Unit tests for WorkflowCleanupService — finalizedAt timestamp behaviour
 * Feature: pipeline-queue-timestamps
 * ACs covered: AC-6, AC-7
 */
import { PipelineStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import type { PipelineGateway } from '../../gateway/pipeline.gateway';
import { WorkflowCleanupService } from '../workflow-cleanup.service';

describe('WorkflowCleanupService — timestamps (pipeline-queue-timestamps)', () => {
  let service: WorkflowCleanupService;

  const prismaMock = {
    pipelineQueue: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const gatewayMock = {
    emitPipelineUpdated: jest.fn(),
  };

  const now = new Date();
  const updatedAt70MinAgo = new Date(now.getTime() - 70 * 60 * 1000);

  const stalePipelineNoFinalizedAt = {
    id: 'stale-pipeline-no-finalized',
    status: 'Running',
    finalizedAt: null,
    startedAt: new Date(now.getTime() - 75 * 60 * 1000),
    createdAt: updatedAt70MinAgo,
    updatedAt: updatedAt70MinAgo,
  };

  const stalePipelineWithFinalizedAt = {
    id: 'stale-pipeline-with-finalized',
    status: 'Running',
    finalizedAt: new Date('2025-01-01T08:00:00Z'),
    startedAt: new Date('2025-01-01T07:00:00Z'),
    createdAt: updatedAt70MinAgo,
    updatedAt: updatedAt70MinAgo,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new WorkflowCleanupService(
      prismaMock as unknown as PrismaService,
      gatewayMock as unknown as PipelineGateway,
    );
  });

  describe('cleanupStaleWorkflows() — finalizedAt timestamps', () => {
    it('AC-6: sets finalizedAt = now() on expired Running pipelines that have finalizedAt = null', async () => {
      // Arrange — stale pipeline with finalizedAt = null
      prismaMock.pipelineQueue.findMany.mockResolvedValue([
        stalePipelineNoFinalizedAt,
      ]);
      prismaMock.pipelineQueue.update.mockResolvedValue({
        ...stalePipelineNoFinalizedAt,
        status: PipelineStatus.Failed,
        finalizedAt: new Date(),
      });

      const beforeCall = new Date();

      // Act
      await service.cleanupStaleWorkflows();

      const afterCall = new Date();

      // Assert — update must include finalizedAt as a Date
      expect(prismaMock.pipelineQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: stalePipelineNoFinalizedAt.id },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: expect.objectContaining({
            status: PipelineStatus.Failed,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            finalizedAt: expect.any(Date),
          }),
        }),
      );

      // Verify the finalizedAt value is within the test window
      type UpdateCallArgs = [{ where: unknown; data: Record<string, unknown> }];
      const updateCall: UpdateCallArgs | undefined = (
        prismaMock.pipelineQueue.update.mock.calls as UpdateCallArgs[]
      ).find(([args]) => args.data['finalizedAt'] instanceof Date);
      expect(updateCall).toBeDefined();
      const callArgs: { data: Record<string, unknown> } = updateCall![0];
      const finalizedAt = callArgs.data['finalizedAt'] as Date;
      expect(finalizedAt.getTime()).toBeGreaterThanOrEqual(
        beforeCall.getTime(),
      );
      expect(finalizedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('AC-7: does NOT overwrite finalizedAt when it is already set (WHERE finalizedAt IS NULL filter)', async () => {
      // Arrange — the findMany query must filter out pipelines with finalizedAt already set.
      // Simulate DB correctly filtering: returns only pipelines where finalizedAt IS NULL.
      // The pipeline with an existing finalizedAt must NOT be updated.
      prismaMock.pipelineQueue.findMany.mockImplementation(
        ({ where }: { where?: Record<string, unknown> }) => {
          // Simulate DB honouring a finalizedAt: null WHERE clause
          if (
            where &&
            'finalizedAt' in where &&
            where['finalizedAt'] === null
          ) {
            // Only return pipelines without finalizedAt
            return Promise.resolve([stalePipelineNoFinalizedAt]);
          }
          // If no finalizedAt filter is applied, return both (implementation bug scenario)
          return Promise.resolve([
            stalePipelineNoFinalizedAt,
            stalePipelineWithFinalizedAt,
          ]);
        },
      );
      prismaMock.pipelineQueue.update.mockResolvedValue({
        ...stalePipelineNoFinalizedAt,
        status: PipelineStatus.Failed,
        finalizedAt: new Date(),
      });

      // Act
      await service.cleanupStaleWorkflows();

      // Assert — update must NOT be called for the pipeline that already has finalizedAt set
      const allUpdateCalls = prismaMock.pipelineQueue.update.mock
        .calls as Array<
        [{ where: { id: string }; data: Record<string, unknown> }]
      >;
      const updatedIds = allUpdateCalls.map(([args]) => args.where.id);
      expect(updatedIds).not.toContain(stalePipelineWithFinalizedAt.id);
    });

    it('AC-7 (query filter): findMany query includes finalizedAt: null condition to skip already-finalized pipelines', async () => {
      // Arrange
      prismaMock.pipelineQueue.findMany.mockResolvedValue([]);

      // Act
      await service.cleanupStaleWorkflows();

      // Assert — at least one findMany call must filter by finalizedAt: null
      const findManyCalls = prismaMock.pipelineQueue.findMany.mock
        .calls as Array<[{ where?: Record<string, unknown> }]>;
      const hasFinalizedAtNullFilter = findManyCalls.some(([args]) => {
        const whereStr = JSON.stringify(args.where ?? {});
        return whereStr.includes('finalizedAt') && whereStr.includes('null');
      });
      expect(hasFinalizedAtNullFilter).toBe(true);
    });
  });
});
