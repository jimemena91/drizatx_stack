import { Injectable, NotFoundException } from '@nestjs/common';
import { PrintBridgeService } from './print-bridge.service';
import { PrintGateway } from './print.gateway';

export interface PrintJobPayload {
  ticketNumber: string;
  serviceName?: string;
  clientName?: string;
}

@Injectable()
export class PrintJobService {
  constructor(
    private readonly printBridgeService: PrintBridgeService,
    private readonly printGateway: PrintGateway,
  ) {}

  createJobId() {
    return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  dispatchToBridge(bridgeId: string, payload: PrintJobPayload) {
    const bridge = this.printBridgeService.getConnectedBridge(bridgeId);

    if (!bridge) {
      throw new NotFoundException(`Bridge no conectado: ${bridgeId}`);
    }

    const jobId = this.createJobId();

    this.printGateway.emitPrintJobToBridge(bridgeId, {
      jobId,
      createdAt: new Date().toISOString(),
      payload,
    });

    return {
      ok: true,
      bridgeId,
      jobId,
      payload,
    };
  }
}
