import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PipelineQueueQueryDto {
  @ApiPropertyOptional({ description: 'Número da página', example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Limite por página', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Direção da ordenação por createdAt',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  orderBy?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Data inicial do filtro (ISO)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsString()
  dateStart?: string;

  @ApiPropertyOptional({
    description: 'Data final do filtro (ISO)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsString()
  dateEnd?: string;

  @ApiPropertyOptional({
    description: 'Filtro por status',
    example: 'Queued',
    enum: ['Queued', 'Running', 'Completed', 'Failed'],
  })
  @IsOptional()
  @IsIn(['Queued', 'Running', 'Completed', 'Failed'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filtro por aplicação',
    example: 'whiz-server',
  })
  @IsOptional()
  @IsString()
  app?: string;

  @ApiPropertyOptional({
    description: 'Filtro por ambiente',
    example: 'development',
    enum: ['development', 'staging', 'production'],
  })
  @IsOptional()
  @IsIn(['development', 'staging', 'production'])
  environment?: string;
}
