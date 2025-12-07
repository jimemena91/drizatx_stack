import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Status } from '../../../common/enums/status.enum';

const PERIOD_OPTIONS = ['day', 'week', 'month', 'year', 'all'] as const;

type PeriodOption = (typeof PERIOD_OPTIONS)[number];

export class GetOperatorAttentionMetricsDto {
  @IsOptional()
  @IsIn(PERIOD_OPTIONS)
  period?: PeriodOption;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return undefined;
  })
  @IsArray()
  @IsIn(Object.values(Status), { each: true })
  statuses?: Status[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  serviceId?: number;
}

export type AttentionMetricsPeriod = PeriodOption | 'custom';
