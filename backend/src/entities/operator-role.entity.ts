import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Operator } from './operator.entity';
import { Role } from './role.entity';

@Entity({ name: 'operator_roles' })
@Unique(['operatorId', 'roleId'])
export class OperatorRole {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'operator_id', type: 'int' })
  operatorId!: number;

  @Column({ name: 'role_id', type: 'int' })
  roleId!: number;

  @ManyToOne(() => Operator, (operator) => operator.operatorRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'operator_id' })
  operator!: Operator;

  @ManyToOne(() => Role, (role) => role.operatorRoles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

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
