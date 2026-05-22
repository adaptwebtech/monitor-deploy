import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScheduledCleanupService {
  private readonly logger = new Logger(ScheduledCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async hardDeleteOldRecords(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const steps = await this.prisma.pipelineStep.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      const queues = await this.prisma.pipelineQueue.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      this.logger.log(
        `Cleanup: ${steps.count} steps deletados, ${queues.count} queues deletadas`,
      );
    } catch (error) {
      this.logger.error('Erro durante hard delete de registros antigos', error);
    }
  }
}
