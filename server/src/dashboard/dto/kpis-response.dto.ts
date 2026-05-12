import { ApiProperty } from '@nestjs/swagger';

export class KpisResponseDto {
  @ApiProperty({ description: 'Total de pipelines no período', example: 10 })
  total: number;

  @ApiProperty({ description: 'Total de pipelines com sucesso', example: 7 })
  succeeded: number;

  @ApiProperty({ description: 'Total de pipelines com falha', example: 2 })
  failed: number;

  @ApiProperty({
    description: 'Taxa de erro em porcentagem (0-100, 2 casas decimais)',
    example: 20.0,
  })
  errorRate: number;
}
