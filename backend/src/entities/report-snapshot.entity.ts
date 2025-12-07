import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

export type ReportType =
  | 'summary'
  | 'throughput'
  | 'weekly'
  | 'services_distribution'
  | 'operators_performance';

@Entity('report_snapshots')
@Index(['type', 'createdAt'])
@Index(['type', 'from', 'to'])
@Index(['serviceId', 'operatorId', 'createdAt'])
export class ReportSnapshot {
  @PrimaryGeneratedColumn() id: number;

  @Column({ type: 'varchar', length: 50 }) type: ReportType;

  @Column({ name: 'from', type: 'datetime', nullable: true }) from: Date | null;
  @Column({ name: 'to', type: 'datetime', nullable: true }) to: Date | null;
  @Column({ name: 'service_id', type: 'int', nullable: true }) serviceId: number | null;
  @Column({ name: 'operator_id', type: 'int', nullable: true }) operatorId: number | null;
  @Column({ name: 'granularity', type: 'varchar', length: 10, nullable: true }) granularity: 'hour'|'day'|null;

  @Column({ name: 'created_by_user_id', type: 'int', nullable: true }) createdByUserId: number | null;

  @Column({ name: 'ticket_number_from', type: 'int', nullable: true }) ticketNumberFrom: number | null;
  @Column({ name: 'ticket_number_to', type: 'int', nullable: true }) ticketNumberTo: number | null;

  @Column({ type: 'json' }) data: Record<string, any>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @Column({ name: 'calc_version', type: 'varchar', length: 20, default: 'v1' }) calcVersion: string;
}
