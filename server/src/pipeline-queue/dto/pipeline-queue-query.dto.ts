import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';

export class PipelineQueueQueryDto {
  @ApiPropertyOptional({ description: 'Página', example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ description: 'Limite por página', example: '10' })
  @IsOptional()
  @IsNumberString()
  limit?: string;

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

  @ApiPropertyOptional({
    description: 'Campo de ordenação',
    example: 'createdAt',
    enum: ['createdAt', 'status'],
  })
  @IsOptional()
  @IsIn(['createdAt', 'status'])
  orderBy?: string;

  @ApiPropertyOptional({
    description: 'Direção da ordenação',
    example: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string;
}
