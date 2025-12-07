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

@Entity({ name: 'operator_shifts' })
@Index(['operatorId', 'startedAt'])
export class OperatorShift {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'operator_id', type: 'int' })
  operatorId!: number;

  @ManyToOne(() => Operator, (operator) => operator.shifts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'operator_id' })
  operator!: Operator;

  @Column({
    name: 'started_at',
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  startedAt!: Date;

  @Column({
    name: 'ended_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  endedAt!: Date | null;

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
