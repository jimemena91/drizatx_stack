import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Operator } from './operator.entity';

export type OperatorAvailabilityState = 'ACTIVE' | 'BREAK' | 'OFF';

@Entity({ name: 'operator_availabilities' })
@Index(['operatorId'], { unique: true })
export class OperatorAvailability {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'operator_id', type: 'int' })
  operatorId!: number;

  @ManyToOne(() => Operator, (operator) => operator.availabilities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'operator_id' })
  operator!: Operator;

  @Column({ name: 'state', type: 'varchar', length: 20 })
  state!: OperatorAvailabilityState;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt!: Date;
}
