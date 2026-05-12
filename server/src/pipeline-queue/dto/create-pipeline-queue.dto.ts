import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreatePipelineQueueDto {
  @ApiProperty({ description: 'Tipo do evento', example: 'queued' })
  @IsString()
  event: string;

  @ApiProperty({ description: 'Nome da aplicação', example: 'whiz-server' })
  @IsString()
  app: string;

  @ApiProperty({
    description: 'Ambiente de deploy',
    example: 'development',
    enum: ['development', 'staging', 'production'],
  })
  @IsIn(['development', 'staging', 'production'])
  environment: string;

  @ApiProperty({ description: 'SHA do commit', example: 'abc123sha' })
  @IsString()
  commitSha: string;

  @ApiProperty({
    description: 'Mensagem do commit',
    example: 'feat: add monitoring',
  })
  @IsString()
  commitMessage: string;

  @ApiProperty({ description: 'Autor do commit', example: 'Pedro Miranda' })
  @IsString()
  commitAuthor: string;

  @ApiProperty({
    description: 'URL do avatar do autor',
    example: 'https://github.com/pedro.png',
  })
  @IsString()
  commitAuthorAvatar: string;

  @ApiPropertyOptional({ description: 'ID do autor no GitHub', example: null })
  @IsOptional()
  @IsString()
  commitAuthorId?: string | null;

  @ApiPropertyOptional({ description: 'Status inicial', example: 'Queued' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'ID do usuário associado',
    example: null,
  })
  @IsOptional()
  @IsString()
  id_user?: string | null;
}
