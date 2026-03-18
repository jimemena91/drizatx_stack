import { Module } from '@nestjs/common';
import { PrintService } from './print.service';
import { PrintBridgeService } from './print-bridge.service';
import { PrintJobService } from './print-job.service';
import { PrintGateway } from './print.gateway';
import { PrintController } from './print.controller';

@Module({
  controllers: [PrintController],
  providers: [PrintService, PrintBridgeService, PrintJobService, PrintGateway],
  exports: [PrintService, PrintBridgeService, PrintJobService, PrintGateway],
})
export class PrintModule {}
