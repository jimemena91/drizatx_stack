// lib/auth-utils.ts
import { Role, type Permission } from "@/lib/types";

/* ===========================================================================
   Normalización de Roles
   ---------------------------------------------------------------------------
   Mantener roles en MAYÚSCULAS evita errores por minúsculas/acentos desde el
   backend o el JWT. Esto vuelve el sistema más tolerante y mantenible.
   =========================================================================== */

const ROLE_VALUES = Object.values(Role) as Role[];

export function normalizeRole(
  value: Role | string | null | undefined
): Role | null {
  if (value == null) return null;
  const normalized = String(value).trim().toUpperCase();
  return ROLE_VALUES.includes(normalized as Role) ? (normalized as Role) : null;
}

export function normalizeRoles(
  values: Array<Role | string | null | undefined> | null | undefined,
  fallback?: Role | string | null
): Role[] {
  const result: Role[] = [];
  const pushUnique = (role: Role | null) => {
    if (!role) return;
    if (!result.includes(role)) result.push(role);
  };

  if (Array.isArray(values)) {
    for (const entry of values) pushUnique(normalizeRole(entry ?? null));
  }
  pushUnique(normalizeRole(fallback ?? null));
  return result;
}

/* ===========================================================================
   Normalización de Permisos
   ---------------------------------------------------------------------------
   Guardamos permisos en minúsculas para evitar problemas de casing según
   provengan del backend/JWT. La verificación es case-insensitive.
   =========================================================================== */

function normalizePermission(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function toPermissionSet(perms: Permission[] | null | undefined): Set<string> {
  if (!Array.isArray(perms)) return new Set();
  return new Set(perms.map(normalizePermission));
}

export function hasPermission(
  permissions: Permission[] | null | undefined,
  p: Permission
): boolean {
  const set = toPermissionSet(permissions);
  return set.has(normalizePermission(p));
}

export function hasAnyPermission(
  permissions: Permission[] | null | undefined,
  needed: Permission[]
): boolean {
  if (!Array.isArray(needed) || needed.length === 0) return true;
  const set = toPermissionSet(permissions);
  return needed.some((p) => set.has(normalizePermission(p)));
}

/* ===========================================================================
   Acceso por rutas
   ---------------------------------------------------------------------------
   - null => pública
   - Permisos declarados => requiere alguno de ellos
   - OPERADOR: solo /operator y públicas
   =========================================================================== */

type RouteRule = [pattern: RegExp, need: Permission | Permission[] | null];

const ROUTE_PERMISSIONS: RouteRule[] = [
  [/^\/$/, "view_dashboard"],

  // Públicas
  [/^\/login$/, null],
  [/^\/display(\/.*)?$/, null],
  [/^\/mobile(\/.*)?$/, null],

  // App
  [/^\/dashboard(\/.*)?$/, "view_dashboard"],
  [/^\/clients(\/.*)?$/, "manage_clients"],
  [/^\/reports(\/.*)?$/, "view_reports"],
  [/^\/audit(\/.*)?$/, "view_system_logs"],

  // Admin
  [/^\/admin\/roles(\/.*)?$/, "manage_roles"],
  [/^\/admin(\/.*)?$/, ["manage_settings", "manage_operators"]],

  // Operator
  [/^\/operator(\/.*)?$/, "call_tickets"],
];

function matchRouteRule(pathname: string): RouteRule | undefined {
  return ROUTE_PERMISSIONS.find(([re]) => re.test(pathname));
}

function isPublicPath(pathname: string): boolean {
  const rule = matchRouteRule(pathname);
  return rule ? rule[1] === null : false;
}

/**
 * canAccessRoute: decide si un usuario puede ver una ruta.
 * - OPERADOR: puede /operator y rutas públicas (display/mobile/login).
 * - Resto: según permisos declarados en ROUTE_PERMISSIONS.
 * - Si no hay match, por defecto exige "view_dashboard".
 */
export function canAccessRoute(
  permissions: Permission[] | null | undefined,
  pathname: string,
  role?: Role | string | null
): boolean {
  const normalizedRole = normalizeRole(role ?? null);

  // Reglas especiales para OPERADOR
  if (normalizedRole === Role.OPERATOR) {
    if (/^\/operator(\/.*)?$/.test(pathname)) return true; // su panel
    if (isPublicPath(pathname)) return true; // públicas
    return false; // bloquea el resto
  }

  // Resto de roles (ADMIN/SUPERVISOR/SUPERADMIN)
  const match = matchRouteRule(pathname);
  const need = match ? match[1] : ("view_dashboard" as Permission);

  if (need == null) return true; // pública
  if (Array.isArray(need)) return hasAnyPermission(permissions, need);
  return hasPermission(permissions, need);
}

/* ===========================================================================
   Ruta por defecto según rol
   ---------------------------------------------------------------------------
   Punto único de verdad para adónde mandar a cada rol al iniciar sesión.
   =========================================================================== */

export function getDefaultRouteForRole(
  role: Role | string | null | undefined
): string {
  const normalized = normalizeRole(role) ?? Role.OPERATOR;
  switch (normalized) {
    case "OPERATOR":
      return "/operator";
    case "ADMIN":
    case "SUPERVISOR":
    case "SUPERADMIN":
    default:
      // En tu app "/" muestra el dashboard y exige "view_dashboard".
      return "/";
  }
}

/* ===========================================================================
   Helpers de rol (útiles en menús/nav y guards de UI)
   =========================================================================== */

export function isRole(user: any, role: Role | string): boolean {
  if (!user) return false;
  const target = normalizeRole(role);
  if (!target) return false;
  const primary = normalizeRole(user.role);
  const list = normalizeRoles(user.roles, null);
  return primary === target || list.includes(target);
}

/* ===========================
   DEMO: credenciales simuladas
   =========================== */

export type DemoCredential = {
  email: string;
  password: string;
  role: Role;
  name?: string;
};

// Export que usa el login de la demo
export const DEFAULT_CREDENTIALS: Record<
  | "SUPERADMIN"
  | "ADMIN"
  | "SUPERVISOR"
  | "OPERATOR"
  | "superadmin"
  | "admin"
  | "supervisor"
  | "operator",
  DemoCredential
> = {
  // Por rol (mayúsculas)
  SUPERADMIN: {
    email: "superadmin@drizatx.com",
    password: "superadmin123",
    role: "SUPERADMIN",
    name: "Super Admin",
  },
  ADMIN: {
    email: "admin@drizatx.com",
    password: "admin123",
    role: "ADMIN",
    name: "Admin",
  },
  SUPERVISOR: {
    email: "supervisor@drizatx.com",
    password: "supervisor123",
    role: "SUPERVISOR",
    name: "Supervisor",
  },
  OPERATOR: {
    email: "operador@drizatx.com",
    password: "operador123",
    role: "OPERATOR",
    name: "Operador",
  },

  // Aliases en minúsculas (compatibilidad con el login)
  superadmin: {
    email: "superadmin@drizatx.com",
    password: "superadmin123",
    role: "SUPERADMIN",
    name: "Super Admin",
  },
  admin: {
    email: "admin@drizatx.com",
    password: "admin123",
    role: "ADMIN",
    name: "Admin",
  },
  supervisor: {
    email: "supervisor@drizatx.com",
    password: "supervisor123",
    role: "SUPERVISOR",
    name: "Supervisor",
  },
  operator: {
    email: "operador@drizatx.com",
    password: "operador123",
    role: "OPERATOR",
    name: "Operador",
  },
};
