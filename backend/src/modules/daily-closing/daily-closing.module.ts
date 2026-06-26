import { Module } from '@nestjs/common';

import { DailyClosingController } from './daily-closing.controller';

import { DailyClosingRepository } from './daily-closing.repository';
import { DailyClosingService } from './daily-closing.service';
import { DailyClosingEventsService } from './daily-closing-events.service';
import { DailyClosingScheduler } from './daily-closing.scheduler';

@Module({
  controllers: [DailyClosingController],
  providers: [DailyClosingRepository, DailyClosingService, DailyClosingEventsService, DailyClosingScheduler],
  exports: [DailyClosingService],
})
export class DailyClosingModule {}
