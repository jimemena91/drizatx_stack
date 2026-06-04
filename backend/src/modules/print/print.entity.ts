import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export type PrintJobStatus = 'pending' | 'processing' | 'printed' | 'failed'

@Entity('print_jobs')
@Index('IDX_print_jobs_status_created_at', ['status', 'createdAt'])
@Index('IDX_print_jobs_ticket_id', ['ticketId'])
@Index('IDX_print_jobs_service_id', ['serviceId'])
@Index('IDX_print_jobs_source_reference', ['sourceReference'])
export class PrintJob {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  @Column({ type: 'varchar', length: 50, default: 'terminal' })
  source!: string

  @Column({ name: 'source_reference', type: 'varchar', length: 100, nullable: true })
  sourceReference!: string | null

  @Column({ name: 'ticket_id', type: 'bigint', unsigned: true, nullable: true })
  ticketId!: string | null

  @Column({ name: 'service_id', type: 'bigint', unsigned: true, nullable: true })
  serviceId!: string | null

  @Column({ name: 'ticket_number', type: 'varchar', length: 50 })
  ticketNumber!: string

  @Column({ name: 'service_name', type: 'varchar', length: 150 })
  serviceName!: string

  @Column({ name: 'client_name', type: 'varchar', length: 150, nullable: true })
  clientName!: string | null

  @Column({ name: 'payload_json', type: 'json', nullable: true })
  payloadJson!: Record<string, unknown> | null

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status!: PrintJobStatus

  @Column({ type: 'int', default: 0 })
  attempts!: number

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null

  @Column({ name: 'locked_at', type: 'datetime', nullable: true })
  lockedAt!: Date | null

  @Column({ name: 'printed_at', type: 'datetime', nullable: true })
  printedAt!: Date | null

  @Column({ name: 'last_attempt_at', type: 'datetime', nullable: true })
  lastAttemptAt!: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt!: Date
}
