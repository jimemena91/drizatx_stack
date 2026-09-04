const DEFAULT_REPORT_TIME_ZONE = 'America/Argentina/Mendoza';

export function dateTokenInTimeZone(
  value?: string,
  timeZone: string = DEFAULT_REPORT_TIME_ZONE,
): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  let formatter: Intl.DateTimeFormat;

  try {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_REPORT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }

  const parts = formatter.formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) return null;

  return `${year}-${month}-${day}`;
}
