import { Permission } from '../../common/enums/permission.enum';

export type RolePermissionsSeed = Record<string, Permission[]>;

const BASE_ROLE_PERMISSIONS: RolePermissionsSeed = {
  ADMIN: [
    Permission.VIEW_DASHBOARD,
    Permission.MANAGE_OPERATORS,
    Permission.MANAGE_SERVICES,
    Permission.VIEW_REPORTS,
    Permission.SERVE_TICKETS,
    Permission.MANAGE_SETTINGS,
    Permission.MANAGE_ROLES,
  ],
  SUPERVISOR: [
    Permission.MANAGE_OPERATORS,
    Permission.VIEW_REPORTS,
    Permission.SERVE_TICKETS,
  ],
  OPERATOR: [
    Permission.SERVE_TICKETS,
    Permission.VIEW_DASHBOARD,
  ],
};

function normalizeSlugs(slugs: string[]): string[] {
  const normalized = (Array.isArray(slugs) ? slugs : [])
    .map((slug) => String(slug ?? '').toLowerCase())
    .filter((slug) => slug);

  return Array.from(new Set(normalized));
}

export function buildRolePermissionsMap(
  allPermissionSlugs: string[],
): Record<string, string[]> {
  const normalizedAll = normalizeSlugs(allPermissionSlugs);
  const map: Record<string, string[]> = {
    SUPERADMIN: normalizedAll,
  };

  for (const [role, permissions] of Object.entries(BASE_ROLE_PERMISSIONS)) {
    map[role] = normalizeSlugs(permissions.map((permission) => String(permission)));
  }

  return map;
}

export function getRoleSeedPermissions(role: string, allPermissionSlugs: string[]): string[] {
  const map = buildRolePermissionsMap(allPermissionSlugs);
  const normalizedRole = String(role ?? '').toUpperCase();
  return map[normalizedRole] ?? [];
}
