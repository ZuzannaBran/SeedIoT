import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsObject, IsOptional } from 'class-validator';

export class StationReportDto {
  @ApiProperty({
    example: {
      temperature: 21.5,
      humidity: 48,
      battery: 91,
    },
  })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({ example: '2026-04-06T10:15:00.000Z' })
  @IsOptional()
  @IsISO8601()
  recordedAt?: string;
}
