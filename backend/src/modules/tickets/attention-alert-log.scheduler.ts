import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { AttentionAlertLogService } from './attention-alert-log.service';

const CHECK_INTERVAL_MS = 15_000;
const STEADY_LOOKBACK_MS = 15 * 60 * 1000;
// En el primer ciclo después de arrancar se mira más atrás por si el backend
// estuvo caído y se perdió algún ticket que excedió el tiempo.
const STARTUP_LOOKBACK_MS = 48 * 60 * 60 * 1000;

@Injectable()
export class AttentionAlertLogScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttentionAlertLogScheduler.name);
  private interval: NodeJS.Timeout | null = null;
  private running = false;
  private firstRun = true;

  constructor(private readonly alertLog: AttentionAlertLogService) {}

  onModuleInit() {
    this.interval = setInterval(() => {
      void this.handleTick();
    }, CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async handleTick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const lookback = this.firstRun ? STARTUP_LOOKBACK_MS : STEADY_LOOKBACK_MS;
      const result = await this.alertLog.recordCycle(new Date(), lookback);
      this.firstRun = false;

      if (result.inserted > 0 || result.finalized > 0) {
        this.logger.log(
          `alertas de atención: +${result.inserted} nuevas, ${result.finalized} cerradas`,
        );
      }
    } catch (error) {
      this.logger.error(
        'No se pudo registrar el historial de alertas de atención',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
