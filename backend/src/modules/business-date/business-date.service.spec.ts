import { BusinessDateService } from './business-date.service';

describe('BusinessDateService', () => {
  let service: BusinessDateService;

  beforeEach(() => {
    service = new BusinessDateService();
  });

  it('mantiene la fecha comercial de Mendoza cuando UTC ya pasó al día siguiente', () => {
    const reference = new Date('2026-08-06T00:30:00.000Z');

    expect(service.getBusinessDate(reference)).toBe('2026-08-05');
  });

  it('calcula correctamente el rango UTC de una jornada comercial de Mendoza', () => {
    const reference = new Date('2026-08-06T00:30:00.000Z');

    const result = service.getBusinessDayRange(reference);

    expect(result.businessDate).toBe('2026-08-05');
    expect(result.start.toISOString()).toBe('2026-08-05T03:00:00.000Z');
    expect(result.end.toISOString()).toBe('2026-08-06T03:00:00.000Z');
  });

  it('cambia de jornada al llegar la medianoche real de Mendoza', () => {
    const reference = new Date('2026-08-06T03:00:00.000Z');

    const result = service.getBusinessDayRange(reference);

    expect(result.businessDate).toBe('2026-08-06');
    expect(result.start.toISOString()).toBe('2026-08-06T03:00:00.000Z');
    expect(result.end.toISOString()).toBe('2026-08-07T03:00:00.000Z');
  });
});
