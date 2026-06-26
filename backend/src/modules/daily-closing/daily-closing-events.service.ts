import { Injectable, Logger, Optional } from '@nestjs/common';

import { AuditLogsService } from '../audit/audit-logs.service';
import { QueueEventsService } from '../queue-events/queue-events.service';
import { DailyClosingResult } from './daily-closing.service';

@Injectable()
export class DailyClosingEventsService {
  private readonly logger = new Logger(DailyClosingEventsService.name);

  constructor(
    @Optional()
    private readonly queueEvents?: QueueEventsService,
    @Optional()
    private readonly auditLogs?: AuditLogsService,
  ) {}

  started(closureDate: string) {
    this.logger.log(`Daily closing started (${closureDate})`);

    // Proximamente:
    // - Audit Log
    // - Metricas
  }

  completed(result: DailyClosingResult) {
    this.logger.log(
      `Daily closing completed (${result.closureDate}) - ${result.ticketsClosed} tickets`,
    );

    this.queueEvents?.emitQueueUpdated({
      at: result.executedAt,
    });

    void this.auditLogs?.recordSystemEvent({
      eventType: 'daily_closing.completed',
      action: 'daily_closing',
      target: result.closureDate,
      description: 'Daily closing completed successfully',
      severity: 'low',
      source: 'daily-closing',
      tags: ['daily-closing', 'queue', 'system'],
      metadata: {
        closureDate: result.closureDate,
        executedAt: result.executedAt,
        alreadyExecuted: result.alreadyExecuted,
        ticketsClosed: result.ticketsClosed,
        waitingClosed: result.waitingClosed,
        calledClosed: result.calledClosed,
        inProgressClosed: result.inProgressClosed,
      },
      at: new Date(result.executedAt),
    });
  }

  failed(closureDate: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    this.logger.error(`Daily closing failed (${closureDate})`, message);

    // Proximamente:
    // - Audit critico
    // - Notificacion
  }
}
