/**
 * Integration tests for PipelineQueueService — startedAt/finalizedAt in response DTOs
 * Feature: pipeline-queue-timestamps
 * ACs covered: AC-8, AC-9
 */
import { PipelineQueueService } from '../pipeline-queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PipelineQueueQueryDto } from '../dto/pipeline-queue-query.dto';

describe('PipelineQueueService — timestamps in response DTOs (pipeline-queue-timestamps)', () => {
  let service: PipelineQueueService;
  let prisma: {
    pipelineQueue: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };

  const startedAt = new Date('2025-06-01T10:05:00Z');
  const finalizedAt = new Date('2025-06-01T10:15:00Z');

  const makePipelineWithTimestamps = (
    overrides: Record<string, unknown> = {},
  ) => ({
    id: 'pipe-ts-1',
    event: 'push',
    app: 'whiz-server',
    environment: 'development',
    commitSha: 'tsabc123',
    commitMessage: 'feat: timestamps',
    commitAuthor: 'Pedro',
    commitAuthorAvatar: 'https://github.com/pedro.png',
    commitAuthorId: null,
    status: 'Completed',
    id_user: 'user-uuid-ts',
    del: false,
    createdAt: new Date('2025-06-01T10:00:00Z'),
    updatedAt: new Date('2025-06-01T10:15:00Z'),
    startedAt,
    finalizedAt,
    steps: [],
    ...overrides,
  });

  const makePipelineNullTimestamps = (
    overrides: Record<string, unknown> = {},
  ) => ({
    ...makePipelineWithTimestamps(),
    startedAt: null,
    finalizedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    jest.resetAllMocks();

    prisma = {
      pipelineQueue: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'user-uuid-ts', githubId: null }),
      },
    };

    service = new PipelineQueueService(prisma as unknown as PrismaService);
  });

  describe('AC-8: findAll response includes startedAt and finalizedAt per item', () => {
    it('includes startedAt and finalizedAt when both are set', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([
        makePipelineWithTimestamps(),
      ]);
      prisma.pipelineQueue.count.mockResolvedValue(1);

      const query: PipelineQueueQueryDto = { page: 1, limit: 10 };

      // Act
      const result = await service.findAll(query);

      // Assert — each DTO must expose startedAt and finalizedAt
      expect(result.data.length).toBe(1);
      const item = result.data[0] as Record<string, unknown>;
      expect(item).toHaveProperty('startedAt');
      expect(item).toHaveProperty('finalizedAt');
      expect(item['startedAt']).toEqual(startedAt);
      expect(item['finalizedAt']).toEqual(finalizedAt);
    });

    it('includes startedAt = null and finalizedAt = null when fields are not set (historical record)', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([
        makePipelineNullTimestamps(),
      ]);
      prisma.pipelineQueue.count.mockResolvedValue(1);

      const query: PipelineQueueQueryDto = { page: 1, limit: 10 };

      // Act
      const result = await service.findAll(query);

      // Assert — fields must be present and null
      const item = result.data[0] as Record<string, unknown>;
      expect(item).toHaveProperty('startedAt');
      expect(item).toHaveProperty('finalizedAt');
      expect(item['startedAt']).toBeNull();
      expect(item['finalizedAt']).toBeNull();
    });

    it('includes startedAt and finalizedAt on every item in a multi-item response', async () => {
      // Arrange
      const items = [
        makePipelineWithTimestamps({ id: 'pipe-ts-1' }),
        makePipelineWithTimestamps({
          id: 'pipe-ts-2',
          startedAt: null,
          finalizedAt: null,
        }),
        makePipelineWithTimestamps({ id: 'pipe-ts-3' }),
      ];
      prisma.pipelineQueue.findMany.mockResolvedValue(items);
      prisma.pipelineQueue.count.mockResolvedValue(3);

      const query: PipelineQueueQueryDto = { page: 1, limit: 10 };

      // Act
      const result = await service.findAll(query);

      // Assert — all 3 items must have both fields
      expect(result.data.length).toBe(3);
      result.data.forEach((item) => {
        const dto = item as Record<string, unknown>;
        expect(dto).toHaveProperty('startedAt');
        expect(dto).toHaveProperty('finalizedAt');
      });
    });
  });

  describe('AC-9: findMine response includes startedAt and finalizedAt per item', () => {
    it('includes startedAt and finalizedAt when both are set', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([
        makePipelineWithTimestamps(),
      ]);
      prisma.pipelineQueue.count.mockResolvedValue(1);

      const query: PipelineQueueQueryDto = { page: 1, limit: 10 };

      // Act
      const result = await service.findMine('user-uuid-ts', query);

      // Assert
      expect(result.data.length).toBe(1);
      const item = result.data[0] as Record<string, unknown>;
      expect(item).toHaveProperty('startedAt');
      expect(item).toHaveProperty('finalizedAt');
      expect(item['startedAt']).toEqual(startedAt);
      expect(item['finalizedAt']).toEqual(finalizedAt);
    });

    it('includes startedAt = null and finalizedAt = null when fields are not set', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([
        makePipelineNullTimestamps(),
      ]);
      prisma.pipelineQueue.count.mockResolvedValue(1);

      const query: PipelineQueueQueryDto = { page: 1, limit: 10 };

      // Act
      const result = await service.findMine('user-uuid-ts', query);

      // Assert
      const item = result.data[0] as Record<string, unknown>;
      expect(item).toHaveProperty('startedAt');
      expect(item).toHaveProperty('finalizedAt');
      expect(item['startedAt']).toBeNull();
      expect(item['finalizedAt']).toBeNull();
    });

    it('includes startedAt and finalizedAt on every item in a paginated response', async () => {
      // Arrange
      const items = Array.from({ length: 5 }, (_, i) =>
        makePipelineWithTimestamps({ id: `pipe-mine-ts-${i}` }),
      );
      prisma.pipelineQueue.findMany.mockResolvedValue(items);
      prisma.pipelineQueue.count.mockResolvedValue(5);

      const query: PipelineQueueQueryDto = { page: 1, limit: 10 };

      // Act
      const result = await service.findMine('user-uuid-ts', query);

      // Assert — all items expose both timestamp fields
      expect(result.data.length).toBe(5);
      result.data.forEach((item) => {
        const dto = item as Record<string, unknown>;
        expect(dto).toHaveProperty('startedAt');
        expect(dto).toHaveProperty('finalizedAt');
      });
    });
  });
});
