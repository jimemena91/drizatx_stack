import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

export class ReportsQueryDto {
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;

  @IsOptional() @Type(() => Number) @IsInt() serviceId?: number;
  @IsOptional() @Type(() => Number) @IsInt() operatorId?: number;

  @IsOptional() @Type(() => Number) @IsInt() ticketNumberFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() ticketNumberTo?: number;

  @IsOptional() @IsIn(['hour','day']) granularity: 'hour'|'day' = 'day';

  // opcional (por defecto AR para reportes)
  @IsOptional() @IsIn(['UTC','America/Argentina/Mendoza'])
  tz?: 'UTC' | 'America/Argentina/Mendoza' = 'America/Argentina/Mendoza';

  // 👇 importante: que sean opcionales
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number = 0;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) limit?: number = 100;
}
