// ticket.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { Operator } from './operator.entity';
import { Service } from './service.entity';
import { Client } from './client.entity';
// ⬇️ ajustá la ruta si tu enum vive en otra carpeta
import { Status } from '../common/enums/status.enum';

@Entity('tickets')
@Index(['operatorId', 'status'])
@Index('idx_tickets_queue_v1', ['serviceId', 'status', 'requeuedAt', 'createdAt'])
@Index('idx_tickets_status_priority_created', ['status', 'priorityLevel', 'createdAt'])
@Index('ux_tickets_service_date_number', ['serviceId', 'issuedForDate', 'number'], { unique: true })
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'number', type: 'varchar', length: 20 })
  number: string;

  // FKs “raw”
  @Column({ name: 'service_id', type: 'int', nullable: false })
  serviceId: number;

  @ManyToOne(() => Service, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'issued_for_date', type: 'date' })
  issuedForDate: Date;

  @Column({ name: 'operator_id', type: 'int', nullable: true })
  operatorId?: number | null;

  @ManyToOne(() => Operator, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'operator_id' })
  operator?: Operator | null;

  @Column({ name: 'client_id', type: 'int', nullable: true })
  clientId?: number | null;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'client_id' })
  client?: Client | null;

  // ⬇️ ahora usa el enum compartido (incluye ABSENT)
  @Column({
    type: 'enum',
    enum: Status,
    default: Status.WAITING,
  })
  status: Status;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'called_at', type: 'timestamp', nullable: true })
  calledAt?: Date | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'attention_duration', type: 'int', nullable: true })
  attentionDuration?: number | null;

  // ⬇️ trazabilidad ausente/reencolado
  @Column({ name: 'absent_at', type: 'timestamp', nullable: true })
  absentAt?: Date | null;

  @Column({ name: 'requeued_at', type: 'timestamp', nullable: true })
  requeuedAt?: Date | null;

  @Column({ name: 'priority_level', type: 'tinyint', default: 1 })
  priorityLevel: number;

  /**
   * @deprecated Mantener solo para compatibilidad de lectura/escritura.
   *             Usar {@link priorityLevel} como fuente de verdad.
   */
  get priority(): number {
    return this.priorityLevel;
  }

  set priority(value: number) {
    this.priorityLevel = value;
  }

  @Column({ name: 'estimated_wait_time', type: 'int', nullable: true })
  estimatedWaitTime?: number | null;

  @Column({ name: 'actual_wait_time', type: 'int', nullable: true })
  actualWaitTime?: number | null;

  @Column({ name: 'mobile_phone', type: 'varchar', length: 20, nullable: true })
  mobilePhone?: string | null;

  // MySQL mapea boolean a tinyint(1). Mantenemos bool en TS.
  @Column({ name: 'notification_sent', type: 'tinyint', width: 1, default: 0 })
  notificationSent: boolean;

  @Column({ name: 'qr_scanned_at', type: 'timestamp', nullable: true })
  qrScannedAt?: Date | null;
}
