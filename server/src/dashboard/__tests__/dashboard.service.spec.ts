import { DashboardService } from '../dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PipelineStatus } from '@prisma/client';

// dashboard-filters: unit tests for DashboardService
// These tests are RED until DashboardQueryDto gains app/environment/status fields
// and DashboardService.getKpis uses them in the where clause.

describe('DashboardService — dashboard-filters', () => {
  let service: DashboardService;
  let prisma: {
    pipelineQueue: {
      count: jest.Mock;
    };
  };

  const DATE_START = '2024-01-01T00:00:00Z';
  const DATE_END = '2024-12-31T23:59:59Z';

  beforeEach(() => {
    jest.resetAllMocks();

    prisma = {
      pipelineQueue: {
        count: jest.fn(),
      },
    };

    service = new DashboardService(prisma as unknown as PrismaService);
  });

  describe('AC-1: filter by environment', () => {
    it('AC-1: passes environment filter to all prisma.pipelineQueue.count calls when environment=production', async () => {
      prisma.pipelineQueue.count.mockResolvedValue(3);

      await service.getKpis({
        dateStart: DATE_START,
        dateEnd: DATE_END,
        environment: 'production',
      });

      const allCalls = prisma.pipelineQueue.count.mock.calls as Array<
        [{ where?: Record<string, unknown> }]
      >;

      expect(allCalls.length).toBeGreaterThan(0);
      allCalls.forEach((call) => {
        expect(call[0]?.where).toMatchObject({ environment: 'production' });
      });
    });
  });

  describe('AC-2: filter by app', () => {
    it('AC-2: passes app filter to all prisma.pipelineQueue.count calls when app=my-api', async () => {
      prisma.pipelineQueue.count.mockResolvedValue(5);

      await service.getKpis({
        dateStart: DATE_START,
        dateEnd: DATE_END,
        app: 'my-api',
      });

      const allCalls = prisma.pipelineQueue.count.mock.calls as Array<
        [{ where?: Record<string, unknown> }]
      >;

      expect(allCalls.length).toBeGreaterThan(0);
      allCalls.forEach((call) => {
        expect(call[0]?.where).toMatchObject({ app: 'my-api' });
      });
    });
  });

  describe('AC-3: filter by status=Failed', () => {
    it('AC-3: when status=Failed, total count uses status=Failed filter, succeeded=0 and errorRate=100', async () => {
      // When filtering by status=Failed:
      //   total count query  → uses status: Failed → returns 4
      //   succeeded count    → status Completed AND status Failed → 0 (impossible intersection)
      //   failed count       → 4
      prisma.pipelineQueue.count
        .mockResolvedValueOnce(4) // total (filtered by Failed)
        .mockResolvedValueOnce(0) // succeeded (Completed ∩ Failed = 0)
        .mockResolvedValueOnce(4); // failed

      const result = await service.getKpis({
        dateStart: DATE_START,
        dateEnd: DATE_END,
        status: PipelineStatus.Failed,
      });

      // total count must be called with status: Failed in where
      const totalCall = prisma.pipelineQueue.count.mock.calls[0] as [
        { where?: Record<string, unknown> },
      ];
      expect(totalCall[0]?.where).toMatchObject({
        status: PipelineStatus.Failed,
      });

      expect(result.total).toBe(4);
      expect(result.succeeded).toBe(0);
      expect(result.errorRate).toBe(100);
    });
  });

  describe('AC-4: retrocompatibility — no new params', () => {
    it('AC-4: without app/environment/status, where clause contains only dateFilter (no extra keys)', async () => {
      prisma.pipelineQueue.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(2);

      await service.getKpis({
        dateStart: DATE_START,
        dateEnd: DATE_END,
      });

      // total count (first call) should NOT contain app/environment/status
      const totalCallWhere = (
        prisma.pipelineQueue.count.mock.calls[0] as [
          { where?: Record<string, unknown> },
        ]
      )[0]?.where;

      expect(totalCallWhere).not.toHaveProperty('app');
      expect(totalCallWhere).not.toHaveProperty('environment');
      // status is allowed on the succeeded/failed sub-queries, but NOT on the total
      expect(totalCallWhere).not.toHaveProperty('status');
    });
  });
});
