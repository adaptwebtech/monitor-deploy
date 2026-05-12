import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNumberString, IsOptional, IsString } from 'class-validator';

export class UserQueryDto {
  @ApiPropertyOptional({ description: 'Página da listagem', example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ description: 'Limite por página', example: '10' })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({
    description: 'Busca textual por nome, email ou githubId',
    example: 'pedro',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filtro de usuários deletados (all/true/false)',
    example: 'false',
  })
  @IsOptional()
  @IsIn(['all', 'true', 'false'])
  del?: string;
}
