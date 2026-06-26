import { Module } from '@nestjs/common';

import { QueueEventsModule } from '../queue-events/queue-events.module';

import { DailyClosingController } from './daily-closing.controller';

import { DailyClosingRepository } from './daily-closing.repository';
import { DailyClosingService } from './daily-closing.service';
import { DailyClosingEventsService } from './daily-closing-events.service';
import { DailyClosingScheduler } from './daily-closing.scheduler';

@Module({
  imports: [QueueEventsModule],
  controllers: [DailyClosingController],
  providers: [DailyClosingRepository, DailyClosingService, DailyClosingEventsService, DailyClosingScheduler],
  exports: [DailyClosingService],
})
export class DailyClosingModule {}
