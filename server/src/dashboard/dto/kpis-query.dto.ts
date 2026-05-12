import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class KpisQueryDto {
  @ApiProperty({
    description: 'Data inicial do período (ISO 8601)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsString()
  @IsNotEmpty()
  dateStart: string;

  @ApiProperty({
    description: 'Data final do período (ISO 8601)',
    example: '2024-12-31T23:59:59Z',
  })
  @IsString()
  @IsNotEmpty()
  dateEnd: string;
}
