import { Injectable, Logger } from '@nestjs/common';
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

    const [total, succeeded, failed] = await Promise.all([
      this.prisma.pipeline_queue.count({ where: dateFilter }),
      this.prisma.pipeline_queue.count({
        where: { ...dateFilter, status: 'Completed' as any },
      }),
      this.prisma.pipeline_queue.count({
        where: { ...dateFilter, status: 'Failed' as any },
      }),
    ]);

    const errorRate =
      total > 0 ? Math.round((failed / total) * 100 * 100) / 100 : 0;

    return { total, succeeded, failed, errorRate };
  }
}
