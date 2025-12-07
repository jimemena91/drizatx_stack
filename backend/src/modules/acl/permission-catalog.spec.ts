import { Permission, PERMISSION_SLUG_ALIASES } from '@/common/enums/permission.enum';
import { mapToClientSlug } from './permission-catalog';

describe('mapToClientSlug', () => {
  it('mapea serve_tickets a call_tickets para compatibilidad con el frontend', () => {
    expect(mapToClientSlug('serve_tickets')).toBe('call_tickets');
  });

  it('mantiene call_tickets como alias estable para clientes antiguos', () => {
    expect(mapToClientSlug('call_tickets')).toBe('call_tickets');
  });

  it('permite mapear call_tickets al permiso canonico serve_tickets', () => {
    expect(PERMISSION_SLUG_ALIASES.call_tickets).toBe(Permission.SERVE_TICKETS);
  });
});
