import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class PipelineStepsQueryDto {
  @ApiProperty({
    description: 'UUID do pipeline para filtrar as etapas',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  })
  @IsString()
  pipelineQueueId: string;

  @ApiPropertyOptional({ description: 'Página', example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ description: 'Limite por página', example: '10' })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}
