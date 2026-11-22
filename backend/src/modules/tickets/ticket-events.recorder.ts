import { Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

import { Operator } from '../../entities/operator.entity';
import { TicketEvent, type TicketEventType } from '../../entities/ticket-event.entity';
import { Status } from '../../common/enums/status.enum';

/**
 * Registro de eventos del ticket. Sin dependencias de Nest para poder usarlo
 * también desde el cierre diario.
 *
 * Regla de oro: registrar el historial NUNCA puede romper ni demorar la
 * operación del ticket. Todo error se captura y se avisa en el log (a lo sumo
 * una vez por minuto, para no inundarlo si la tabla todavía no existe).
 */
const logger = new Logger('TicketEvents');
const WARN_EVERY_MS = 60_000;
let lastWarnAt = 0;

const warnThrottled = (message: string): void => {
  const now = Date.now();
  if (now - lastWarnAt < WARN_EVERY_MS) return;
  lastWarnAt = now;
  logger.warn(message);
};

export type TicketEventInput = {
  ticketId: number;
  ticketNumber: string;
  serviceId: number;
  eventType: TicketEventType;
  previousStatus: string | null;
  newStatus: string | null;
  operatorId: number | null;
  occurredAt: Date;
  source?: string | null;
};

/** Evento que corresponde a un cambio de estado. */
export function eventTypeForTransition(
  previous: string | null | undefined,
  next: string,
): TicketEventType {
  switch (next) {
    case Status.CALLED:
      return previous === Status.ABSENT ? 'TAKEN_FROM_ABSENT' : 'CALLED';
    case Status.IN_PROGRESS:
      return 'STARTED';
    case Status.ABSENT:
      return 'ABSENT';
    case Status.WAITING:
      return previous === Status.ABSENT ? 'REQUEUED' : 'STATUS_CHANGE';
    case Status.COMPLETED:
      return 'COMPLETED';
    case Status.CANCELLED:
      return 'CANCELLED';
    case Status.DAILY_CLOSED:
      return 'DAILY_CLOSED';
    default:
      return 'STATUS_CHANGE';
  }
}

export const validDate = (value: unknown): Date | null => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value;
};

type OperatorSnapshot = { name: string | null; position: string | null };

async function snapshotOperator(
  manager: EntityManager,
  operatorId: number | null,
  cache: Map<number, OperatorSnapshot>,
): Promise<OperatorSnapshot> {
  if (!operatorId) return { name: null, position: null };
  const cached = cache.get(operatorId);
  if (cached) return cached;

  const op = await manager.getRepository(Operator).findOne({
    where: { id: operatorId },
    select: { id: true, name: true, position: true },
  });
  const snapshot = { name: op?.name ?? null, position: op?.position ?? null };
  cache.set(operatorId, snapshot);
  return snapshot;
}

/** Guarda uno o varios eventos. Nunca lanza. */
export async function recordTicketEvents(
  manager: EntityManager,
  inputs: TicketEventInput[],
): Promise<void> {
  if (!inputs.length) return;
  try {
    const cache = new Map<number, OperatorSnapshot>();
    const rows: Partial<TicketEvent>[] = [];

    for (const input of inputs) {
      const op = await snapshotOperator(manager, input.operatorId, cache);
      rows.push({
        ticketId: input.ticketId,
        ticketNumber: input.ticketNumber,
        serviceId: input.serviceId,
        eventType: input.eventType,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        operatorId: input.operatorId,
        operatorName: op.name,
        operatorPosition: op.position,
        source: input.source ?? null,
        occurredAt: input.occurredAt,
      });
    }

    await manager.getRepository(TicketEvent).insert(rows as any);
  } catch (error) {
    warnThrottled(
      `No se pudo registrar el historial del ticket: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export const recordTicketEvent = (manager: EntityManager, input: TicketEventInput) =>
  recordTicketEvents(manager, [input]);
