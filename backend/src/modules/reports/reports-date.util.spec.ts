import {
  dateTokenInTimeZone,
  formatDateTimeInTimeZone,
} from './reports-date.util';

describe('reports-date.util', () => {
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

  describe('formatDateTimeInTimeZone', () => {
    it('muestra un instante UTC en la hora local de Mendoza', () => {
      expect(
        formatDateTimeInTimeZone(
          '2026-09-04T04:20:50.311Z',
          'America/Argentina/Mendoza',
        ),
      ).toBe('04/09/2026, 01:20:50');
    });

    it('mantiene la hora cuando la zona del reporte es UTC', () => {
      expect(
        formatDateTimeInTimeZone(
          '2026-09-04T04:20:50.311Z',
          'UTC',
        ),
      ).toBe('04/09/2026, 04:20:50');
    });

    it('acepta objetos Date para la fecha de generación', () => {
      expect(
        formatDateTimeInTimeZone(
          new Date('2026-09-04T04:21:10.205Z'),
          'America/Argentina/Mendoza',
        ),
      ).toBe('04/09/2026, 01:21:10');
    });

    it('devuelve null para una fecha inválida', () => {
      expect(
        formatDateTimeInTimeZone(
          'fecha-invalida',
          'America/Argentina/Mendoza',
        ),
      ).toBeNull();
    });
  });
});
