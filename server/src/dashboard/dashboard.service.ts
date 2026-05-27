import { Injectable, Logger } from '@nestjs/common';
import { PipelineStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { KpisQueryDto } from './dto/kpis-query.dto';
import { KpisResponseDto } from './dto/kpis-response.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getKpis(query: KpisQueryDto): Promise<KpisResponseDto> {
    const dateFilter = {
      createdAt: {
        gte: new Date(query.dateStart),
        lte: new Date(query.dateEnd),
      },
    };

    const extraFilters: Record<string, unknown> = {};
    if (query.environment !== undefined) {
      extraFilters.environment = query.environment;
    }
    if (query.app !== undefined) {
      extraFilters.app = query.app;
    }
    if (query.status !== undefined) {
      extraFilters.status = query.status;
    }

    const baseWhere = { ...dateFilter, ...extraFilters };

    const [total, succeeded, failed] = await Promise.all([
      this.prisma.pipelineQueue.count({ where: baseWhere }),
      this.prisma.pipelineQueue.count({
        where: { ...baseWhere, status: PipelineStatus.Completed },
      }),
      this.prisma.pipelineQueue.count({
        where: { ...baseWhere, status: PipelineStatus.Failed },
      }),
    ]);

    const errorRate =
      total > 0 ? Math.round((failed / total) * 100 * 100) / 100 : 0;

    return { total, succeeded, failed, errorRate };
  }
}
