import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OperatorService } from './operator-service.entity';
import { OperatorRole } from './operator-role.entity';
import { Role as RoleEntity } from './role.entity';
import { OperatorShift } from './operator-shift.entity';
import { OperatorAvailability } from './operator-availability.entity';
import { Service } from './service.entity';
import { resolveHighestRole } from '../common/utils/role.utils';

@Entity({ name: 'operators' })
export class Operator {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 150, nullable: true, unique: true })
  email!: string | null;

   @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  position!: string | null;

  @Column({ type: 'tinyint', width: 1, default: () => '1' })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt!: Date;

  @OneToMany(() => OperatorService, (link) => link.operator)
  serviceLinks!: OperatorService[];

  @ManyToMany(() => Service, (service) => service.operators, { cascade: false })
  @JoinTable({
    name: 'operator_services',
    joinColumn: { name: 'operator_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'service_id', referencedColumnName: 'id' },
  })
  services!: Service[];

  @OneToMany(() => OperatorRole, (link) => link.operator, { cascade: ['insert', 'update'] })
  operatorRoles!: OperatorRole[];

  @OneToMany(() => OperatorShift, (shift) => shift.operator)
  shifts!: OperatorShift[];

  @OneToMany(() => OperatorAvailability, (availability) => availability.operator)
  availabilities!: OperatorAvailability[];

  get roles(): RoleEntity[] {
    return (this.operatorRoles?.map((link) => link.role).filter(Boolean) as RoleEntity[]) ?? [];
  }

  get role(): string | null {
    return resolveHighestRole(this.roles.map((role) => role.slug)) ?? null;
  }
}

