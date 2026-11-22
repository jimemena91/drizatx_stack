import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Historial de alertas de "tiempo de atención excedido".
 *
 * Se guarda como registro propio (con snapshot de servicio, operador y límite)
 * porque el cierre diario cambia el estado de los tickets que quedaron abiertos
 * y los cambios de configuración (nombre de servicio, límite) no deben reescribir
 * lo que ya pasó.
 *
 * Una fila por ticket (índice único): el registrador es idempotente.
 */
@Entity('attention_alert_logs')
@Index('ux_attention_alert_logs_ticket', ['ticketId'], { unique: true })
@Index('idx_attention_alert_logs_business_date', ['businessDate', 'exceededAt'])
export class AttentionAlertLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ticket_id', type: 'int' })
  ticketId: number;

  @Column({ name: 'ticket_number', type: 'varchar', length: 20 })
  ticketNumber: string;

  @Column({ name: 'service_id', type: 'int' })
  serviceId: number;

  @Column({ name: 'service_name', type: 'varchar', length: 255 })
  serviceName: string;

  @Column({ name: 'operator_id', type: 'int', nullable: true })
  operatorId: number | null;

  @Column({ name: 'operator_name', type: 'varchar', length: 255, nullable: true })
  operatorName: string | null;

  /** Límite vigente (en minutos) cuando se registró la alerta. */
  @Column({ name: 'max_attention_minutes', type: 'int' })
  maxAttentionMinutes: number;

  @Column({ name: 'elapsed_seconds', type: 'int' })
  elapsedSeconds: number;

  @Column({ name: 'exceeded_seconds', type: 'int' })
  exceededSeconds: number;

  /** Día comercial (YYYY-MM-DD, zona del negocio) en que se superó el límite. */
  @Column({ name: 'business_date', type: 'date' })
  businessDate: string;

  /** Momento en que el ticket superó el límite. */
  @Column({ name: 'exceeded_at', type: 'datetime' })
  exceededAt: Date;

  /** Cuándo terminó la atención (null = sigue en curso). */
  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  /** Estado final del ticket (COMPLETED, DAILY_CLOSED, CANCELLED, ...). */
  @Column({ name: 'final_status', type: 'varchar', length: 30, nullable: true })
  finalStatus: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
