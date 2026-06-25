import { Module } from '@nestjs/common';

import { DailyClosingRepository } from './daily-closing.repository';
import { DailyClosingService } from './daily-closing.service';

@Module({
  providers: [DailyClosingRepository, DailyClosingService],
  exports: [DailyClosingService],
})
export class DailyClosingModule {}
