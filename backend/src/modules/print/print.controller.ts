import { Body, Controller, Param, Post } from '@nestjs/common';
import { PrintJobService } from './print-job.service';

@Controller('api/print')
export class PrintController {
  constructor(private readonly printJobService: PrintJobService) {}

  @Post('dispatch/:bridgeId')
  dispatch(
    @Param('bridgeId') bridgeId: string,
    @Body()
    body: {
      ticketNumber: string;
      serviceName?: string;
      clientName?: string;
    },
  ) {
    return this.printJobService.dispatchToBridge(bridgeId, body);
  }
}
