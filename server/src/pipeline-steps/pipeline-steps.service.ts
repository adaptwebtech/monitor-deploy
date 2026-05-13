import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePipelineStepDto } from './dto/create-pipeline-step.dto';
import { PipelineStepResponseDto } from './dto/pipeline-step-response.dto';
import { PipelineStepsQueryDto } from './dto/pipeline-steps-query.dto';

@Injectable()
export class PipelineStepsService {
  private readonly logger = new Logger(PipelineStepsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAllByQueue(
    pipelineQueueId: string,
    query: Pick<PipelineStepsQueryDto, 'page' | 'limit'>,
  ): Promise<{
    data: PipelineStepResponseDto[];
    total: number;
    page?: number;
    limit?: number;
  }> {
    const hasPagination = query.page !== undefined && query.limit !== undefined;
    const page = hasPagination ? parseInt(query.page as string, 10) : undefined;
    const limit = hasPagination
      ? parseInt(query.limit as string, 10)
      : undefined;

    const where = { id_pipeline_queue: pipelineQueueId };

    const [items, total] = await Promise.all([
      this.prisma.pipelineStep.findMany({
        where,
        ...(hasPagination ? { skip: (page! - 1) * limit!, take: limit } : {}),
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.pipelineStep.count({ where }),
    ]);

    const data = items.map((i) =>
      plainToInstance(PipelineStepResponseDto, i, {
        excludeExtraneousValues: true,
      }),
    );

    if (hasPagination) {
      return { data, total, page: page!, limit: limit! };
    }

    return { data, total };
  }

  async findById(id: string): Promise<PipelineStepResponseDto> {
    const item = await this.prisma.pipelineStep.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Step ${id} não encontrado`);
    return plainToInstance(PipelineStepResponseDto, item, {
      excludeExtraneousValues: true,
    });
  }

  async create(dto: CreatePipelineStepDto): Promise<PipelineStepResponseDto> {
    const item = await this.prisma.pipelineStep.create({
      data: {
        id_pipeline_queue: dto.id_pipeline_queue,
        event: dto.event,
        workflowName: dto.workflowName,
        stepName: dto.stepName,
      },
    });
    return plainToInstance(PipelineStepResponseDto, item, {
      excludeExtraneousValues: true,
    });
  }
}
