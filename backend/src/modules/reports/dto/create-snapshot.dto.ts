import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional } from 'class-validator';

export class CreateSnapshotDto {
  @IsIn(['summary','throughput','weekly','services_distribution','operators_performance'])
  type:
    | 'summary'
    | 'throughput'
    | 'weekly'
    | 'services_distribution'
    | 'operators_performance';

  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() serviceId?: number;
  @IsOptional() @Type(() => Number) @IsInt() operatorId?: number;
  @IsOptional() @Type(() => Number) @IsInt() ticketNumberFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() ticketNumberTo?: number;
  @IsOptional() @IsIn(['hour','day']) granularity?: 'hour'|'day';

  @IsOptional() @Type(() => Number) @IsInt() createdByUserId?: number;
}

export class ListSnapshotsQueryDto {
  @IsOptional() @IsIn(['summary','throughput','weekly','services_distribution','operators_performance'])
  type?: CreateSnapshotDto['type'];

  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() serviceId?: number;
  @IsOptional() @Type(() => Number) @IsInt() operatorId?: number;
  @IsOptional() @Type(() => Number) @IsInt() ticketNumberFrom?: number;
  @IsOptional() @Type(() => Number) @IsInt() ticketNumberTo?: number;

  @IsOptional() @Type(() => Number) @IsInt() limit?: number = 50;
  @IsOptional() @Type(() => Number) @IsInt() offset?: number = 0;
}
