import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class UserResponseInAuthDto {
  @ApiProperty({
    description: 'UUID do usuário',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'Pedro Miranda',
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: 'E-mail do usuário',
    example: 'pedro@example.com',
  })
  @Expose()
  email: string;

  @ApiProperty({ description: 'Usuário é root?', example: false })
  @Expose()
  root: boolean;

  @ApiProperty({ description: 'Usuário está deletado?', example: false })
  @Expose()
  del: boolean;

  @ApiProperty({ description: 'ID do GitHub', example: null, nullable: true })
  @Expose()
  githubId: string | null;

  @ApiProperty({
    description: 'URL da foto de perfil',
    example: null,
    nullable: true,
  })
  @Expose()
  profilePictureUrl: string | null;

  @ApiProperty({ description: 'Data de criação' })
  @Expose()
  createdAt: Date;

  @ApiProperty({ description: 'Data de atualização' })
  @Expose()
  updatedAt: Date;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'Access token JWT (15 minutos)',
    example: 'eyJhbGciOiJIUzI1NiJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh token JWT (sem expiração)',
    example: 'eyJhbGciOiJIUzI1NiJ9...',
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Dados do usuário autenticado',
    type: UserResponseInAuthDto,
  })
  user: UserResponseInAuthDto;
}
