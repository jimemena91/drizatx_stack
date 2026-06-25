import { Injectable, Logger } from '@nestjs/common';

import { DailyClosingResult } from './daily-closing.service';

@Injectable()
export class DailyClosingEventsService {
  private readonly logger = new Logger(DailyClosingEventsService.name);

  started(closureDate: string) {
    this.logger.log(`Daily closing started (${closureDate})`);

    // Próximamente:
    // - WebSocket
    // - Audit Log
    // - Métricas
  }

  completed(result: DailyClosingResult) {
    this.logger.log(
      `Daily closing completed (${result.closureDate}) - ${result.ticketsClosed} tickets`,
    );

    // Próximamente:
    // - Broadcast websocket
    // - Refresh dashboard
    // - Evento para display
  }

  failed(closureDate: string, error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);

    this.logger.error(
      `Daily closing failed (${closureDate})`,
      message,
    );

    // Próximamente:
    // - Audit crítico
    // - Notificación
  }
}
