import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PipelineGateway } from '../gateway/pipeline.gateway';
import { PipelineStatus } from '@prisma/client';

@Injectable()
export class WorkflowCleanupService {
  private readonly logger = new Logger(WorkflowCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PipelineGateway,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async cleanupStaleWorkflows(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const stale = await this.prisma.pipelineQueue.findMany({
        where: {
          status: PipelineStatus.Running,
          del: false,
          updatedAt: { lt: oneHourAgo },
        },
      });

      for (const pipeline of stale) {
        const updated = await this.prisma.pipelineQueue.update({
          where: { id: pipeline.id },
          data: { status: PipelineStatus.Timeout },
          include: { steps: true },
        });
        this.gateway.emitPipelineUpdated(updated);
        this.logger.log(`Pipeline ${pipeline.id} marcado como Timeout`);
      }
    } catch (err) {
      this.logger.error('Erro ao executar limpeza de workflows', err);
    }
  }
}
