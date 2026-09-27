const DEFAULT_REPORT_TIME_ZONE = 'America/Argentina/Mendoza';

function resolveTimeZone(timeZone?: string): string {
  const candidate = timeZone || DEFAULT_REPORT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: candidate,
    }).format(new Date());

    return candidate;
  } catch {
    return DEFAULT_REPORT_TIME_ZONE;
  }
}

function parseDate(value?: string | Date): Date | null {
  if (!value) return null;

  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export function dateTokenInTimeZone(
  value?: string,
  timeZone: string = DEFAULT_REPORT_TIME_ZONE,
): string | null {
  const date = parseDate(value);
  if (!date) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) return null;

  return `${year}-${month}-${day}`;
}

export function formatDateTimeInTimeZone(
  value?: string | Date,
  timeZone: string = DEFAULT_REPORT_TIME_ZONE,
): string | null {
  const date = parseDate(value);
  if (!date) return null;

  const formatter = new Intl.DateTimeFormat('es-AR', {
    timeZone: resolveTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  return formatter.format(date);
}
