import 'reflect-metadata';
import { CronExpression } from '@nestjs/schedule';
import type { PrismaService } from '../prisma/prisma.service';

// Cron metadata key emitted by @nestjs/schedule
const SCHEDULE_CRON_OPTIONS = 'SCHEDULE_CRON_OPTIONS';

const FIXED_DATE = new Date('2026-05-22T12:00:00.000Z');
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const EXPECTED_CUTOFF = new Date(FIXED_DATE.getTime() - THIRTY_DAYS_MS);

type ServiceModule = typeof import('./scheduled-cleanup.service');
type ModuleModule = typeof import('./scheduled-cleanup.module');

function buildMockPrisma() {
  return {
    pipelineStep: { deleteMany: jest.fn() },
    pipelineQueue: { deleteMany: jest.fn() },
  };
}

function requireService(): ServiceModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./scheduled-cleanup.service') as ServiceModule;
}

function requireModule(): ModuleModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./scheduled-cleanup.module') as ModuleModule;
}

describe('ScheduledCleanupService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_DATE);
    jest.resetModules();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('hardDeleteOldRecords()', () => {
    it('AC-1: invokes prisma.pipelineStep.deleteMany with where.createdAt.lt = 30 days ago', async () => {
      const { ScheduledCleanupService } = requireService();
      const mockPrisma = buildMockPrisma();
      const service = new ScheduledCleanupService(
        mockPrisma as unknown as PrismaService,
      );

      mockPrisma.pipelineStep.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.pipelineQueue.deleteMany.mockResolvedValue({ count: 0 });

      await service.hardDeleteOldRecords();

      expect(mockPrisma.pipelineStep.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: EXPECTED_CUTOFF } },
      });
    });

    it('AC-2: prisma.pipelineStep.deleteMany is called before prisma.pipelineQueue.deleteMany', async () => {
      const { ScheduledCleanupService } = requireService();
      const mockPrisma = buildMockPrisma();
      const service = new ScheduledCleanupService(
        mockPrisma as unknown as PrismaService,
      );

      const callOrder: string[] = [];

      mockPrisma.pipelineStep.deleteMany.mockImplementation(() => {
        callOrder.push('pipelineStep');
        return Promise.resolve({ count: 1 });
      });
      mockPrisma.pipelineQueue.deleteMany.mockImplementation(() => {
        callOrder.push('pipelineQueue');
        return Promise.resolve({ count: 1 });
      });

      await service.hardDeleteOldRecords();

      expect(callOrder).toEqual(['pipelineStep', 'pipelineQueue']);
    });

    it('AC-3: invokes prisma.pipelineQueue.deleteMany with where.createdAt.lt = 30 days ago', async () => {
      const { ScheduledCleanupService } = requireService();
      const mockPrisma = buildMockPrisma();
      const service = new ScheduledCleanupService(
        mockPrisma as unknown as PrismaService,
      );

      mockPrisma.pipelineStep.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.pipelineQueue.deleteMany.mockResolvedValue({ count: 0 });

      await service.hardDeleteOldRecords();

      expect(mockPrisma.pipelineQueue.deleteMany).toHaveBeenCalledWith({
        where: { createdAt: { lt: EXPECTED_CUTOFF } },
      });
    });

    it('AC-4: Logger.log is called with a message containing both deleted counts', async () => {
      const { ScheduledCleanupService } = requireService();
      const mockPrisma = buildMockPrisma();
      const service = new ScheduledCleanupService(
        mockPrisma as unknown as PrismaService,
      );

      mockPrisma.pipelineStep.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.pipelineQueue.deleteMany.mockResolvedValue({ count: 3 });

      type LoggerLike = { log: (...args: unknown[]) => void };
      const serviceWithLogger = service as unknown as { logger: LoggerLike };
      const logSpy = jest
        .spyOn(serviceWithLogger.logger, 'log')
        .mockImplementation(() => undefined);

      await service.hardDeleteOldRecords();

      expect(logSpy).toHaveBeenCalled();
      const logMessage = logSpy.mock.calls[0][0] as string;
      expect(logMessage).toContain('5');
      expect(logMessage).toContain('3');

      logSpy.mockRestore();
    });

    it('AC-5: error thrown by prisma.pipelineStep.deleteMany does NOT propagate', async () => {
      const { ScheduledCleanupService } = requireService();
      const mockPrisma = buildMockPrisma();
      const service = new ScheduledCleanupService(
        mockPrisma as unknown as PrismaService,
      );

      mockPrisma.pipelineStep.deleteMany.mockRejectedValue(
        new Error('DB connection error'),
      );

      await expect(service.hardDeleteOldRecords()).resolves.toBeUndefined();
    });

    it('AC-7: hardDeleteOldRecords is decorated with @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)', () => {
      const { ScheduledCleanupService } = requireService();

      // @Cron attaches metadata to the method on the prototype
      const method = Object.getOwnPropertyDescriptor(
        ScheduledCleanupService.prototype,
        'hardDeleteOldRecords',
      )?.value as unknown;
      const metadata: unknown = Reflect.getMetadata(
        SCHEDULE_CRON_OPTIONS,
        method,
      );

      expect(metadata).toBeDefined();
      expect(metadata).toMatchObject({
        cronTime: CronExpression.EVERY_DAY_AT_MIDNIGHT,
      });
    });
  });

  describe('AC-6: module class exists and is decorated with @Module', () => {
    it('ScheduledCleanupModule class exists and carries @Module metadata', () => {
      const { ScheduledCleanupModule } = requireModule();

      const meta: unknown = Reflect.getMetadata(
        'imports',
        ScheduledCleanupModule,
      );

      expect(ScheduledCleanupModule).toBeDefined();
      expect(meta).not.toBeUndefined();
    });
  });
});
