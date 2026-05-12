import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshDto {
  @ApiProperty({
    description: 'Token de atualização (refresh token)',
    example: 'eyJhbGciOiJIUzI1NiJ9...',
  })
  @IsString()
  refreshToken: string;
}
