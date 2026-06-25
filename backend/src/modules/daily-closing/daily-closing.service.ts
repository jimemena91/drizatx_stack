import { Injectable, Logger } from '@nestjs/common';

import {
  DailyClosingCounts,
  DailyClosingRepository,
} from './daily-closing.repository';

export type DailyClosingResult = DailyClosingCounts & {
  closureDate: string;
  executedAt: string;
  alreadyExecuted: boolean;
};

@Injectable()
export class DailyClosingService {
  private readonly logger = new Logger(DailyClosingService.name);

  constructor(private readonly repository: DailyClosingRepository) {}

  async run(options?: {
    closureDate?: string;
    executedBy?: string;
  }): Promise<DailyClosingResult> {
    const closureDate = options?.closureDate ?? this.resolveBusinessDate();
    const executedBy = options?.executedBy ?? 'system';

    return this.repository.transaction(async (manager) => {
      const existing = await this.repository.findExistingClosureLog(
        manager,
        closureDate,
      );

      if (existing) {
        return {
          closureDate,
          executedAt: new Date().toISOString(),
          alreadyExecuted: true,
          ticketsClosed: Number(existing.tickets_closed ?? 0),
          waitingClosed: 0,
          calledClosed: 0,
          inProgressClosed: 0,
        };
      }

      const counts = await this.repository.countOpenTicketsBeforeDate(
        manager,
        closureDate,
      );

      if (counts.ticketsClosed > 0) {
        await this.repository.closeOpenTicketsBeforeDate(
          manager,
          closureDate,
          executedBy,
        );
      }

      await this.repository.createClosureLog(
        manager,
        closureDate,
        counts,
        executedBy,
      );

      this.logger.log(
        `Daily closing completed for ${closureDate}: ${counts.ticketsClosed} tickets closed`,
      );

      return {
        closureDate,
        executedAt: new Date().toISOString(),
        alreadyExecuted: false,
        ...counts,
      };
    });
  }

  private resolveBusinessDate(): string {
    const now = new Date();
    const argentinaNow = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Argentina/Mendoza' }),
    );

    const year = argentinaNow.getFullYear();
    const month = String(argentinaNow.getMonth() + 1).padStart(2, '0');
    const day = String(argentinaNow.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
