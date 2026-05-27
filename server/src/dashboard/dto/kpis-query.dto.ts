import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PipelineStatus } from '@prisma/client';

export class KpisQueryDto {
  @ApiProperty({
    description: 'Data inicial do período (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsString()
  @IsNotEmpty()
  dateStart: string;

  @ApiProperty({
    description: 'Data final do período (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsString()
  @IsNotEmpty()
  dateEnd: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por ambiente (development, staging ou production). Omitir para todos os ambientes.',
    example: 'production',
    enum: ['development', 'staging', 'production'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['development', 'staging', 'production'])
  environment?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por nome da aplicação. Omitir para todas as aplicações.',
    example: 'my-api',
  })
  @IsOptional()
  @IsString()
  app?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por status do pipeline (Queued, Running, Completed ou Failed). Omitir para todos os status.',
    example: 'Failed',
    enum: PipelineStatus,
  })
  @IsOptional()
  @IsIn(Object.values(PipelineStatus))
  status?: PipelineStatus;
}
