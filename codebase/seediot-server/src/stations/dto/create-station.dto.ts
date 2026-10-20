import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateStationDto {
  @ApiProperty({ example: 'Greenhouse Gateway 01' })
  @IsString()
  @MinLength(3)
  name: string;
}
