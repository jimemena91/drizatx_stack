import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BackupsService } from './backups.service';

const CHECK_INTERVAL_MS = 60_000;

@Injectable()
export class BackupsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupsSchedulerService.name);
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly backupsService: BackupsService) {}

  onModuleInit() {
    this.interval = setInterval(() => {
      void this.handleTick();
    }, CHECK_INTERVAL_MS);

    // Revisión inicial para ejecutar si corresponde al iniciar el servidor
    setTimeout(() => {
      void this.handleTick(true);
    }, 5_000);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async handleTick(_initial = false): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const now = new Date();
      const shouldRun = await this.backupsService.shouldRunAutomaticBackup(now);
      if (!shouldRun) return;

      await this.backupsService.createBackup({ mode: 'automatic' });
      this.logger.log(`Respaldo automático ejecutado (${now.toISOString()})`);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Fallo al generar respaldo automático', error.stack ?? error.message);
        await this.backupsService.registerAutomaticFailure(error);
      } else {
        const wrapped = new Error(typeof error === 'string' ? error : JSON.stringify(error));
        this.logger.error('Fallo al generar respaldo automático', wrapped.message);
        await this.backupsService.registerAutomaticFailure(wrapped);
      }
    } finally {
      this.running = false;
    }
  }
}
