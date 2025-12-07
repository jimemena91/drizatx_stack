export enum Permission {
  MANAGE_OPERATORS = 'manage_operators',
  MANAGE_SERVICES = 'manage_services',
  VIEW_REPORTS = 'view_reports',
  SERVE_TICKETS = 'serve_tickets',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_CLIENTS = 'manage_clients',
  VIEW_DASHBOARD = 'view_dashboard',
  VIEW_SYSTEM_LOGS = 'view_system_logs',
  MANAGE_ROLES = 'manage_roles',
}

export type AppPermission = `${Permission}`;

/**
 * Aliases heredados mantenidos para compatibilidad hacia atrás.
 *
 * Ej: versiones antiguas del frontend seguían solicitando `call_tickets`,
 * mientras que el backend estandarizó el slug como `serve_tickets`.
 */
export const PERMISSION_SLUG_ALIASES: Record<string, Permission> = {
  call_tickets: Permission.SERVE_TICKETS,
  calltickets: Permission.SERVE_TICKETS,
  'call-tickets': Permission.SERVE_TICKETS,
  serve_tickets: Permission.SERVE_TICKETS,
  servetickets: Permission.SERVE_TICKETS,
  'serve-tickets': Permission.SERVE_TICKETS,
};

const CANONICAL_PERMISSION_SET = new Set<string>(Object.values(Permission));

export function normalizePermissionSlug(value: unknown): Permission | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (CANONICAL_PERMISSION_SET.has(normalized)) {
    return normalized as Permission;
  }

  return PERMISSION_SLUG_ALIASES[normalized] ?? null;
}
