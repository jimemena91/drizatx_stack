import { Module } from '@nestjs/common';
import { PrintService } from './print.service';
import { PrintBridgeService } from './print-bridge.service';
import { PrintJobService } from './print-job.service';
import { PrintGateway } from './print.gateway';

@Module({
  providers: [PrintService, PrintBridgeService, PrintJobService, PrintGateway],
  exports: [PrintService, PrintBridgeService, PrintJobService],
})
export class PrintModule {}
