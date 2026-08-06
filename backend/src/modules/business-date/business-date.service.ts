import { Injectable } from '@nestjs/common';

export type BusinessDayRange = {
  businessDate: string;
  start: Date;
  end: Date;
};

@Injectable()
export class BusinessDateService {
  readonly timeZone = 'America/Argentina/Mendoza';

  getBusinessDate(reference = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(reference);

    const values = new Map(
      parts.map((part) => [part.type, part.value]),
    );

    const year = values.get('year');
    const month = values.get('month');
    const day = values.get('day');

    if (!year || !month || !day) {
      throw new Error(
        `No se pudo resolver la fecha comercial para ${this.timeZone}`,
      );
    }

    return `${year}-${month}-${day}`;
  }

  getBusinessDayRange(reference = new Date()): BusinessDayRange {
    const businessDate = this.getBusinessDate(reference);
    const [year, month, day] = businessDate.split('-').map(Number);

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day)
    ) {
      throw new Error(`Fecha comercial inválida: ${businessDate}`);
    }

    const start = this.localMidnightToUtc(year, month, day);

    const nextDate = new Date(Date.UTC(year, month - 1, day + 1));

    const end = this.localMidnightToUtc(
      nextDate.getUTCFullYear(),
      nextDate.getUTCMonth() + 1,
      nextDate.getUTCDate(),
    );

    return {
      businessDate,
      start,
      end,
    };
  }

  private localMidnightToUtc(
    year: number,
    month: number,
    day: number,
  ): Date {
    const localMidnightAsUtc = Date.UTC(
      year,
      month - 1,
      day,
      0,
      0,
      0,
      0,
    );

    let candidate = new Date(localMidnightAsUtc);

    for (let iteration = 0; iteration < 2; iteration += 1) {
      const offsetMinutes = this.getOffsetMinutes(candidate);

      candidate = new Date(
        localMidnightAsUtc - offsetMinutes * 60_000,
      );
    }

    return candidate;
  }

  private getOffsetMinutes(reference: Date): number {
    const zonePart = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timeZone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(reference)
      .find((part) => part.type === 'timeZoneName')
      ?.value;

    const match = zonePart?.match(
      /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/,
    );

    if (!match) {
      throw new Error(
        `No se pudo resolver el offset horario para ${this.timeZone}`,
      );
    }

    const sign = match[1];

    if (!sign) {
      return 0;
    }

    const hours = Number(match[2] ?? 0);
    const minutes = Number(match[3] ?? 0);
    const total = hours * 60 + minutes;

    return sign === '-' ? -total : total;
  }
}
