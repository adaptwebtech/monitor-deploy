import { NotFoundException } from '@nestjs/common';
import { PipelineStepsService } from './pipeline-steps.service';
import { PrismaService } from '../prisma/prisma.service';

type FindManyCallArg = {
  where?: Record<string, unknown>;
  skip?: number;
  take?: number;
};

describe('PipelineStepsService', () => {
  let service: PipelineStepsService;
  let prisma: {
    pipelineStep: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };

  const mockStep = {
    id: 'step-uuid-1',
    id_pipeline_queue: 'queue-uuid-1',
    event: 'step',
    workflowName: 'whiz-server-ci-cd-dev-j8klp',
    stepName: 'build',
    del: false,
    createdAt: new Date(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    prisma = {
      pipelineStep: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new PipelineStepsService(prisma as unknown as PrismaService);
  });

  function getFindManyCalls(): FindManyCallArg[] {
    return (
      prisma.pipelineStep.findMany.mock.calls as Array<[FindManyCallArg]>
    ).map((call) => call[0]);
  }

  describe('findAllByQueue', () => {
    it('without page/limit returns { data, total } with NO page/limit fields', async () => {
      // Arrange
      prisma.pipelineStep.findMany.mockResolvedValue([
        mockStep,
        { ...mockStep, id: 'step-uuid-2', stepName: 'deploy' },
      ]);
      prisma.pipelineStep.count.mockResolvedValue(2);

      // Act
      const result = await service.findAllByQueue('queue-uuid-1', {});

      // Assert
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).not.toHaveProperty('page');
      expect(result).not.toHaveProperty('limit');
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('with page and limit returns { data, total, page, limit }', async () => {
      // Arrange
      prisma.pipelineStep.findMany.mockResolvedValue([mockStep]);
      prisma.pipelineStep.count.mockResolvedValue(5);

      // Act
      const result = await service.findAllByQueue('queue-uuid-1', {
        page: '1',
        limit: '1',
      });

      // Assert
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(1);
    });

    it('applies pagination when page and limit are provided', async () => {
      // Arrange
      prisma.pipelineStep.findMany.mockResolvedValue([mockStep]);
      prisma.pipelineStep.count.mockResolvedValue(10);

      // Act
      await service.findAllByQueue('queue-uuid-1', {
        page: '2',
        limit: '5',
      });

      // Assert
      const callArg = getFindManyCalls()[0];
      expect(callArg.skip).toBe(5); // (2-1) * 5
      expect(callArg.take).toBe(5);
    });
  });

  describe('create', () => {
    it('creates a step and returns PipelineStepResponseDto', async () => {
      // Arrange
      prisma.pipelineStep.create.mockResolvedValue(mockStep);

      const dto = {
        id_pipeline_queue: 'queue-uuid-1',
        event: 'step',
        workflowName: 'whiz-server-ci-cd-dev-j8klp',
        stepName: 'build',
      };

      // Act
      const result = await service.create(dto);

      // Assert
      expect(prisma.pipelineStep.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe(mockStep.id);
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when step does not exist', async () => {
      // Arrange
      prisma.pipelineStep.findUnique.mockResolvedValue(null);

      // Act
      const promise = service.findById('non-existent-id');

      // Assert
      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns PipelineStepResponseDto when step exists', async () => {
      // Arrange
      prisma.pipelineStep.findUnique.mockResolvedValue(mockStep);

      // Act
      const result = await service.findById(mockStep.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockStep.id);
    });
  });
});
