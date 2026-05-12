import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'Pedro Miranda',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'E-mail do usuário',
    example: 'pedro@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Senha do usuário (mínimo 8 caracteres)',
    example: 'senha12345',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    description: 'URL da foto de perfil',
    example: 'https://avatars.githubusercontent.com/u/12345',
  })
  @IsOptional()
  @IsUrl()
  profilePictureUrl?: string;

  @ApiPropertyOptional({
    description: 'ID do GitHub do usuário',
    example: 'gh-user-123',
  })
  @IsOptional()
  @IsString()
  githubId?: string;

  @ApiPropertyOptional({ description: 'Usuário é root?', example: false })
  @IsOptional()
  @IsBoolean()
  root?: boolean;
}
