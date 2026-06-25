import { Module } from '@nestjs/common';

import { DailyClosingController } from './daily-closing.controller';

import { DailyClosingRepository } from './daily-closing.repository';
import { DailyClosingService } from './daily-closing.service';

@Module({
  controllers: [DailyClosingController],
  providers: [DailyClosingRepository, DailyClosingService],
  exports: [DailyClosingService],
})
export class DailyClosingModule {}
