import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, Environment, PipelineStatus } from '@prisma/client';
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
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;
    const skip = (page - 1) * limit;
    const direction = query.orderBy ?? 'desc';

    const where: Prisma.PipelineQueueWhereInput = {};

    if (query.dateStart || query.dateEnd) {
      where.createdAt = {
        gte: query.dateStart ? new Date(query.dateStart) : undefined,
        lte: query.dateEnd ? new Date(query.dateEnd) : undefined,
      };
    }

    if (query.status) where.status = query.status as PipelineStatus;
    if (query.app) where.app = query.app;
    if (query.environment) where.environment = query.environment as Environment;

    const orderBy: Prisma.PipelineQueueOrderByWithRelationInput = {
      createdAt: direction,
    };

    const [items, total] = await Promise.all([
      this.prisma.pipelineQueue.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { steps: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.pipelineQueue.count({ where }),
    ]);

    return {
      data: items.map((i) => this.toDto(i)),
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
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const direction = query.orderBy ?? 'desc';

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { githubId: true },
    });
    const githubId = user?.githubId ?? null;

    const where: Prisma.PipelineQueueWhereInput = {
      del: false,
      OR: [
        { id_user: userId },
        ...(githubId
          ? [{ commitAuthorId: githubId }, { commitAuthor: githubId }]
          : []),
      ],
    };

    if (query.dateStart || query.dateEnd) {
      where.createdAt = {
        gte: query.dateStart ? new Date(query.dateStart) : undefined,
        lte: query.dateEnd ? new Date(query.dateEnd) : undefined,
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.pipelineQueue.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: direction },
        include: { steps: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.pipelineQueue.count({ where }),
    ]);

    return {
      data: items.map((i) => this.toDto(i)),
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
    const item = await this.prisma.pipelineQueue.findUnique({
      where: {
        commitSha_app_environment: {
          commitSha,
          app,
          environment: environment as Environment,
        },
      },
      include: { steps: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!item) return null;
    return this.toDto(item);
  }

  async findById(id: string): Promise<PipelineQueueResponseDto> {
    const item = await this.prisma.pipelineQueue.findUnique({
      where: { id },
      include: { steps: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!item) throw new NotFoundException(`Pipeline ${id} não encontrado`);
    return this.toDto(item);
  }

  async create(dto: CreatePipelineQueueDto): Promise<PipelineQueueResponseDto> {
    const item = await this.prisma.pipelineQueue.create({
      data: {
        event: dto.event,
        app: dto.app,
        environment: dto.environment as Environment,
        commitSha: dto.commitSha,
        commitMessage: dto.commitMessage,
        commitAuthor: dto.commitAuthor,
        commitAuthorAvatar: dto.commitAuthorAvatar,
        commitAuthorId: dto.commitAuthorId ?? null,
        status: (dto.status as PipelineStatus) ?? PipelineStatus.Queued,
        id_user: dto.id_user ?? null,
      },
    });
    return this.toDto(item);
  }

  async update(
    id: string,
    dto: Partial<UpdatePipelineQueueDto> & { id_user?: string | null },
  ): Promise<PipelineQueueResponseDto> {
    const existing = await this.prisma.pipelineQueue.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Pipeline ${id} não encontrado`);

    const data: Prisma.PipelineQueueUpdateInput = {};
    if (dto.status !== undefined) data.status = dto.status as PipelineStatus;
    if (dto.del !== undefined) data.del = dto.del;
    if (dto.id_user !== undefined)
      data.user = dto.id_user
        ? { connect: { id: dto.id_user } }
        : { disconnect: true };

    const updated = await this.prisma.pipelineQueue.update({
      where: { id },
      data,
      include: { steps: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    return this.toDto(updated);
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.prisma.pipelineQueue.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException(`Pipeline ${id} não encontrado`);
    await this.prisma.pipelineQueue.update({
      where: { id },
      data: { del: true },
    });
  }

  private toDto(
    item: Record<string, unknown> & { steps?: Array<{ stepName: string }> },
  ): PipelineQueueResponseDto {
    const currentStep = item.steps?.[0]?.stepName ?? null;
    return plainToInstance(
      PipelineQueueResponseDto,
      { ...item, currentStep },
      { excludeExtraneousValues: true },
    );
  }
}
