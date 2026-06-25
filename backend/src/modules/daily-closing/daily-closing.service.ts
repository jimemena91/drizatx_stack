import { Injectable } from '@nestjs/common';

import {
  DailyClosingCounts,
  DailyClosingRepository,
} from './daily-closing.repository';
import { DailyClosingEventsService } from './daily-closing-events.service';

export type DailyClosingResult = DailyClosingCounts & {
  closureDate: string;
  executedAt: string;
  alreadyExecuted: boolean;
};

@Injectable()
export class DailyClosingService {
  constructor(
    private readonly repository: DailyClosingRepository,
    private readonly events: DailyClosingEventsService,
  ) {}

  async run(options?: {
    closureDate?: string;
    executedBy?: string;
  }): Promise<DailyClosingResult> {
    const closureDate = options?.closureDate ?? this.resolveBusinessDate();
    const executedBy = options?.executedBy ?? 'system';

    this.events.started(closureDate);

    try {
      const result = await this.repository.transaction(async (manager) => {
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

        return {
          closureDate,
          executedAt: new Date().toISOString(),
          alreadyExecuted: false,
          ...counts,
        };
      });

      this.events.completed(result);

      return result;
    } catch (error) {
      this.events.failed(closureDate, error);
      throw error;
    }
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
