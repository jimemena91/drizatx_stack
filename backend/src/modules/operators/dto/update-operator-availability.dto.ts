import { IsIn, IsString } from 'class-validator';
import { OperatorAvailabilityState } from '../../..//entities/operator-availability.entity';

export class UpdateOperatorAvailabilityDto {
  @IsString()
  @IsIn(['ACTIVE', 'BREAK', 'OFF'])
  status!: OperatorAvailabilityState;
}
