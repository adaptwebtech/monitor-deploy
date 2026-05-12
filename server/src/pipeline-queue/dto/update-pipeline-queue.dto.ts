import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePipelineQueueDto {
  @ApiPropertyOptional({
    description: 'Status do pipeline',
    example: 'Running',
    enum: ['Queued', 'Running', 'Completed', 'Failed'],
  })
  @IsOptional()
  @IsIn(['Queued', 'Running', 'Completed', 'Failed'])
  status?: string;

  @ApiPropertyOptional({ description: 'Soft delete flag', example: false })
  @IsOptional()
  @IsBoolean()
  del?: boolean;

  @ApiPropertyOptional({
    description: 'ID do usuário associado',
    example: null,
  })
  @IsOptional()
  @IsString()
  id_user?: string | null;
}
