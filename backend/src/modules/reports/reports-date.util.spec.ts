import { dateTokenInTimeZone } from './reports-date.util';

describe('dateTokenInTimeZone', () => {
  it('usa el día calendario de Mendoza aunque UTC ya esté en el día siguiente', () => {
    expect(
      dateTokenInTimeZone(
        '2026-09-04T01:16:36.000Z',
        'America/Argentina/Mendoza',
      ),
    ).toBe('2026-09-03');
  });

  it('mantiene el día UTC cuando el reporte usa UTC', () => {
    expect(
      dateTokenInTimeZone(
        '2026-09-04T01:16:36.000Z',
        'UTC',
      ),
    ).toBe('2026-09-04');
  });

  it('devuelve null para una fecha inválida', () => {
    expect(
      dateTokenInTimeZone(
        'fecha-invalida',
        'America/Argentina/Mendoza',
      ),
    ).toBeNull();
  });

  it('devuelve null cuando no hay valor', () => {
    expect(
      dateTokenInTimeZone(
        undefined,
        'America/Argentina/Mendoza',
      ),
    ).toBeNull();
  });
});
