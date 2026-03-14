import { Injectable } from '@nestjs/common';

export interface PrintJobDispatchResult {
  accepted: boolean;
  jobId: string;
  bridgeId: string;
  dispatchedAt: Date;
}

@Injectable()
export class PrintJobService {
  markJobCreated(jobId: string) {
    return {
      ok: true,
      jobId,
      status: 'PENDING',
      createdAt: new Date(),
    };
  }

  dispatchToBridge(jobId: string, bridgeId: string): PrintJobDispatchResult {
    return {
      accepted: true,
      jobId,
      bridgeId,
      dispatchedAt: new Date(),
    };
  }
}
