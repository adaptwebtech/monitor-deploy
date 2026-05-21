import { NotFoundException } from '@nestjs/common';
import { PipelineQueueService } from './pipeline-queue.service';
import { PrismaService } from '../prisma/prisma.service';
import { PipelineQueueQueryDto } from './dto/pipeline-queue-query.dto';

type FindManyCallArg = {
  where?: Record<string, unknown>;
  skip?: number;
  take?: number;
  orderBy?: unknown;
};

type UpdateCallArg = {
  where: { id: string };
  data: Record<string, unknown>;
};

describe('PipelineQueueService', () => {
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
      pipelineQueue: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ githubId: null }),
      },
    };

    service = new PipelineQueueService(prisma as unknown as PrismaService);
  });

  function getFindManyCalls(): FindManyCallArg[] {
    return (
      prisma.pipelineQueue.findMany.mock.calls as Array<[FindManyCallArg]>
    ).map((call) => call[0]);
  }

  function getUpdateCalls(): UpdateCallArg[] {
    return (
      prisma.pipelineQueue.update.mock.calls as Array<[UpdateCallArg]>
    ).map((call) => call[0]);
  }

  describe('findAll', () => {
    it('AC-11: filters by dateStart and dateEnd on createdAt field', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipelineQueue.count.mockResolvedValue(1);

      const dateStart = '2024-01-01T00:00:00Z';
      const dateEnd = '2024-01-31T23:59:59Z';

      const dto: PipelineQueueQueryDto = { dateStart, dateEnd };

      // Act
      await service.findAll(dto);

      // Assert
      const where = getFindManyCalls()[0].where;
      expect(where?.createdAt).toBeDefined();
      expect(JSON.stringify(where?.createdAt)).toContain('2024-01-01');
      expect(JSON.stringify(where?.createdAt)).toContain('2024-01-31');
    });

    it('filters by status', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipelineQueue.count.mockResolvedValue(1);

      const dto: PipelineQueueQueryDto = { status: 'Queued' };

      // Act
      await service.findAll(dto);

      // Assert
      const where = getFindManyCalls()[0].where;
      expect(where).toMatchObject(
        expect.objectContaining({ status: 'Queued' }),
      );
    });

    it('filters by app', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipelineQueue.count.mockResolvedValue(1);

      const dto: PipelineQueueQueryDto = { app: 'whiz-server' };

      // Act
      await service.findAll(dto);

      // Assert
      const where = getFindManyCalls()[0].where;
      expect(JSON.stringify(where)).toContain('whiz-server');
    });

    it('filters by environment', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipelineQueue.count.mockResolvedValue(1);

      const dto: PipelineQueueQueryDto = { environment: 'production' };

      // Act
      await service.findAll(dto);

      // Assert
      const where = getFindManyCalls()[0].where;
      expect(JSON.stringify(where)).toContain('production');
    });

    it('paginates results using page and limit', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipelineQueue.count.mockResolvedValue(50);

      const dto: PipelineQueueQueryDto = { page: '2', limit: '5' };

      // Act
      const result = await service.findAll(dto);

      // Assert
      const callArg = getFindManyCalls()[0];
      expect(callArg.skip).toBe(5); // (page-1) * limit
      expect(callArg.take).toBe(5);
      expect(result).toMatchObject({ page: 2, limit: 5, total: 50 });
    });
  });

  describe('findMine', () => {
    it('returns only records where id_user matches the authenticated user', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([mockQueue]);
      prisma.pipelineQueue.count.mockResolvedValue(1);

      const dto: PipelineQueueQueryDto = { page: '1', limit: '10' };

      // Act
      await service.findMine('user-uuid-1', dto);

      // Assert — where clause uses OR that includes id_user arm
      const where = getFindManyCalls()[0].where as Record<string, unknown>;
      const whereStr = JSON.stringify(where);
      expect(whereStr).toContain('id_user');
      expect(whereStr).toContain('user-uuid-1');
    });
  });

  describe('findByCommit', () => {
    it('returns the pipeline_queue matching commitSha + app + environment', async () => {
      // Arrange
      prisma.pipelineQueue.findUnique.mockResolvedValue(mockQueue);

      // Act
      const result = await service.findByCommit(
        'abc123sha',
        'whiz-server',
        'development',
      );

      // Assert
      expect(result).toEqual(mockQueue);
      const [findUniqueArg] = (
        prisma.pipelineQueue.findUnique.mock.calls as Array<
          [
            {
              where: {
                commitSha_app_environment: {
                  commitSha: string;
                  app: string;
                  environment: string;
                };
              };
            },
          ]
        >
      )[0];
      expect(findUniqueArg.where.commitSha_app_environment).toEqual({
        commitSha: 'abc123sha',
        app: 'whiz-server',
        environment: 'development',
      });
    });
  });

  describe('create', () => {
    it('creates a record and returns PipelineQueueResponseDto', async () => {
      // Arrange
      prisma.pipelineQueue.create.mockResolvedValue(mockQueue);

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
      expect(prisma.pipelineQueue.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe(mockQueue.id);
    });
  });

  describe('update', () => {
    it('updates the record and returns updated PipelineQueueResponseDto', async () => {
      // Arrange
      const updatedQueue = { ...mockQueue, status: 'Running' };
      prisma.pipelineQueue.findUnique.mockResolvedValue(mockQueue);
      prisma.pipelineQueue.update.mockResolvedValue(updatedQueue);

      // Act
      const result = await service.update(mockQueue.id, {
        status: 'Running',
      });

      // Assert
      expect(prisma.pipelineQueue.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockQueue.id } }),
      );
      expect(result.status).toBe('Running');
    });
  });

  describe('softDelete', () => {
    it('sets del=true without physical deletion', async () => {
      // Arrange
      prisma.pipelineQueue.findUnique.mockResolvedValue(mockQueue);
      prisma.pipelineQueue.update.mockResolvedValue({
        ...mockQueue,
        del: true,
      });

      // Act
      await service.softDelete(mockQueue.id);

      // Assert
      const updateArg = getUpdateCalls()[0];
      expect(updateArg.data).toMatchObject({ del: true });
    });

    it('throws NotFoundException when record does not exist', async () => {
      // Arrange
      prisma.pipelineQueue.findUnique.mockResolvedValue(null);

      // Act
      const promise = service.softDelete('non-existent-id');

      // Assert
      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
