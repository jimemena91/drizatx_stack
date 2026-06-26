import { Injectable, Logger, Optional } from '@nestjs/common';

import { QueueEventsService } from '../queue-events/queue-events.service';
import { DailyClosingResult } from './daily-closing.service';

@Injectable()
export class DailyClosingEventsService {
  private readonly logger = new Logger(DailyClosingEventsService.name);

  constructor(
    @Optional()
    private readonly queueEvents?: QueueEventsService,
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
  }

  failed(closureDate: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    this.logger.error(`Daily closing failed (${closureDate})`, message);

    // Proximamente:
    // - Audit critico
    // - Notificacion
  }
}
