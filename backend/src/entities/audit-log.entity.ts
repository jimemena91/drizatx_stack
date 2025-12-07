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

import { Operator } from '../entities/operator.entity';

export type AuditLogSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AuditLogChangeValue = string | number | boolean | null;

export type AuditLogChange = {
  field: string;
  before?: AuditLogChangeValue | null;
  after?: AuditLogChangeValue | null;
};

export type AuditLogActorSnapshot = {
  id?: number | null;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  roles?: string[] | null;
  primaryRole?: string | null;
  identifier?: string | null;
};

@Entity({ name: 'audit_logs' })
@Index('idx_audit_logs_created_at', ['createdAt'])
@Index('idx_audit_logs_severity', ['severity'])
@Index('idx_audit_logs_actor', ['actorId'])
@Index('idx_audit_logs_event_type', ['eventType'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'event_type', type: 'varchar', length: 120 })
  eventType!: string;

  @Column({ type: 'varchar', length: 150 })
  action!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  target!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'low' })
  severity!: AuditLogSeverity;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId!: number | null;

  @ManyToOne(() => Operator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor?: Operator | null;

  @Column({ name: 'actor_name', type: 'varchar', length: 255, nullable: true })
  actorName!: string | null;

  @Column({ name: 'actor_role', type: 'varchar', length: 100, nullable: true })
  actorRole!: string | null;

  @Column({ name: 'actor_snapshot', type: 'json', nullable: true })
  actorSnapshot!: AuditLogActorSnapshot | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  source!: string | null;

  @Column({ type: 'json', nullable: true })
  tags!: string[] | null;

  @Column({ type: 'json', nullable: true })
  changes!: AuditLogChange[] | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt!: Date | null;
}
