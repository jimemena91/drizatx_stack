import { Permission, PERMISSION_SLUG_ALIASES } from '../../common/enums/permission.enum';

export type PermissionCatalogEntry = {
  slug: Permission;
  name: string;
  description?: string | null;
  module: string;
  moduleLabel: string;
  order: number;
  legacySlugs?: string[];
};

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  {
    slug: Permission.VIEW_DASHBOARD,
    name: 'Ver dashboard',
    description: 'Acceder al panel principal e indicadores resumidos.',
    module: 'dashboard',
    moduleLabel: 'Dashboard',
    order: 10,
  },
  {
    slug: Permission.MANAGE_CLIENTS,
    name: 'Gestionar clientes',
    description: 'Crear, editar y administrar fichas de clientes.',
    module: 'clients',
    moduleLabel: 'Clientes',
    order: 20,
  },
  {
    slug: Permission.MANAGE_SERVICES,
    name: 'Gestionar servicios',
    description: 'Administrar catálogo, configuración y prioridades de servicios.',
    module: 'services',
    moduleLabel: 'Servicios',
    order: 30,
  },
  {
    slug: Permission.MANAGE_OPERATORS,
    name: 'Gestionar operadores',
    description: 'Crear usuarios de operador, asignar roles y servicios.',
    module: 'operators',
    moduleLabel: 'Operadores',
    order: 40,
  },
  {
    slug: Permission.SERVE_TICKETS,
    name: 'Atender tickets',
    description: 'Llamar, pausar y finalizar tickets en cola.',
    module: 'operations',
    moduleLabel: 'Operaciones',
    order: 50,
    legacySlugs: ['call_tickets'],
  },
  {
    slug: Permission.VIEW_REPORTS,
    name: 'Ver reportes',
    description: 'Acceder a reportes y analíticas históricas.',
    module: 'reports',
    moduleLabel: 'Reportes',
    order: 60,
  },
  {
    slug: Permission.MANAGE_ROLES,
    name: 'Administrar roles y permisos',
    description: 'Crear, editar y configurar roles del sistema.',
    module: 'security',
    moduleLabel: 'Seguridad',
    order: 70,
  },
  {
    slug: Permission.MANAGE_SETTINGS,
    name: 'Configurar sistema',
    description: 'Modificar parámetros y preferencias globales.',
    module: 'settings',
    moduleLabel: 'Configuración',
    order: 80,
  },
  {
    slug: Permission.VIEW_SYSTEM_LOGS,
    name: 'Ver auditoría',
    description: 'Consultar registros de auditoría y eventos críticos.',
    module: 'security',
    moduleLabel: 'Seguridad',
    order: 90,
  },
];

export function mapToClientSlug(slug: string): string {
  const normalized = String(slug ?? '').toLowerCase();
  const catalogEntry = PERMISSION_CATALOG.find((item) => item.slug === normalized);
  if (catalogEntry?.legacySlugs?.length) {
    return catalogEntry.legacySlugs[0];
  }
  const alias = Object.entries(PERMISSION_SLUG_ALIASES).find(([, value]) => value === normalized);
  if (alias) {
    return alias[0];
  }
  return normalized;
}
