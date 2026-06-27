import { Controller, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { DailyClosingService } from './daily-closing.service';

@ApiTags('daily-closing')
@Controller('daily-closing')
export class DailyClosingController {
  constructor(private readonly dailyClosingService: DailyClosingService) {}

  @Post('run')
  run(
    @Query('date') date?: string,
    @Query('executedBy') executedBy?: string,
  ) {
    return this.dailyClosingService.run({
      closureDate: date,
      executedBy: executedBy ?? 'manual',
    });
  }
}
