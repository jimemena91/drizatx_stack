import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { DailyClosingService } from './daily-closing.service';

@Injectable()
export class DailyClosingScheduler {
  private readonly logger = new Logger(DailyClosingScheduler.name);

  constructor(
    private readonly dailyClosingService: DailyClosingService,
  ) {}

  @Cron('0 0 * * *', {
    timeZone: 'America/Argentina/Mendoza',
  })
  async runDailyClosing() {
    this.logger.log('Starting automatic daily closing');

    try {
      const result = await this.dailyClosingService.run({
        executedBy: 'scheduler',
      });

      this.logger.log(
        `Automatic daily closing finished (alreadyExecuted=${result.alreadyExecuted})`,
      );
    } catch (error) {
      this.logger.error(
        'Automatic daily closing failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
