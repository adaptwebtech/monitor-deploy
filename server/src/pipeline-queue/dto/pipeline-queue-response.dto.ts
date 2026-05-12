import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class PipelineQueueResponseDto {
  @ApiProperty({
    description: 'UUID do pipeline',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'ID do usuário associado',
    example: null,
    nullable: true,
  })
  @Expose()
  id_user: string | null;

  @ApiProperty({ description: 'Tipo do evento', example: 'queued' })
  @Expose()
  event: string;

  @ApiProperty({ description: 'Nome da aplicação', example: 'whiz-server' })
  @Expose()
  app: string;

  @ApiProperty({ description: 'Ambiente de deploy', example: 'development' })
  @Expose()
  environment: string;

  @ApiProperty({ description: 'SHA do commit', example: 'abc123sha' })
  @Expose()
  commitSha: string;

  @ApiProperty({
    description: 'Mensagem do commit',
    example: 'feat: add monitoring',
  })
  @Expose()
  commitMessage: string;

  @ApiProperty({ description: 'Autor do commit', example: 'Pedro Miranda' })
  @Expose()
  commitAuthor: string;

  @ApiProperty({
    description: 'URL do avatar do autor',
    example: 'https://github.com/pedro.png',
  })
  @Expose()
  commitAuthorAvatar: string;

  @ApiProperty({
    description: 'ID do autor no GitHub',
    example: null,
    nullable: true,
  })
  @Expose()
  commitAuthorId: string | null;

  @ApiProperty({
    description: 'Status do pipeline',
    example: 'Queued',
    enum: ['Queued', 'Running', 'Completed', 'Failed'],
  })
  @Expose()
  status: string;

  @ApiProperty({ description: 'Pipeline deletado?', example: false })
  @Expose()
  del: boolean;

  @ApiProperty({ description: 'Data de criação' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Data de atualização' })
  @Expose()
  updatedAt: Date;
}
