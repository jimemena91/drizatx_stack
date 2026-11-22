import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type TicketEventType =
  | 'CREATED' // emitido
  | 'CALLED' // llamado desde la fila
  | 'TAKEN_FROM_ABSENT' // llamado de nuevo después de estar ausente
  | 'STARTED' // comenzó la atención
  | 'ABSENT' // marcado ausente
  | 'REQUEUED' // vuelto a la fila tras estar ausente
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DAILY_CLOSED'
  | 'STATUS_CHANGE'; // cualquier otra transición

/**
 * Historial de eventos de un ticket: una fila por cada paso (emisión, llamado,
 * ausente, reingreso, atención, cierre).
 *
 * Los datos del operador (nombre y puesto) se copian al momento del evento:
 * si después cambia el puesto o se borra el operador, lo que pasó no se reescribe.
 * No hay FK a `tickets` a propósito: el historial no debe perderse ni bloquear
 * ninguna operación sobre el ticket.
 */
@Entity('ticket_events')
@Index('idx_ticket_events_ticket', ['ticketId', 'occurredAt'])
@Index('idx_ticket_events_occurred', ['occurredAt'])
export class TicketEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'ticket_id', type: 'int' })
  ticketId: number;

  @Column({ name: 'ticket_number', type: 'varchar', length: 20 })
  ticketNumber: string;

  @Column({ name: 'service_id', type: 'int' })
  serviceId: number;

  @Column({ name: 'event_type', type: 'varchar', length: 30 })
  eventType: TicketEventType;

  @Column({ name: 'previous_status', type: 'varchar', length: 20, nullable: true })
  previousStatus: string | null;

  @Column({ name: 'new_status', type: 'varchar', length: 20, nullable: true })
  newStatus: string | null;

  @Column({ name: 'operator_id', type: 'int', nullable: true })
  operatorId: number | null;

  @Column({ name: 'operator_name', type: 'varchar', length: 100, nullable: true })
  operatorName: string | null;

  @Column({ name: 'operator_position', type: 'varchar', length: 50, nullable: true })
  operatorPosition: string | null;

  /** MANUAL / AUTO (inicio de atención) o SYSTEM (cierre diario). */
  @Column({ name: 'source', type: 'varchar', length: 20, nullable: true })
  source: string | null;

  @Column({ name: 'occurred_at', type: 'datetime', precision: 3 })
  occurredAt: Date;
}
