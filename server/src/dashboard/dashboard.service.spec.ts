import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    pipeline_queue: {
      count: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();

    prisma = {
      pipeline_queue: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new DashboardService(prisma as unknown as PrismaService);
  });

  describe('getKpis', () => {
    it('returns correct KPIs with errorRate rounded to 2 decimal places', async () => {
      // Arrange
      // total=5, succeeded=3, failed=1 → errorRate = (1/5)*100 = 20.00
      prisma.pipeline_queue.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(3) // succeeded (Completed)
        .mockResolvedValueOnce(1); // failed (Failed)

      // Act
      const result = await service.getKpis({
        dateStart: '2024-01-01T00:00:00Z',
        dateEnd: '2024-01-31T23:59:59Z',
      });

      // Assert
      expect(result).toEqual({
        total: 5,
        succeeded: 3,
        failed: 1,
        errorRate: 20.0,
      });
    });

    it('returns errorRate=0 when total is 0 (no division by zero)', async () => {
      // Arrange
      prisma.pipeline_queue.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0) // succeeded
        .mockResolvedValueOnce(0); // failed

      // Act
      const result = await service.getKpis({
        dateStart: '2024-01-01T00:00:00Z',
        dateEnd: '2024-01-31T23:59:59Z',
      });

      // Assert
      expect(result).toEqual({
        total: 0,
        succeeded: 0,
        failed: 0,
        errorRate: 0,
      });
    });

    it('rounds errorRate to exactly 2 decimal places', async () => {
      // Arrange
      // total=3, failed=1 → (1/3)*100 = 33.333... → rounded to 33.33
      prisma.pipeline_queue.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(2) // succeeded
        .mockResolvedValueOnce(1); // failed

      // Act
      const result = await service.getKpis({
        dateStart: '2024-01-01T00:00:00Z',
        dateEnd: '2024-01-31T23:59:59Z',
      });

      // Assert
      expect(result.errorRate).toBe(33.33);
    });

    it('filters counts by dateStart/dateEnd on createdAt', async () => {
      // Arrange
      prisma.pipeline_queue.count.mockResolvedValue(0);

      const dateStart = '2024-01-01T00:00:00Z';
      const dateEnd = '2024-01-31T23:59:59Z';

      // Act
      await service.getKpis({ dateStart, dateEnd });

      // Assert
      const allCalls = prisma.pipeline_queue.count.mock.calls;
      allCalls.forEach((call) => {
        const where = call[0]?.where;
        expect(JSON.stringify(where)).toContain('2024-01-01');
        expect(JSON.stringify(where)).toContain('2024-01-31');
      });
    });
  });
});
