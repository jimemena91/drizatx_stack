// src/entities/operator-service.entity.ts
import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Operator } from './operator.entity';
import { Service } from './service.entity';

@Entity({ name: 'operator_services' })
export class OperatorService {
  @PrimaryColumn({ name: 'operator_id', type: 'int' })
  operatorId!: number; // Operator.id (no unsigned)

  @PrimaryColumn({ name: 'service_id', type: 'int', unsigned: true })
  serviceId!: number; // Service.id (unsigned en tu entidad)

  @Column({ type: 'tinyint', width: 1, default: () => '1' })
  active!: boolean;

  @Column({ type: 'int', default: 1 })
  weight!: number;

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

  @ManyToOne(() => Operator, (op) => op.serviceLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operator_id' })
  operator!: Operator;

  @ManyToOne(() => Service, (sv) => sv.operatorLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service!: Service;
}
