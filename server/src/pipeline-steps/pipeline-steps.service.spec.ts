import { NotFoundException } from '@nestjs/common';
import { PipelineStepsService } from './pipeline-steps.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PipelineStepsService', () => {
  let service: PipelineStepsService;
  let prisma: {
    pipeline_steps: {
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
      pipeline_steps: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    service = new PipelineStepsService(prisma as unknown as PrismaService);
  });

  describe('findAllByQueue', () => {
    it('without page/limit returns { data, total } with NO page/limit fields', async () => {
      // Arrange
      prisma.pipeline_steps.findMany.mockResolvedValue([
        mockStep,
        { ...mockStep, id: 'step-uuid-2', stepName: 'deploy' },
      ]);
      prisma.pipeline_steps.count.mockResolvedValue(2);

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
      prisma.pipeline_steps.findMany.mockResolvedValue([mockStep]);
      prisma.pipeline_steps.count.mockResolvedValue(5);

      // Act
      const result = await service.findAllByQueue('queue-uuid-1', {
        page: 1,
        limit: 1,
      } as any);

      // Assert
      expect(result).toMatchObject({
        data: expect.any(Array),
        total: 5,
        page: 1,
        limit: 1,
      });
    });

    it('applies pagination when page and limit are provided', async () => {
      // Arrange
      prisma.pipeline_steps.findMany.mockResolvedValue([mockStep]);
      prisma.pipeline_steps.count.mockResolvedValue(10);

      // Act
      await service.findAllByQueue('queue-uuid-1', {
        page: 2,
        limit: 5,
      } as any);

      // Assert
      const findCall = prisma.pipeline_steps.findMany.mock.calls[0][0];
      expect(findCall.skip).toBe(5); // (2-1) * 5
      expect(findCall.take).toBe(5);
    });
  });

  describe('create', () => {
    it('creates a step and returns PipelineStepResponseDto', async () => {
      // Arrange
      prisma.pipeline_steps.create.mockResolvedValue(mockStep);

      const dto = {
        id_pipeline_queue: 'queue-uuid-1',
        event: 'step',
        workflowName: 'whiz-server-ci-cd-dev-j8klp',
        stepName: 'build',
      };

      // Act
      const result = await service.create(dto);

      // Assert
      expect(prisma.pipeline_steps.create).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.id).toBe(mockStep.id);
    });
  });

  describe('findById', () => {
    it('throws NotFoundException when step does not exist', async () => {
      // Arrange
      prisma.pipeline_steps.findUnique.mockResolvedValue(null);

      // Act
      const promise = service.findById('non-existent-id');

      // Assert
      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns PipelineStepResponseDto when step exists', async () => {
      // Arrange
      prisma.pipeline_steps.findUnique.mockResolvedValue(mockStep);

      // Act
      const result = await service.findById(mockStep.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(mockStep.id);
    });
  });
});
