import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePipelineQueueDto } from './dto/create-pipeline-queue.dto';
import { UpdatePipelineQueueDto } from './dto/update-pipeline-queue.dto';
import { PipelineQueueQueryDto } from './dto/pipeline-queue-query.dto';
import { PipelineQueueResponseDto } from './dto/pipeline-queue-response.dto';

@Injectable()
export class PipelineQueueService {
  private readonly logger = new Logger(PipelineQueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PipelineQueueQueryDto): Promise<{
    data: PipelineQueueResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = parseInt(query.page ?? '1', 10);
    const limit = parseInt(query.limit ?? '10', 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.dateStart || query.dateEnd) {
      where.createdAt = {};
      if (query.dateStart)
        (where.createdAt as any).gte = new Date(query.dateStart);
      if (query.dateEnd) (where.createdAt as any).lte = new Date(query.dateEnd);
    }

    if (query.status) where.status = query.status;
    if (query.app) where.app = query.app;
    if (query.environment) where.environment = query.environment;

    const orderBy: Record<string, string> = {};
    if (query.orderBy) orderBy[query.orderBy] = query.order ?? 'desc';
    else orderBy.createdAt = 'desc';

    const [items, total] = await Promise.all([
      this.prisma.pipeline_queue.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.pipeline_queue.count({ where }),
    ]);

    return {
      data: items.map((i) =>
        plainToInstance(PipelineQueueResponseDto, i, {
          excludeExtraneousValues: true,
        }),
      ),
      total,
      page,
      limit,
    };
  }

  async findMine(
    userId: string,
    query: PipelineQueueQueryDto,
  ): Promise<{
    data: PipelineQueueResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = parseInt(query.page ?? '1', 10);
    const limit = parseInt(query.limit ?? '10', 10);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { id_user: userId };

    if (query.dateStart || query.dateEnd) {
      where.createdAt = {};
      if (query.dateStart)
        (where.createdAt as any).gte = new Date(query.dateStart);
      if (query.dateEnd) (where.createdAt as any).lte = new Date(query.dateEnd);
    }

    const [items, total] = await Promise.all([
      this.prisma.pipeline_queue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pipeline_queue.count({ where }),
    ]);

    return {
      data: items.map((i) =>
        plainToInstance(PipelineQueueResponseDto, i, {
          excludeExtraneousValues: true,
        }),
      ),
      total,
      page,
      limit,
    };
  }

  async findByCommit(
    commitSha: string,
    app: string,
    environment: string,
  ): Promise<PipelineQueueResponseDto | null> {
    const item = await this.prisma.pipeline_queue.findUnique({
      where: { commitSha_app_environment: { commitSha, app, environment } },
    });
    if (!item) return null;
    return plainToInstance(PipelineQueueResponseDto, item, {
      excludeExtraneousValues: true,
    });
  }

  async findById(id: string): Promise<PipelineQueueResponseDto> {
    const item = await this.prisma.pipeline_queue.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Pipeline ${id} não encontrado`);
    return plainToInstance(PipelineQueueResponseDto, item, {
      excludeExtraneousValues: true,
    });
  }

  async create(dto: CreatePipelineQueueDto): Promise<PipelineQueueResponseDto> {
    const item = await this.prisma.pipeline_queue.create({
      data: {
        event: dto.event,
        app: dto.app,
        environment: dto.environment as any,
        commitSha: dto.commitSha,
        commitMessage: dto.commitMessage,
        commitAuthor: dto.commitAuthor,
        commitAuthorAvatar: dto.commitAuthorAvatar,
        commitAuthorId: dto.commitAuthorId ?? null,
        status: (dto.status as any) ?? 'Queued',
        id_user: dto.id_user ?? null,
      },
    });
    return plainToInstance(PipelineQueueResponseDto, item, {
      excludeExtraneousValues: true,
    });
  }

  async update(
    id: string,
    dto: Partial<UpdatePipelineQueueDto> & { id_user?: string | null },
  ): Promise<PipelineQueueResponseDto> {
    const existing = await this.prisma.pipeline_queue.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Pipeline ${id} não encontrado`);

    const data: Record<string, unknown> = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.del !== undefined) data.del = dto.del;
    if (dto.id_user !== undefined) data.id_user = dto.id_user;

    const updated = await this.prisma.pipeline_queue.update({
      where: { id },
      data,
    });
    return plainToInstance(PipelineQueueResponseDto, updated, {
      excludeExtraneousValues: true,
    });
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.prisma.pipeline_queue.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Pipeline ${id} não encontrado`);
    await this.prisma.pipeline_queue.update({
      where: { id },
      data: { del: true },
    });
  }
}
