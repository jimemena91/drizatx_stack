import { buildRolePermissionsMap } from './role-permissions-map';

describe('buildRolePermissionsMap', () => {
  it('incluye view_dashboard como permiso base para operadores', () => {
    const map = buildRolePermissionsMap(['serve_tickets', 'view_dashboard', 'manage_clients']);
    expect(map.OPERATOR).toEqual(
      expect.arrayContaining(['serve_tickets', 'view_dashboard']),
    );
  });

  it('normaliza y evita duplicados en asignaciones', () => {
    const map = buildRolePermissionsMap(['SERVE_TICKETS', 'serve_tickets', 'VIEW_DASHBOARD']);
    expect(map.SUPERADMIN).toEqual(['serve_tickets', 'view_dashboard']);
  });
});
