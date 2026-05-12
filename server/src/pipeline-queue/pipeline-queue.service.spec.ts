import { NotFoundException } from '@nestjs/common';
import { PipelineQueueService } from './pipeline-queue.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PipelineQueueService', () => {
  let service: PipelineQueueService;
  let prisma: {
    pipeline_queue: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
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
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    prisma = {
      pipeline_queue: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new PipelineQueueService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('AC-11: filters by dateStart and dateEnd on createdAt field', async () => {
      // Arrange
      prisma.pipeline_queue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipeline_queue.count.mockResolvedValue(1);

      const dateStart = '2024-01-01T00:00:00Z';
      const dateEnd = '2024-01-31T23:59:59Z';

      // Act
      await service.findAll({ dateStart, dateEnd, page: 1, limit: 10 } as any);

      // Assert
      const where = prisma.pipeline_queue.findMany.mock.calls[0][0].where;
      expect(where.createdAt).toBeDefined();
      expect(JSON.stringify(where.createdAt)).toContain('2024-01-01');
      expect(JSON.stringify(where.createdAt)).toContain('2024-01-31');
    });

    it('filters by status', async () => {
      // Arrange
      prisma.pipeline_queue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipeline_queue.count.mockResolvedValue(1);

      // Act
      await service.findAll({ status: 'Queued', page: 1, limit: 10 } as any);

      // Assert
      const where = prisma.pipeline_queue.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject(
        expect.objectContaining({ status: 'Queued' }),
      );
    });

    it('filters by app', async () => {
      // Arrange
      prisma.pipeline_queue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipeline_queue.count.mockResolvedValue(1);

      // Act
      await service.findAll({ app: 'whiz-server', page: 1, limit: 10 } as any);

      // Assert
      const where = prisma.pipeline_queue.findMany.mock.calls[0][0].where;
      expect(JSON.stringify(where)).toContain('whiz-server');
    });

    it('filters by environment', async () => {
      // Arrange
      prisma.pipeline_queue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipeline_queue.count.mockResolvedValue(1);

      // Act
      await service.findAll({
        environment: 'production',
        page: 1,
        limit: 10,
      } as any);

      // Assert
      const where = prisma.pipeline_queue.findMany.mock.calls[0][0].where;
      expect(JSON.stringify(where)).toContain('production');
    });

    it('paginates results using page and limit', async () => {
      // Arrange
      prisma.pipeline_queue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipeline_queue.count.mockResolvedValue(50);

      // Act
      const result = await service.findAll({ page: 2, limit: 5 } as any);

      // Assert
      const findCall = prisma.pipeline_queue.findMany.mock.calls[0][0];
      expect(findCall.skip).toBe(5); // (page-1) * limit
      expect(findCall.take).toBe(5);
      expect(result).toMatchObject({ page: 2, limit: 5, total: 50 });
    });
  });

  describe('findMine', () => {
    it('returns only records where id_user matches the authenticated user', async () => {
      // Arrange
      prisma.pipeline_queue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipeline_queue.count.mockResolvedValue(1);

      // Act
      await service.findMine('user-uuid-1', { page: 1, limit: 10 } as any);

      // Assert
      const where = prisma.pipeline_queue.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject(
        expect.objectContaining({ id_user: 'user-uuid-1' }),
      );
    });
  });

  describe('findByCommit', () => {
    it('returns the pipeline_queue matching commitSha + app + environment', async () => {
      // Arrange
      prisma.pipeline_queue.findUnique.mockResolvedValue(mockQueue);

      // Act
      const result = await service.findByCommit(
        'abc123sha',
        'whiz-server',
        'development',
      );

      // Assert
      expect(result).toEqual(mockQueue);
      expect(prisma.pipeline_queue.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            commitSha_app_environment: {
              commitSha: 'abc123sha',
              app: 'whiz-server',
              environment: 'development',
            },
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('creates a record and returns PipelineQueueResponseDto', async () => {
      // Arrange
      prisma.pipeline_queue.create.mockResolvedValue(mockQueue);

      const dto = {
        event: 'queued',
        app: 'whiz-server',
        environment: 'development',
        commitSha: 'abc123sha',
        commitMessage: 'feat: add monitoring',
        commitAuthor: 'Pedro Miranda',
        commitAuthorAvatar: 'https://github.com/pedro.png',
        status: 'Queued',
      };

      // Act
      const result = await service.create(dto);

      // Assert
      expect(prisma.pipeline_queue.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe(mockQueue.id);
    });
  });

  describe('update', () => {
    it('updates the record and returns updated PipelineQueueResponseDto', async () => {
      // Arrange
      const updatedQueue = { ...mockQueue, status: 'Running' };
      prisma.pipeline_queue.findUnique.mockResolvedValue(mockQueue);
      prisma.pipeline_queue.update.mockResolvedValue(updatedQueue);

      // Act
      const result = await service.update(mockQueue.id, {
        status: 'Running',
      });

      // Assert
      expect(prisma.pipeline_queue.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockQueue.id } }),
      );
      expect(result.status).toBe('Running');
    });
  });

  describe('softDelete', () => {
    it('sets del=true without physical deletion', async () => {
      // Arrange
      prisma.pipeline_queue.findUnique.mockResolvedValue(mockQueue);
      prisma.pipeline_queue.update.mockResolvedValue({
        ...mockQueue,
        del: true,
      });

      // Act
      await service.softDelete(mockQueue.id);

      // Assert
      const updateCall = prisma.pipeline_queue.update.mock.calls[0][0];
      expect(updateCall.data).toMatchObject({ del: true });
    });

    it('throws NotFoundException when record does not exist', async () => {
      // Arrange
      prisma.pipeline_queue.findUnique.mockResolvedValue(null);

      // Act
      const promise = service.softDelete('non-existent-id');

      // Assert
      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
