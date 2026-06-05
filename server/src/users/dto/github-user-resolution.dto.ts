import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GithubUserResolutionDto {
  @ApiProperty({
    description: 'Nome do usuário cadastrado',
    example: 'Pedro Miranda',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'URL da foto de perfil',
    example: 'https://cdn.example.com/photo.jpg',
  })
  profilePictureUrl: string | null;
}
