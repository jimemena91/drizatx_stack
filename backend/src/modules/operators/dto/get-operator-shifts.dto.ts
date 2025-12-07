import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetOperatorShiftsDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'all'])
  period?: 'day' | 'week' | 'month' | 'all';

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
