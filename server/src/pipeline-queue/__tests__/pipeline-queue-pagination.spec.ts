import { PipelineQueueService } from '../pipeline-queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PipelineQueueQueryDto } from '../dto/pipeline-queue-query.dto';

type FindManyCallArg = {
  where?: Record<string, unknown>;
  skip?: number;
  take?: number;
  orderBy?: unknown;
};

describe('PipelineQueueService — paginação (AC-1..5)', () => {
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

  const makePipeline = (overrides: Record<string, unknown> = {}) => ({
    id: 'pipe-1',
    event: 'push',
    app: 'whiz-server',
    environment: 'development',
    commitSha: 'abc123',
    commitMessage: 'feat: pagination',
    commitAuthor: 'Pedro',
    commitAuthorAvatar: 'https://github.com/pedro.png',
    commitAuthorId: null,
    status: 'Completed',
    id_user: 'user-uuid-1',
    del: false,
    createdAt: new Date('2025-01-01T10:00:00Z'),
    updatedAt: new Date('2025-01-01T10:00:00Z'),
    steps: [],
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
          .mockResolvedValue({ id: 'user-uuid-1', githubId: null }),
      },
    };

    service = new PipelineQueueService(prisma as unknown as PrismaService);
  });

  function getFindManyCalls(): FindManyCallArg[] {
    return (
      prisma.pipelineQueue.findMany.mock.calls as Array<[FindManyCallArg]>
    ).map((call) => call[0]);
  }

  // AC-1: GET /pipeline-queue?page=1&limit=100&orderBy=desc retorna PaginatedResponse
  describe('AC-1: findAll com page=1, limit=100, orderBy=desc', () => {
    it('retorna { data, total, page, limit } com no máximo 100 itens ordenados por createdAt desc', async () => {
      // Arrange
      const items = Array.from({ length: 100 }, (_, i) =>
        makePipeline({ id: `pipe-${i}` }),
      );
      prisma.pipelineQueue.findMany.mockResolvedValue(items);
      prisma.pipelineQueue.count.mockResolvedValue(342);

      const query: PipelineQueueQueryDto = {
        page: 1,
        limit: 100,
        orderBy: 'desc',
      };

      // Act
      const result = await service.findAll(query);

      // Assert — shape
      expect(result).toMatchObject({ total: 342, page: 1, limit: 100 });
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(100);

      // Assert — orderBy passed to Prisma
      const callArg = getFindManyCalls()[0];
      expect(callArg.orderBy).toMatchObject({ createdAt: 'desc' });
      expect(callArg.skip).toBe(0);
      expect(callArg.take).toBe(100);
    });
  });

  // AC-2: página 2 deve conter segundo lote sem sobreposição
  describe('AC-2: findAll página 2 retorna segundo lote', () => {
    it('skip = (page-1)*limit = 100 quando page=2, limit=100', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([makePipeline()]);
      prisma.pipelineQueue.count.mockResolvedValue(342);

      const query: PipelineQueueQueryDto = {
        page: 2,
        limit: 100,
        orderBy: 'desc',
      };

      // Act
      const result = await service.findAll(query);

      // Assert — skip correto
      const callArg = getFindManyCalls()[0];
      expect(callArg.skip).toBe(100);
      expect(callArg.take).toBe(100);
      expect(result.page).toBe(2);
    });
  });

  // AC-3: findMine com page=1, limit=10 retorna no máximo 10 itens do próprio usuário
  describe('AC-3: findMine page=1, limit=10 retorna itens do usuário', () => {
    it('retorna PaginatedResponse com no máximo 10 itens', async () => {
      // Arrange
      const items = Array.from({ length: 10 }, (_, i) =>
        makePipeline({ id: `pipe-mine-${i}`, id_user: 'user-uuid-1' }),
      );
      prisma.pipelineQueue.findMany.mockResolvedValue(items);
      prisma.pipelineQueue.count.mockResolvedValue(87);

      const query: PipelineQueueQueryDto = {
        page: 1,
        limit: 10,
        orderBy: 'desc',
      };

      // Act
      const result = await service.findMine('user-uuid-1', query);

      // Assert
      expect(result).toMatchObject({ total: 87, page: 1, limit: 10 });
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(10);

      const callArg = getFindManyCalls()[0];
      expect(callArg.skip).toBe(0);
      expect(callArg.take).toBe(10);
    });
  });

  // AC-4: findMine com limit=100, page=2, orderBy=asc
  describe('AC-4: findMine page=2, limit=100, orderBy=asc', () => {
    it('skip = 100, orderBy = { createdAt: asc }', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([makePipeline()]);
      prisma.pipelineQueue.count.mockResolvedValue(250);

      const query: PipelineQueueQueryDto = {
        page: 2,
        limit: 100,
        orderBy: 'asc',
      };

      // Act
      const result = await service.findMine('user-uuid-1', query);

      // Assert
      const callArg = getFindManyCalls()[0];
      expect(callArg.skip).toBe(100);
      expect(callArg.take).toBe(100);
      expect(callArg.orderBy).toMatchObject({ createdAt: 'asc' });
      expect(result.page).toBe(2);
    });
  });

  // AC-5: orderBy defaults to 'desc' when not provided
  describe('AC-5: orderBy padrão é desc quando não informado', () => {
    it('findAll sem orderBy usa createdAt desc', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([makePipeline()]);
      prisma.pipelineQueue.count.mockResolvedValue(1);

      const query: PipelineQueueQueryDto = {};

      // Act
      await service.findAll(query);

      // Assert
      const callArg = getFindManyCalls()[0];
      expect(callArg.orderBy).toMatchObject({ createdAt: 'desc' });
    });

    it('findMine sem orderBy usa createdAt desc', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([makePipeline()]);
      prisma.pipelineQueue.count.mockResolvedValue(1);

      const query: PipelineQueueQueryDto = {};

      // Act
      await service.findMine('user-uuid-1', query);

      // Assert
      const callArg = getFindManyCalls()[0];
      expect(callArg.orderBy).toMatchObject({ createdAt: 'desc' });
    });
  });

  // Shape completo da resposta paginada
  describe('Shape da resposta paginada', () => {
    it('findAll retorna objeto com data, total, page, limit', async () => {
      // Arrange
      prisma.pipelineQueue.findMany.mockResolvedValue([makePipeline()]);
      prisma.pipelineQueue.count.mockResolvedValue(5);

      const query: PipelineQueueQueryDto = { page: 1, limit: 10 };

      // Act
      const result = await service.findAll(query);

      // Assert
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });
});
