import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Ticket } from '../../entities/ticket.entity';
import { Status } from '../../common/enums/status.enum';
import { BusinessDateService } from '../business-date/business-date.service';
import { TicketsService } from './tickets.service';

const DEFAULT_CHECK_INTERVAL_MS = 10_000;
const DEFAULT_AUTO_START_SECONDS = 120;

@Injectable()
export class CalledAutoStartScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CalledAutoStartScheduler.name);
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    private readonly ticketsService: TicketsService,
    private readonly businessDate: BusinessDateService,
  ) {}

  onModuleInit() {
    this.interval = setInterval(() => {
      void this.handleTick();
    }, DEFAULT_CHECK_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private getAutoStartSeconds(): number {
    const parsed = Number(process.env.CALLED_AUTO_START_SECONDS);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_AUTO_START_SECONDS;
    }

    return Math.round(parsed);
  }

  private async handleTick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const businessDate = this.businessDate.getBusinessDate();
      const timeoutSeconds = this.getAutoStartSeconds();
      const cutoff = new Date(Date.now() - timeoutSeconds * 1000);

      const candidates = await this.ticketRepo
        .createQueryBuilder('ticket')
        .where('ticket.status = :status', { status: Status.CALLED })
        .andWhere('ticket.called_at IS NOT NULL')
        .andWhere('ticket.operator_id IS NOT NULL')
        .andWhere('ticket.issued_for_date = :businessDate', { businessDate })
        .andWhere('ticket.called_at <= :cutoff', { cutoff })
        .orderBy('ticket.called_at', 'ASC')
        .limit(100)
        .getMany();

      for (const ticket of candidates) {
        try {
          await this.ticketsService.autoStartCalledTicket(
            ticket.id,
            businessDate,
            timeoutSeconds,
          );
        } catch (error) {
          this.logger.error(
            `Fallo al auto-iniciar ticket ${ticket.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    } catch (error) {
      this.logger.error(
        'Fallo en revisión de tickets CALLED vencidos',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }
}
