import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class WebhookEventDto {
  @ApiProperty({
    description: 'Tipo do evento',
    example: 'queued',
    enum: ['queued', 'step', 'Succeeded', 'Error'],
  })
  @IsString()
  @IsIn(['queued', 'step', 'Succeeded', 'Error'])
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

  @ApiPropertyOptional({
    description: 'ID do autor no GitHub',
    example: 'gh-user-123',
  })
  @IsOptional()
  @IsString()
  commitAuthorId?: string | null;

  @ApiPropertyOptional({
    description: 'Nome do workflow Argo',
    example: 'whiz-server-ci-cd-dev-j8klp',
  })
  @IsOptional()
  @IsString()
  workflowName?: string | null;

  @ApiPropertyOptional({ description: 'Nome da etapa atual', example: 'build' })
  @IsOptional()
  @IsString()
  stepName?: string | null;
}
