/* =========================
 * Tipos de dominio (frontend)
 * ========================= */
import { resolveApiBaseUrl } from "@/lib/resolve-api-base";

import type {
  AuditLogListMeta,
  AuditLogListResponse,
  AuditLogRecord,
  AuditLogSeverity,
  Permission,
  Status,
} from "@/lib/types";

export type Service = {
  id: number;
  name: string;
  icon?: string | null;
  prefix: string;
  active: 0 | 1 | boolean;
  priority: number;
  estimatedTime: number;
  maxAttentionTime?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PublicServiceResponse = {
  id: number;
  name: string;
  icon: string | null;
  prefix: string;
  active: boolean;
  priority: number;
  estimatedTime: number;
  maxAttentionTime: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type Operator = {
  id: number;
  name: string;
  username: string;
  email: string;
  position?: string | null;
  role?: string;
  active: 0 | 1 | boolean;
  // conveniencias opcionales
  serviceIds?: number[];
  services?: Array<{
    id: number;
    name: string;
    prefix?: string | null;
    active?: boolean | number;
    weight?: number | null;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

export type OperatorAvailabilityStatus = "ACTIVE" | "BREAK" | "OFF";

export type OperatorWithStatus = Operator & {
  availability?: OperatorAvailabilityStatus | string | null;
  availabilityStatus?: OperatorAvailabilityStatus | string | null;
  status?: OperatorAvailabilityStatus | string | null;
  derivedStatus?: string;
  derivedStatusLabel?: string;
  currentTicket?: {
    id: number;
    number: string;
    status: string;
    startedAt?: string | null;
    calledAt?: string | null;
    serviceId?: number;
    service?: { id: number; name: string; maxAttentionTime?: number | null } | null;
    attentionDuration?: number | null;
  } | null;
  currentShift?: {
    id: number;
    startedAt: string;
    endedAt: string | null;
  } | null;
};

export type Ticket = {
  id: number;
  number: string;
  serviceId: number;
  operatorId: number | null;
  clientId: number | null;
  status: "WAITING" | "CALLED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ABSENT";
  createdAt: string;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  attentionDuration?: number | null;
  priority: number;
  estimatedWaitTime: number | null;
  actualWaitTime: number | null;
  mobilePhone: string | null;
  notificationSent: 0 | 1;
  almostReadyNotificationSentAt?: string | null;
  qrScannedAt?: string | null;
};

export type PublicTicketResponse = Ticket & {
  service?: {
    id: number;
    name: string;
    prefix: string;
    active: boolean;
    priority: number;
    estimatedTime: number;
    maxAttentionTime?: number | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  } | null;
};

export type AttentionAlert = {
  ticketId: number;
  ticketNumber: string;
  status: string;
  operatorId: number | null;
  operatorName: string | null;
  serviceId: number;
  serviceName: string;
  maxAttentionTime: number;
  elapsedSeconds: number;
  exceededSeconds: number;
  startedAt: string | null;
  completedAt: string | null;
};

export type OperatorAttentionHistoryItem = {
  ticketId: number;
  ticketNumber: string;
  status: Status | string;
  serviceId: number;
  serviceName: string;
  startedAt: string | null;
  completedAt: string | null;
  attentionSeconds: number | null;
  maxAttentionTime: number | null;
  exceededSeconds: number | null;
};

export type OperatorAttentionMetricsQuery = {
  period?: 'day' | 'week' | 'month' | 'year' | 'all';
  date?: string;
  from?: string;
  to?: string;
  statuses?: Array<Status | string>;
  limit?: number;
  serviceId?: number | null;
};

export type OperatorAttentionMetrics = {
  operatorId: number;
  totalCompleted: number;
  averageAttentionSeconds: number | null;
  exceededCount: number;
  history: OperatorAttentionHistoryItem[];
  period: 'day' | 'week' | 'month' | 'year' | 'all' | 'custom';
  from: string | null;
  to: string | null;
  statuses: Status[];
  limit: number;
  serviceId: number | null;
};

export type QueueNext = Ticket | null;

export type OperatorShiftRecord = {
  id: number;
  operatorId: number;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
};

export type OperatorShiftHistory = {
  operatorId: number;
  period: 'day' | 'week' | 'month' | 'all' | 'custom';
  from: string | null;
  to: string | null;
  totalShifts: number;
  totalDurationSeconds: number;
  averageDurationSeconds: number | null;
  daysWorked: number;
  hasOpenShift: boolean;
  shifts: OperatorShiftRecord[];
};

export type SystemSetting = {
  id: number;
  key: string;
  value: string;
  description: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type BackupTriggerResponse = {
  fileName: string;
  directory: string;
  generatedAt: string;
  size: number;
  downloadPath: string;
};

export type BackupStatus = {
  configuredDirectory: string | null;
  resolvedDirectory: string;
  directoryExists: boolean;
  defaultDirectory: string;
  mysqldumpConfiguredPath: string | null;
  mysqldumpResolvedCommand: string;
  mysqldumpCommandSource: 'setting' | 'env' | 'default';
  mysqldumpAvailable: boolean;
  lastGeneratedAt: string | null;
  lastAutomaticAt: string | null;
  lastManualAt: string | null;
  lastFailureAt: string | null;
  lastFileName: string | null;
  lastDirectory: string;
  lastSize: number | null;
  lastError: string | null;
  enabled: boolean;
  time: string;
};

export type BackupDirectoryEntry = {
  name: string;
  path: string;
};

export type BackupDirectoryListing = {
  path: string;
  parent: string | null;
  entries: BackupDirectoryEntry[];
};

export type BackupDirectoryCreateResponse = {
  path: string;
  created: boolean;
};

export type CustomMessage = {
  id: number;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'promotion' | 'announcement';
  active: boolean | 0 | 1;
  priority: number;
  startDate?: string | null;
  endDate?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;

  // 🆕 campos que ya usa el hook/useCustomMessages
  displayDurationSeconds?: number | null;
  activeDays?: string[] | null;

  createdAt?: string;
  updatedAt?: string;
};


export type AuditLogListParams = {
  page?: number;
  limit?: number;
  severity?: AuditLogSeverity;
  search?: string;
  actorId?: number;
  from?: string;
  to?: string;
};

export type Client = {
  id: number;
  dni: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  vip?: boolean | 0 | 1;
  createdAt: string;
  updatedAt: string;
};

export type PublicClientResponse = {
  id: number;
  dni: string;
  name: string;
  email: string | null;
  phone: string | null;
  vip: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ClientVisitHistoryItem = {
  ticketId: number;
  ticketNumber: string;
  status: Status | string;
  serviceId: number | null;
  serviceName: string | null;
  operatorId: number | null;
  operatorName: string | null;
  createdAt: string;
  calledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type ClientHistoryResponse = {
  client: Client;
  totalVisits: number;
  lastVisitAt: string | null;
  lastTicketNumber: string | null;
  lastOperator: { id: number | null; name: string | null } | null;
  lastService: { id: number | null; name: string | null } | null;
  history: ClientVisitHistoryItem[];
};

export type CreateClientPayload = {
  dni: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  vip?: boolean | 0 | 1;
};

export type UpdateClientPayload = Partial<CreateClientPayload>;

export type CreateCustomMessagePayload = {
  title: string;
  content: string;
  type?: CustomMessage['type'];
  active?: boolean | 0 | 1;
  priority?: number;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  displayDurationSeconds?: number | null;
  activeDays?: string[] | null;
};

export type UpdateCustomMessagePayload = Partial<CreateCustomMessagePayload>;

export type DashboardServiceRow = {
  serviceId: number;
  serviceName: string;
  serviceIcon: string | null;
  waitingCount: number;
  avgWaitTime: number | null;
  inProgressCount: number;
  completedCountToday: number;
  absentCountToday: number;
  attendedCountToday: number;
};

export type DashboardTicket = Ticket & {
  service?: Service | null;
  operator?: Operator | null;
  client?: Client | null;
};

export type DashboardResponse = {
  services: DashboardServiceRow[];
  updatedAt: string;
  currentTicket: DashboardTicket | null;
  nextTickets: DashboardTicket[];
  inProgressTickets?: DashboardTicket[];
  calledTickets?: DashboardTicket[];
  waitingTickets?: DashboardTicket[];
  absentTickets?: DashboardTicket[];
  recentlyCompletedTickets?: DashboardTicket[];
};

export type CreateTicketBody = {
  mobilePhone?: string;
  phone?: string;
  priority?: number;
  clientId?: number;
  dni?: string;
  notes?: string;
};

// Payloads clave para Operadores
export type CreateOperatorPayload = {
  name: string;
  username: string;
  password: string;
  email: string;
  position: string;
  role: "SUPERADMIN" | "ADMIN" | "SUPERVISOR" | "OPERATOR";
  active: boolean;
  serviceIds: number[]; // evita operadores sin permisos
};

export type UpdateOperatorPayload = Partial<Omit<CreateOperatorPayload, "password" | "serviceIds">> & {
  password?: string;
  serviceIds?: number[];
};

export type AssignOperatorServicesPayload = { serviceIds: number[] };
export type AssignServiceOperatorsPayload = { operatorIds: number[] };

export type RoleWithPermissions = {
  id?: number;
  slug: string;
  name?: string;
  description?: string | null;
  permissions: Permission[];
  createdAt?: string;
  updatedAt?: string;
};

export type PermissionDefinition = {
  id?: number;
  slug: Permission;
  name: string;
  description: string | null;
  module?: string;
  moduleLabel?: string;
  order?: number;
};

/* ======================
 * Manejo de errores HTTP
 * ====================== */
export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: any) {
    super(message);
  }
}

type RequestOptions = {
  expectedOk?: number[];
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Override de token por request; si no viene, usa el token global */
  authToken?: string;
  /** Timeout en ms (default configurable) */
  timeoutMs?: number;
};

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const API_BASE_FALLBACK = resolveApiBaseUrl();
const DEFAULT_TIMEOUT_MS = parsePositiveInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS, 15000);
const HEALTHCHECK_PATH_ENV = process.env.NEXT_PUBLIC_API_HEALTHCHECK_PATH?.trim();
const API_HEALTHCHECK_PATH = HEALTHCHECK_PATH_ENV
  ? HEALTHCHECK_PATH_ENV.startsWith("/")
    ? HEALTHCHECK_PATH_ENV
    : `/${HEALTHCHECK_PATH_ENV}`
  : "/api/health";
const API_HEALTHCHECK_TIMEOUT_MS = parsePositiveInt(
  process.env.NEXT_PUBLIC_API_HEALTHCHECK_TIMEOUT_MS,
  5000,
);

let envModeWarningShown = false;
let connectivityCheckBase: string | null = null;

function warnIfApiMisconfigured(base: string, rawApiUrl: string | undefined) {
  if (typeof window === "undefined") return;

  if (!envModeWarningShown) {
    envModeWarningShown = true;
    const rawMode = process.env.NEXT_PUBLIC_API_MODE;
    if (!rawMode || !/^\s*(1|true|on|yes)\s*$/i.test(rawMode)) {
      console.warn(
        "[api-client] NEXT_PUBLIC_API_MODE está deshabilitado o indefinido. Configúralo en frontend/.env.local con 'true' para usar el backend real.",
      );
    }
  }

  if (!rawApiUrl || rawApiUrl.trim().length === 0) {
    console.error(
      "[api-client] NEXT_PUBLIC_API_URL está vacío o indefinido. Configura un endpoint accesible desde el navegador en frontend/.env.local.",
    );
  }

  if (connectivityCheckBase === base) return;
  connectivityCheckBase = base;

  const target = `${base}${API_HEALTHCHECK_PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_HEALTHCHECK_TIMEOUT_MS);

  fetch(target, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok) {
        console.error(
          `[api-client] Healthcheck respondió HTTP ${res.status} para ${target}. Revisa la configuración del backend o las reglas de CORS.`,
        );
      } else {
        console.info(`[api-client] Backend accesible en ${base}.`);
      }
    })
    .catch((error) => {
      if ((error as any)?.name === "AbortError") {
        console.error(
          `[api-client] Tiempo de espera agotado al verificar ${target}. Ajusta NEXT_PUBLIC_API_URL o incrementa NEXT_PUBLIC_API_HEALTHCHECK_TIMEOUT_MS.`,
        );
      } else {
        console.error(`[api-client] No fue posible contactar ${target}.`, error);
      }
    })
    .finally(() => {
      clearTimeout(timer);
    });
}

/* ======================
 * Utilidades internas
 * ====================== */

/**
 * Algunos endpoints de operadores devolvieron objetos wrapper como
 * `{ data: [...] }`, `{ items: [...] }` o inclusive `{ data: { items: [...] } }`.
 * El frontend históricamente espera un array llano, por lo que esta helper
 * intenta extraer el primer arreglo disponible.
 */
function extractList<T>(payload: any): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];

  const candidates: any[] = [
    payload?.data,
    payload?.items,
    payload?.result,
    payload?.results,
    payload?.operators,
    payload?.data?.data,
    payload?.data?.items,
    payload?.data?.result,
    payload?.data?.results,
    payload?.data?.operators,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as T[];
  }

  if (typeof payload === "object") {
    for (const value of Object.values(payload)) {
      if (Array.isArray(value)) return value as T[];
    }
  }

  return [];
}

function normalizeAuthLoginPayload(payload: any): { token: string | null; user: any | null } {
  const visited = new Set<any>();
  const queue: any[] = [];

  const enqueue = (candidate: any) => {
    if (!candidate || typeof candidate !== "object") return;
    if (visited.has(candidate)) return;
    visited.add(candidate);
    queue.push(candidate);
  };

  enqueue(payload);

  const nestedKeys = ["data", "payload", "result", "results", "response", "body", "value"];
  let token: string | null = null;
  let user: any = null;

  while (queue.length > 0 && (!token || !user)) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;

    const maybeUser =
      (current as any).user ??
      (current as any).operator ??
      (current as any).account ??
      (current as any).usuario ??
      null;
    if (user == null && maybeUser != null) {
      user = maybeUser;
    }

    const maybeToken =
      (current as any).token ??
      (current as any).access_token ??
      (current as any).accessToken ??
      (current as any).jwt ??
      (current as any).jwtToken ??
      (current as any).authToken ??
      null;

    if (token == null && maybeToken != null) {
      if (typeof maybeToken === "string") {
        token = maybeToken;
      } else if (maybeToken && typeof maybeToken === "object") {
        const objectToken =
          (maybeToken as any).token ??
          (maybeToken as any).value ??
          (maybeToken as any).access_token ??
          (maybeToken as any).accessToken ??
          null;
        token = typeof objectToken === "string" ? objectToken : null;
      }
    }

    for (const key of nestedKeys) {
      const next = (current as any)[key];
      if (Array.isArray(next)) {
        for (const item of next) enqueue(item);
      } else {
        enqueue(next);
      }
    }
  }

  return { token, user };
}

export const PERMISSION_CANONICAL: Permission[] = [
  "view_dashboard",
  "manage_clients",
  "view_reports",
  "manage_settings",
  "manage_services",
  "manage_operators",
  "manage_roles",
  "call_tickets",
  "view_system_logs",
];

export const PERMISSION_ALIAS_MAP: Record<string, Permission> = {
  serve_tickets: "call_tickets",
  "serve-tickets": "call_tickets",
  servetickets: "call_tickets",
  "call-tickets": "call_tickets",
  calltickets: "call_tickets",
};
for (const permission of PERMISSION_CANONICAL) {
  PERMISSION_ALIAS_MAP[permission] = permission;
}

const PERMISSION_SERIALIZE_MAP: Record<Permission, string> = {
  view_dashboard: "view_dashboard",
  manage_clients: "manage_clients",
  view_reports: "view_reports",
  manage_settings: "manage_settings",
  manage_services: "manage_services",
  manage_operators: "manage_operators",
  manage_roles: "manage_roles",
  call_tickets: "serve_tickets",
  view_system_logs: "view_system_logs",
};

const DEFAULT_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    slug: "view_dashboard",
    name: "Ver panel principal",
    description: "Accede al panel general con métricas y estado en tiempo real.",
    module: "dashboard",
    moduleLabel: "Panel principal",
    order: 10,
  },
  {
    slug: "call_tickets",
    name: "Llamar turnos",
    description: "Opera el llamador para atender tickets y gestionar la fila.",
    module: "ticketing",
    moduleLabel: "Gestión de turnos",
    order: 20,
  },
  {
    slug: "manage_clients",
    name: "Gestionar clientes",
    description: "Permite crear, editar y buscar registros de clientes.",
    module: "clients",
    moduleLabel: "Clientes",
    order: 30,
  },
  {
    slug: "view_reports",
    name: "Ver reportes",
    description: "Autoriza el acceso a informes, métricas históricas y analíticas.",
    module: "reports",
    moduleLabel: "Reportes",
    order: 40,
  },
  {
    slug: "manage_services",
    name: "Gestionar servicios",
    description: "Permite crear, editar y configurar los servicios disponibles.",
    module: "services",
    moduleLabel: "Servicios",
    order: 50,
  },
  {
    slug: "manage_operators",
    name: "Gestionar operadores",
    description: "Habilita la administración de operadores y sus asignaciones.",
    module: "operators",
    moduleLabel: "Operadores",
    order: 60,
  },
  {
    slug: "manage_roles",
    name: "Administrar roles y permisos",
    description: "Permite crear roles y definir la matriz de permisos correspondiente.",
    module: "roles",
    moduleLabel: "Roles y permisos",
    order: 70,
  },
  {
    slug: "manage_settings",
    name: "Administrar configuración",
    description: "Accede a la configuración general y ajustes avanzados del sistema.",
    module: "settings",
    moduleLabel: "Configuración",
    order: 80,
  },
  {
    slug: "view_system_logs",
    name: "Ver registros del sistema",
    description: "Consulta el historial de auditoría y eventos críticos del sistema.",
    module: "audit",
    moduleLabel: "Auditoría",
    order: 90,
  },
];

function mergePermissionDefinitions(list: PermissionDefinition[]): PermissionDefinition[] {
  const merged = new Map<Permission, PermissionDefinition>();

  for (const definition of DEFAULT_PERMISSION_DEFINITIONS) {
    merged.set(definition.slug, { ...definition });
  }

  for (const definition of list) {
    const current = merged.get(definition.slug);
    if (current) {
      merged.set(definition.slug, {
        ...current,
        ...definition,
        slug: definition.slug,
        name: definition.name || current.name,
        description: definition.description ?? current.description ?? null,
        module: definition.module || current.module,
        moduleLabel: definition.moduleLabel || current.moduleLabel,
        order: definition.order ?? current.order,
      });
    } else {
      merged.set(definition.slug, {
        ...definition,
        name: definition.name || definition.slug,
        description: definition.description ?? null,
      });
    }
  }

  return Array.from(merged.values()).sort((a, b) => {
    const orderDiff = (a.order ?? 1000) - (b.order ?? 1000);
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" });
  });
}

export function normalizePermissionSlug(value: any): Permission | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return PERMISSION_ALIAS_MAP[normalized] ?? null;
}

function serializePermissionArray(list: Permission[] | null | undefined): string[] {
  if (!Array.isArray(list)) return [];
  const serialized = list
    .map((permission) => PERMISSION_SERIALIZE_MAP[permission] ?? permission)
    .map((slug) => String(slug ?? "").toLowerCase())
    .filter((slug) => slug);
  return Array.from(new Set(serialized));
}

export function normalizePermissionArray(value: any): Permission[] {
  if (!value) return [];
  const raw = Array.isArray(value) ? value : extractList<any>(value);
  return raw
    .map((item) => normalizePermissionSlug(item))
    .filter((item): item is Permission => item !== null);
}

function resolvePermissionsFromPayload(payload: any): Permission[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return normalizePermissionArray(payload);
  if (typeof payload !== "object") return [];

  const direct = normalizePermissionArray((payload as any).permissions);
  if (direct.length > 0) return direct;

  const candidates = ["data", "result", "user", "operator", "items", "value"] as const;
  for (const key of candidates) {
    if (key in (payload as any)) {
      const nested = resolvePermissionsFromPayload((payload as any)[key]);
      if (nested.length > 0) return nested;
    }
  }

  return [];
}

function normalizeRoleWithPermissions(entry: any): RoleWithPermissions | null {
  if (!entry || typeof entry !== "object") return null;
  const slug = typeof entry.slug === "string" ? entry.slug : typeof entry.name === "string" ? entry.name : null;
  if (!slug) return null;

  const permissions = normalizePermissionArray((entry as any).permissions);

  return {
    id: typeof entry.id === "number" ? entry.id : Number.isFinite(Number(entry.id)) ? Number(entry.id) : undefined,
    slug,
    name: typeof entry.name === "string" ? entry.name : slug,
    description: typeof entry.description === "string" ? entry.description : null,
    permissions,
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : undefined,
    updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : undefined,
  };
}

function normalizePermissionDefinition(entry: any): PermissionDefinition | null {
  if (!entry || typeof entry !== "object") return null;
  const slug = normalizePermissionSlug((entry as any).slug ?? (entry as any).name);
  if (!slug) return null;

  return {
    id: typeof entry.id === "number" ? entry.id : Number.isFinite(Number(entry.id)) ? Number(entry.id) : undefined,
    slug,
    name: typeof entry.name === "string" ? entry.name : slug,
    description: typeof entry.description === "string" ? entry.description : null,
    module: typeof (entry as any).module === "string" ? (entry as any).module : undefined,
    moduleLabel: typeof (entry as any).moduleLabel === "string" ? (entry as any).moduleLabel : undefined,
    order: Number.isFinite(Number((entry as any).order)) ? Number((entry as any).order) : undefined,
  };
}

/* ======================
 * Cliente HTTP
 * ====================== */
class ApiClient {
  /** Token global para Authorization: Bearer <token> */
  private authToken: string | null = null;

  setAuthToken(token: string | null) {
    this.authToken = token ?? null;
  }

  private normalizeBase(raw?: string) {
    // Lee múltiples variantes por compatibilidad
    const rawApiUrl = process.env.NEXT_PUBLIC_API_URL;
    const env =
      raw ??
      (typeof process !== "undefined"
        ? process.env.NEXT_PUBLIC_API_BASE_URL ||
          rawApiUrl ||
          process.env.NEXT_PUBLIC_API
        : undefined);

    // Por convención, usá SIEMPRE el endpoint del backend (no la URL del front)
    // Ej: https://drizatx-main-production.up.railway.app
    // Fallback local coherente con Nest (3001)
    const base = (env ?? API_BASE_FALLBACK).replace(/\/$/, "");
    // Evitar doble /api al componer paths
    const normalized = base.replace(/\/api$/, "");
    if (typeof window !== "undefined") console.debug("[api-base]", normalized);
    warnIfApiMisconfigured(normalized, rawApiUrl);
    return normalized;
  }

  private ensureApiPath(path: string) {
    return path.startsWith("/api/") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  }

  private async parseJsonSafe(res: Response) {
    try {
      return await res.json();
    } catch {
      return null as any;
    }
  }

  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    path: string,
    body?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      expectedOk = [200, 201],
      signal,
      headers,
      authToken,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    } = options;

    const base = this.normalizeBase();
    const url = `${base}${this.ensureApiPath(path)}`;
    if (typeof window !== "undefined") console.debug("[api-request]", { method, url, body });

    const effectiveToken = authToken ?? this.authToken;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(headers ?? {}),
        ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
      },
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      signal: signal ?? controller.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };

    try {
      const res = await fetch(url, init);
      const ok = expectedOk.includes(res.status);
      const data = await this.parseJsonSafe(res);

      if (!ok) {
        const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
        throw new ApiError(res.status, typeof msg === "string" ? msg : JSON.stringify(msg), data);
      }
      return data as T;
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new ApiError(408, "Tiempo de espera agotado al contactar el backend");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  public async download(path: string, options: RequestOptions = {}): Promise<Blob> {
    const { signal, headers, authToken, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
    const base = this.normalizeBase();
    const url = `${base}${this.ensureApiPath(path)}`;
    const effectiveToken = authToken ?? this.authToken;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const init: RequestInit = {
      method: "GET",
      headers: {
        ...(headers ?? {}),
        ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
      },
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      signal: signal ?? controller.signal,
    };

    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        throw new ApiError(res.status, `HTTP ${res.status}`);
      }
      return await res.blob();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new ApiError(408, "Tiempo de espera agotado al descargar datos del backend");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ======================
   * ⚙️ Wrappers genéricos (GET/POST/PUT/PATCH/DELETE)
   * ====================== */
  public get<T = any>(path: string, options?: RequestOptions) {
    return this.request<T>("GET", path, undefined, options);
  }
  public post<T = any>(path: string, body?: any, options?: RequestOptions) {
    return this.request<T>("POST", path, body, options);
  }
  public put<T = any>(path: string, body?: any, options?: RequestOptions) {
    return this.request<T>("PUT", path, body, options);
  }
  public patch<T = any>(path: string, body?: any, options?: RequestOptions) {
    return this.request<T>("PATCH", path, body, options);
  }
  public delete<T = any>(path: string, options?: RequestOptions) {
    return this.request<T>("DELETE", path, undefined, options);
  }

  private serializeCustomMessagePayload(
    payload: CreateCustomMessagePayload | UpdateCustomMessagePayload,
  ): Record<string, any> {
    const toIso = (value?: string | Date | null) => {
      if (value === undefined) return undefined;
      if (value === null || value === '') return null;
      if (value instanceof Date) return value.toISOString();
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
    };

    const normalized: Record<string, any> = { ...payload };
    const start = toIso(payload.startDate);
    const end = toIso(payload.endDate);
    if (start !== undefined) normalized.startDate = start;
    if (end !== undefined) normalized.endDate = end;
    if (payload.active !== undefined) {
      normalized.active = payload.active === true || payload.active === 1;
    }
    if (
      payload.priority !== undefined &&
      typeof payload.priority !== 'number'
    ) {
      const asNumber = Number(payload.priority);
      if (!Number.isNaN(asNumber)) normalized.priority = asNumber;
    }
    return normalized;
  }

  /* ======================
   * Diagnóstico
   * ====================== */
  async ping(): Promise<any> {
    return this.request<any>("GET", "/api/health", undefined, { expectedOk: [200, 204] });
  }

  /* ======================
   * Services
   * ====================== */
  async getServices(): Promise<Service[]> {
    try {
      const data = await this.request<Service[]>("GET", "/api/services", undefined, { expectedOk: [200, 201, 204] });
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return [];
      throw err;
    }
  }

  async createService(data: Omit<Service, "id" | "createdAt" | "updatedAt">): Promise<Service> {
    try {
      return await this.request<Service>("POST", "/api/services", data);
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Crear servicio no implementado en API", err.details);
      }
      throw err;
    }
  }

  async updateService(id: number, data: Partial<Service>): Promise<Service> {
    try {
      return await this.request<Service>("PUT", `/api/services/${id}`, data);
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Actualizar servicio no implementado en API", err.details);
      }
      throw err;
    }
  }

  async deleteService(id: number): Promise<{ deleted: boolean }> {
    try {
      await this.request<any>("DELETE", `/api/services/${id}`, undefined, { expectedOk: [200, 201, 204] });
      return { deleted: true };
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Eliminar servicio no implementado en API", err.details);
      }
      throw err;
    }
  }

  /* ======================
   * System Settings
   * ====================== */
  async getSystemSettings(): Promise<SystemSetting[]> {
    try {
      const data = await this.request<SystemSetting[]>(
        "GET",
        "/api/system-settings",
        undefined,
        { expectedOk: [200, 201, 204] },
      );
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return [];
      throw err;
    }
  }

  async getPublicSystemSettings(): Promise<SystemSetting[]> {
    try {
      const data = await this.request<SystemSetting[]>(
        "GET",
        "/api/display/public/system-settings",
        undefined,
        { expectedOk: [200, 201, 204] },
      );
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return [];
      throw err;
    }
  }

  async upsertSystemSetting(
    key: string,
    value: string,
    description?: string | null,
  ): Promise<SystemSetting> {
    try {
      return await this.request<SystemSetting>(
        "POST",
        `/api/system-settings/${encodeURIComponent(key)}`,
        { value, description: description ?? null },
      );
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Guardar configuración no está disponible en la API", err.details);
      }
      throw err;
    }
  }

  async updateSystemSetting(id: number, data: Partial<SystemSetting>): Promise<SystemSetting> {
    try {
      return await this.request<SystemSetting>("PUT", `/api/system-settings/${id}`, data);
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Actualizar configuración no está disponible en la API", err.details);
      }
      throw err;
    }
  }

  /* ======================
   * Audit logs
   * ====================== */
  async getAuditLogs(
    params: AuditLogListParams = {},
    options: RequestOptions = {},
  ): Promise<AuditLogListResponse> {
    const search = new URLSearchParams();

    if (params.page) search.set('page', String(params.page));
    if (params.limit) search.set('limit', String(params.limit));
    if (params.severity) search.set('severity', params.severity);
    if (params.search) search.set('search', params.search);
    if (params.actorId) search.set('actorId', String(params.actorId));
    if (params.from) search.set('from', params.from);
    if (params.to) search.set('to', params.to);

    const query = search.toString();
    const path = query ? `/api/audit-logs?${query}` : '/api/audit-logs';

    const response = await this.request<AuditLogListResponse>(
      'GET',
      path,
      undefined,
      { expectedOk: [200], ...options },
    );

    const data = Array.isArray(response?.data) ? response.data : [];
    const meta = this.normalizeAuditMeta(response?.meta);

    return { data, meta };
  }

  private normalizeAuditMeta(meta?: Partial<AuditLogListMeta> | null): AuditLogListMeta {
    const base: Record<AuditLogSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };

    const normalizeNumber = (value: unknown, fallback: number) =>
      Number.isFinite(Number(value)) ? Number(value) : fallback;

    const severityTotals = {
      ...base,
      ...(meta?.severityTotals ?? {}),
    } as Record<AuditLogSeverity, number>;

    const severityTotalsAll = {
      ...base,
      ...(meta?.severityTotalsAll ?? {}),
    } as Record<AuditLogSeverity, number>;

    return {
      page: normalizeNumber(meta?.page, 1),
      limit: normalizeNumber(meta?.limit, 25),
      total: normalizeNumber(meta?.total, 0),
      filtered: normalizeNumber(meta?.filtered, 0),
      pageCount: Math.max(1, normalizeNumber(meta?.pageCount, 1)),
      hasNext: Boolean(meta?.hasNext),
      hasPrevious: Boolean(meta?.hasPrevious),
      severityTotals,
      severityTotalsAll,
      actorTotals: {
        total: normalizeNumber(meta?.actorTotals?.total, 0),
        filtered: normalizeNumber(meta?.actorTotals?.filtered, 0),
      },
    };
  }

  async deleteSystemSetting(id: number): Promise<void> {
    try {
      await this.request<void>("DELETE", `/api/system-settings/${id}`, undefined, { expectedOk: [200, 201, 204] });
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Eliminar configuración no está disponible en la API", err.details);
      }
      throw err;
    }
  }

  /* ======================
   * Backups
   * ====================== */
  async triggerBackup(data?: { directory?: string }): Promise<BackupTriggerResponse> {
    try {
      return await this.request<BackupTriggerResponse>("POST", "/api/backups", data ?? {});
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw new ApiError(err.status, err.message || "No se pudo generar el respaldo", err.details);
      }
      throw err;
    }
  }

  async getBackupStatus(): Promise<BackupStatus> {
    try {
      return await this.request<BackupStatus>("GET", "/api/backups/status", undefined, { expectedOk: [200] });
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw new ApiError(err.status, err.message || "No se pudo obtener el estado de respaldos", err.details);
      }
      throw err;
    }
  }

  async listBackupDirectories(path?: string): Promise<BackupDirectoryListing> {
    try {
      const query = path?.trim() ? `?path=${encodeURIComponent(path.trim())}` : "";
      return await this.request<BackupDirectoryListing>("GET", `/api/backups/directories${query}`);
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw new ApiError(
          err.status,
          err.message || "No se pudo explorar las carpetas del servidor",
          err.details,
        );
      }
      throw err;
    }
  }

  async createBackupDirectory(path: string): Promise<BackupDirectoryCreateResponse> {
    try {
      return await this.request<BackupDirectoryCreateResponse>("POST", "/api/backups/directories", { path });
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw new ApiError(
          err.status,
          err.message || "No se pudo crear la carpeta solicitada",
          err.details,
        );
      }
      throw err;
    }
  }

  getBackupDownloadUrl(fileName: string): string {
    const base = this.normalizeBase();
    return `${base}/api/backups/files/${encodeURIComponent(fileName)}`;
  }

  /* ======================
   * Operators
   * ====================== */
  async getOperators(): Promise<Operator[]> {
    try {
      const data = await this.request<Operator[]>("GET", "/api/operators", undefined, { expectedOk: [200, 201, 204] });
      return extractList<Operator>(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return [];
      throw err;
    }
  }

  async getOperatorsWithStatus(): Promise<OperatorWithStatus[]> {
    try {
      const data = await this.request<OperatorWithStatus[]>(
        "GET",
        "/api/operators/with-status",
        undefined,
        { expectedOk: [200, 201, 204] }
      );
      return extractList<OperatorWithStatus>(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return [];
      throw err;
    }
  }

  async getOperatorsActive(): Promise<Operator[]> {
    try {
      const data = await this.request<Operator[]>("GET", "/api/operators/active", undefined, { expectedOk: [200, 201, 204] });
      return extractList<Operator>(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return [];
      throw err;
    }
  }

  async getOperator(id: number): Promise<Operator> {
    return this.request<Operator>("GET", `/api/operators/${id}`);
  }

  async getOperatorWithStatus(id: number): Promise<OperatorWithStatus> {
    return this.request<OperatorWithStatus>("GET", `/api/operators/${id}/with-status`);
  }

  async getOperatorAvailabilityStatus(id: number): Promise<OperatorWithStatus> {
    return this.getOperatorWithStatus(id);
  }

  async updateOperatorAvailabilityStatus(
    id: number,
    status: OperatorAvailabilityStatus,
  ): Promise<OperatorWithStatus> {
    try {
      return await this.request<OperatorWithStatus>(
        "PATCH",
        `/api/operators/${id}/status`,
        { status },
        { expectedOk: [200, 201, 204] },
      );
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(
          err.status,
          "Actualizar disponibilidad no está disponible en la API",
          err.details,
        );
      }
      throw err;
    }
  }

  async getOperatorAttentionMetrics(
    id: number,
    params?: OperatorAttentionMetricsQuery,
  ): Promise<OperatorAttentionMetrics> {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set('period', params.period);
    if (params?.date) searchParams.set('date', params.date);
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    if (params?.statuses?.length) {
      const encoded = params.statuses
        .map((status) => status.toString().trim())
        .filter((value) => value.length > 0);
      if (encoded.length) {
        searchParams.set('statuses', encoded.join(','));
      }
    }
    if (typeof params?.limit === 'number') {
      searchParams.set('limit', String(params.limit));
    }
    if (params?.serviceId !== undefined && params.serviceId !== null) {
      searchParams.set('serviceId', String(params.serviceId));
    }
    const query = searchParams.toString();
    const path = query
      ? `/api/operators/${id}/attention-metrics?${query}`
      : `/api/operators/${id}/attention-metrics`;
    return this.request<OperatorAttentionMetrics>('GET', path);
  }

  async getOperatorShiftHistory(
    id: number,
    params?: { period?: 'day' | 'week' | 'month' | 'all'; date?: string; from?: string; to?: string },
  ): Promise<OperatorShiftHistory> {
    const searchParams = new URLSearchParams();
    if (params?.period) searchParams.set('period', params.period);
    if (params?.date) searchParams.set('date', params.date);
    if (params?.from) searchParams.set('from', params.from);
    if (params?.to) searchParams.set('to', params.to);
    const query = searchParams.toString();
    const path = query ? `/api/operators/${id}/shifts?${query}` : `/api/operators/${id}/shifts`;
    return this.request<OperatorShiftHistory>('GET', path);
  }

  async getOperatorServices(
    operatorId: number
  ): Promise<{ operatorId: number; services: Array<{ id: number; name: string; prefix?: string; active: boolean | number }> }> {
    return this.request("GET", `/api/operators/${operatorId}/services`);
  }

  // Crear operador con serviceIds (igual a tu prueba de Swagger)
  async createOperator(payload: CreateOperatorPayload): Promise<Operator> {
    return this.request<Operator>("POST", "/api/operators", payload);
  }

  // Actualizar operador
  async updateOperator(id: number, payload: UpdateOperatorPayload): Promise<Operator> {
    try {
      return await this.request<Operator>("PUT", `/api/operators/${id}`, payload, { expectedOk: [200] });
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Actualizar operador no implementado en API", err.details);
      }
      throw err;
    }
  }

  async deleteOperator(id: number): Promise<void> {
    try {
      await this.request("DELETE", `/api/operators/${id}`, undefined, { expectedOk: [200, 204] });
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Eliminar operador no está disponible en la API", err.details);
      }
      throw err;
    }
  }

  async assignOperatorServices(
    operatorId: number,
    payload: AssignOperatorServicesPayload
  ): Promise<{ ok: true }> {
    try {
      await this.request("PUT", `/api/operators/${operatorId}/services`, payload, { expectedOk: [200] });
      return { ok: true };
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Asignación de servicios no implementada en API", err.details);
      }
      throw err;
    }
  }

  async assignServiceOperators(
    serviceId: number,
    payload: AssignServiceOperatorsPayload,
  ): Promise<{ ok: true }> {
    try {
      await this.request("PUT", `/api/services/${serviceId}/operators`, payload, { expectedOk: [200] });
      return { ok: true };
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Asignación de operadores no implementada en API", err.details);
      }
      throw err;
    }
  }

  // ✅ NUEVO: cambiar contraseña de un operador (ADMIN-only en backend)
  async updateOperatorPassword(
    operatorId: number,
    password: string
  ): Promise<{ id: number; updated: boolean } | any> {
    return this.request("PATCH", `/api/operators/${operatorId}/password`, { password }, { expectedOk: [200] });
  }

  /* ======================
   * Clients
   * ====================== */
  async getClients(): Promise<Client[]> {
    try {
      const data = await this.request<any>("GET", "/api/clients", undefined, { expectedOk: [200, 201, 204] });
      const list = extractList<Client>(data);
      return Array.isArray(list) ? list : [];
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return [];
      throw err;
    }
  }

  async createClient(payload: CreateClientPayload): Promise<Client> {
    return this.request<Client>("POST", "/api/clients", payload, { expectedOk: [200, 201] });
  }

  async updateClient(id: number, payload: UpdateClientPayload): Promise<Client> {
    try {
      return await this.request<Client>("PUT", `/api/clients/${id}`, payload, { expectedOk: [200] });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw new ApiError(404, "Cliente no encontrado", err.details);
      }
      throw err;
    }
  }

  async deleteClient(id: number): Promise<{ ok: true }> {
    try {
      await this.request("DELETE", `/api/clients/${id}`, undefined, { expectedOk: [200, 204] });
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        throw new ApiError(404, "Cliente no encontrado", err.details);
      }
      throw err;
    }
  }

  async getClientByDni(dni: string): Promise<Client | null> {
    if (!dni?.trim()) {
      throw new ApiError(400, "DNI requerido");
    }

    try {
      const data = await this.request<Client | null>("GET", `/api/clients/dni/${encodeURIComponent(dni)}`, undefined, {
        expectedOk: [200, 204],
      });
      return data ?? null;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return null;
      throw err;
    }
  }

  async getClientByDniPublic(dni: string): Promise<PublicClientResponse | null> {
    if (!dni?.trim()) return null;

    try {
      const data = await this.request<PublicClientResponse | null>(
        "GET",
        `/api/clients/public/dni/${encodeURIComponent(dni)}`,
        undefined,
        { expectedOk: [200, 204] },
      );
      return data ?? null;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return null;
      throw err;
    }
  }

  async searchClients(query: string): Promise<Client[]> {
    if (!query?.trim()) return [];

    try {
      const data = await this.request<any>(
        "GET",
        `/api/clients?q=${encodeURIComponent(query.trim())}`,
        undefined,
        { expectedOk: [200, 201, 204] },
      );
      const list = extractList<Client>(data);
      return Array.isArray(list) ? list : [];
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return [];
      throw err;
    }
  }

  async bulkCreateClients(payload: CreateClientPayload[]): Promise<Client[]> {
    try {
      const data = await this.request<any>("POST", "/api/clients/bulk", { clients: payload }, {
        expectedOk: [200, 201, 204],
      });
      const list = extractList<Client>(data);
      return Array.isArray(list) ? list : [];
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return [];
      if (err instanceof ApiError && (err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Importación masiva no disponible en la API", err.details);
      }
      throw err;
    }
  }

  async getClientHistory(id: number): Promise<ClientHistoryResponse> {
    return this.request<ClientHistoryResponse>("GET", `/api/clients/${id}/history`, undefined, {
      expectedOk: [200],
    });
  }

    /* ======================
   * Tickets
   * ====================== */
  // Tu backend expone POST /api/tickets/:serviceId
  async createTicket(serviceId: number, body?: CreateTicketBody): Promise<Ticket>;
  async createTicket(bodyWithServiceId: { serviceId: number } & CreateTicketBody): Promise<Ticket>;
  async createTicket(
    a: number | ({ serviceId: number } & CreateTicketBody),
    b?: CreateTicketBody
  ): Promise<Ticket> {
    let svcId: number;
    let payload: CreateTicketBody;
    if (typeof a === "number") {
      svcId = a;
      payload = b ?? {};
    } else {
      svcId = a.serviceId;
      const { serviceId: _omit, ...rest } = a;
      payload = rest;
    }
    return this.request<Ticket>("POST", `/api/tickets/${svcId}`, payload);
  }

  async getTicket(id: number): Promise<Ticket> {
    return this.request<Ticket>("GET", `/api/tickets/${id}`);
  }

  async registerTicketQrScan(ticketId: number): Promise<Ticket> {
    return this.request<Ticket>("POST", `/api/tickets/${ticketId}/qr-scan`, undefined, { expectedOk: [200] });
  }

  async getAttentionAlerts(): Promise<AttentionAlert[]> {
    try {
      const data = await this.request<AttentionAlert[]>(
        "GET",
        "/api/tickets/alerts/attention",
        undefined,
        { expectedOk: [200, 204] },
      );
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) return [];
      throw err;
    }
  }

  // En tu backend no existe GET /api/tickets → devolvemos [] sin llamar
  async getTickets(): Promise<Ticket[]> {
    return [];
  }

  /* ======================
   * Queue / Call-Next
   * ====================== */

  // 🔹 NUEVO: llamar siguiente ticket según el operador (el backend decide servicio)
  async callNextTicketForOperator(operatorId: number): Promise<Ticket | null> {
    if (!Number.isInteger(operatorId) || operatorId <= 0) {
      throw new ApiError(400, "operatorId inválido");
    }

    try {
      const ticket = await this.request<Ticket>(
        "POST",
        `/api/operators/${operatorId}/call-next`,
        undefined,
        { expectedOk: [200, 201] },
      );
      return ticket;
    } catch (err: any) {
      if (err instanceof ApiError) {
        const raw = `${err.message}`.toLowerCase();

        // Sin permisos para llamar turnos
        if (err.status === 403 || (err.status === 400 && raw.includes("no está habilitado"))) {
          throw new ApiError(
            403,
            "No tenés permisos para llamar turnos. Contactá a un supervisor para habilitar tu usuario.",
            err.details,
          );
        }

        // Cola vacía → devolvemos null (el hook no necesita tratarlo como error)
        if (err.status === 409 || raw.includes("no hay tickets")) {
          return null;
        }

        if (err.status === 404) {
          // Si el endpoint no existe o el operador no existe
          throw new ApiError(404, "Recurso no encontrado", err.details);
        }

        if (err.status === 400) {
          throw new ApiError(400, err.message || "Solicitud inválida", err.details);
        }
      }

      throw new ApiError(500, "Error inesperado al llamar el siguiente ticket");
    }
  }

  // 🔸 Versión anterior (por servicio) — la dejamos por compatibilidad
  async callNextTicket(operatorId: number, serviceId: number): Promise<Ticket> {
    if (!Number.isInteger(operatorId) || operatorId <= 0) {
      throw new ApiError(400, "operatorId inválido");
    }
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      throw new ApiError(400, "serviceId inválido");
    }

    try {
      return await this.request<Ticket>(
        "POST",
        `/api/operators/${operatorId}/call-next/${serviceId}`,
        undefined,
        { expectedOk: [200, 201] }
      );
    } catch (err: any) {
      if (err instanceof ApiError) {
        const raw = `${err.message}`.toLowerCase();
        if (err.status === 403 || (err.status === 400 && raw.includes("no está habilitado"))) {
          throw new ApiError(
            403,
            "No tenés permisos para llamar turnos. Contactá a un supervisor para habilitar tu usuario.",
            err.details,
          );
        }
        if (err.status === 409 || raw.includes("no hay tickets")) {
          throw new ApiError(409, "No hay tickets en espera para este servicio", err.details);
        }
        if (err.status === 404) {
          throw new ApiError(404, "Recurso no encontrado", err.details);
        }
        if (err.status === 400) {
          throw new ApiError(400, err.message || "Solicitud inválida", err.details);
        }
      }
      throw new ApiError(500, "Error inesperado al llamar el siguiente ticket");
    }
  }

  /* ==== NUEVOS ENDPOINTS de ciclo de vida del ticket (PATCH /tickets/:id/...) ==== */
  async startTicket(ticketId: number): Promise<Ticket> {
    return this.request<Ticket>("PATCH", `/api/tickets/${ticketId}/start`, undefined, { expectedOk: [200] });
  }

  async completeTicket(ticketId: number): Promise<Ticket> {
    return this.request<Ticket>("PATCH", `/api/tickets/${ticketId}/complete`, undefined, { expectedOk: [200] });
  }

  async markAbsent(ticketId: number): Promise<Ticket> {
    return this.request<Ticket>("PATCH", `/api/tickets/${ticketId}/absent`, undefined, { expectedOk: [200] });
  }

  async reintegrateTicket(ticketId: number): Promise<Ticket> {
    return this.request<Ticket>("PATCH", `/api/tickets/${ticketId}/reintegrate`, undefined, { expectedOk: [200] });
  }

  async callTicket(ticketId: number, operatorId: number): Promise<Ticket> {
    return this.request<Ticket>(
      "PATCH",
      `/api/tickets/${ticketId}/call`,
      { operatorId },
      { expectedOk: [200] },
    );
  }

  /* ==== Facade para la UI ==== */
  async updateTicketStatus(
    id: number,
    status: "CALLED" | "IN_PROGRESS" | "COMPLETED" | "ABSENT" | "WAITING",
    operatorId?: number,
    _serviceId?: number, // ya no se usa para CALLED, pero lo dejamos por compatibilidad de firma
  ): Promise<Ticket> {
    if (status === "IN_PROGRESS") return this.startTicket(id);
    if (status === "COMPLETED")  return this.completeTicket(id);
    if (status === "ABSENT")     return this.markAbsent(id);
    if (status === "WAITING")    return this.reintegrateTicket(id);

    if (status === "CALLED") {
      if (!operatorId) {
        throw new ApiError(400, "Para CALLED necesitás operatorId");
      }
      // 🔹 ahora llamar un ticket puntual, no el “next”
      return this.callTicket(id, operatorId);
    }

    throw new ApiError(400, "Estado no soportado por API");
  }

  /* ======================
   * Dashboard / Next
   * ====================== */
  async getQueueNext(serviceId: number): Promise<QueueNext> {
    try {
      return await this.request<QueueNext>("GET", `/api/queue/next/${serviceId}`);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }

  async getQueueDashboard(options: { publicMode?: boolean } = {}): Promise<DashboardResponse> {
    const path = options.publicMode ? "/api/queue/public/dashboard" : "/api/queue/dashboard";
    return this.request<DashboardResponse>("GET", path);
  }

  async getPublicServices(): Promise<PublicServiceResponse[]> {
    const data = await this.request<PublicServiceResponse[]>("GET", "/api/queue/public/services");
    return Array.isArray(data) ? data : [];
  }

  async enqueuePublicTicket(payload: {
    serviceId: number;
    clientId?: number | null;
  }): Promise<PublicTicketResponse> {
    return this.request<PublicTicketResponse>(
      "POST",
      "/api/queue/public/enqueue",
      payload,
      { expectedOk: [201, 200] },
    );
  }

  /* ======================
   * Custom Messages
   * ====================== */
  async getCustomMessages(): Promise<CustomMessage[]> {
    try {
      const data = await this.request<CustomMessage[]>(
        "GET",
        "/api/custom-messages",
        undefined,
        { expectedOk: [200, 201, 204] },
      );
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404 || err.status === 501)) {
        console.warn("[api] /api/custom-messages no disponible, devolviendo []");
        return [];
      }
      throw err;
    }
  }

  async getPublicCustomMessages(): Promise<CustomMessage[]> {
    try {
      const data = await this.request<CustomMessage[]>(
        "GET",
        "/api/display/public/custom-messages",
        undefined,
        { expectedOk: [200, 201, 204] },
      );
      return Array.isArray(data) ? data : [];
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 204 || err.status === 404)) {
        return [];
      }
      throw err;
    }
  }

  async createCustomMessage(data: CreateCustomMessagePayload): Promise<CustomMessage> {
    try {
      return await this.request<CustomMessage>(
        "POST",
        "/api/custom-messages",
        this.serializeCustomMessagePayload(data),
      );
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Crear mensaje personalizado no está disponible en la API", err.details);
      }
      throw err;
    }
  }

  async updateCustomMessage(
    id: number,
    data: UpdateCustomMessagePayload,
  ): Promise<CustomMessage> {
    try {
      return await this.request<CustomMessage>(
        "PUT",
        `/api/custom-messages/${id}`,
        this.serializeCustomMessagePayload(data),
      );
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Actualizar mensaje personalizado no está disponible en la API", err.details);
      }
      throw err;
    }
  }

  async deleteCustomMessage(id: number): Promise<{ deleted: boolean }> {
    try {
      await this.request<void>("DELETE", `/api/custom-messages/${id}`, undefined, { expectedOk: [200, 201, 204] });
      return { deleted: true };
    } catch (err: any) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 405 || err.status === 501)) {
        throw new ApiError(err.status, "Eliminar mensaje personalizado no está disponible en la API", err.details);
      }
      throw err;
    }
  }

  /* ======================
   * Auth
   * ====================== */
  async loginWithUsername(
    username: string,
    password: string,
  ): Promise<{ token: string; user: any }> {
    const base = this.normalizeBase();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(`${base}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        mode: "cors",
        credentials: "omit",
        signal: controller.signal,
        cache: "no-store",
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch (jsonError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[api-client] No se pudo parsear la respuesta de login como JSON", jsonError);
        }
      }

      if (!res.ok) {
        const msg =
          (data && (data.message || data.error)) ||
          (res.status === 404 ? "Endpoint no encontrado" : `HTTP ${res.status}`);
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      const { token, user } = normalizeAuthLoginPayload(data);

      if (!token || !user) {
        throw new Error("Respuesta inválida del servidor (falta token o user)");
      }

      return { token, user };
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new Error("Tiempo de espera agotado al contactar el backend");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ======================
   * Access control
   * ====================== */
  async getRolesWithPermissions(): Promise<RoleWithPermissions[]> {
    const primaryEndpoint = "/api/acl/roles";
    const fallbackEndpoints = ["/api/auth/roles", "/api/roles"];
    const endpoints = [primaryEndpoint, ...fallbackEndpoints];
    let primaryError: ApiError | null = null;

    for (const endpoint of endpoints) {
      try {
        const payload = await this.request<any>("GET", endpoint, undefined, { expectedOk: [200] });

        const candidates = [payload, payload?.roles, payload?.data];
        for (const candidate of candidates) {
          const list = extractList<any>(candidate)
            .map((item) => normalizeRoleWithPermissions(item))
            .filter((item): item is RoleWithPermissions => item !== null);
          if (list.length > 0) {
            if (endpoint !== primaryEndpoint && primaryError) {
              console.info(
                `[api] rolesWithPermissions obtenido desde endpoint alternativo ${endpoint} tras ${primaryError.status}.`,
              );
            }
            return list;
          }
        }
      } catch (err: any) {
        if (err instanceof ApiError) {
          if (err.status === 401 || err.status === 403) {
            console.warn(
              `[api] rolesWithPermissions sin autorización (${err.status}), devolviendo [].`,
            );
            return [];
          }
          if ([404, 405, 500, 501].includes(err.status)) {
            if (endpoint === primaryEndpoint) {
              primaryError = err;
            }
            continue;
          }
        }
        throw err;
      }
    }

    if (primaryError) {
      console.warn(
        `[api] rolesWithPermissions no disponible en ${primaryEndpoint} (${primaryError.status}), devolviendo [].`,
      );
    } else {
      console.warn("[api] rolesWithPermissions no disponible, devolviendo []");
    }
    return [];
  }

  async getPermissionsCatalog(): Promise<PermissionDefinition[]> {
    const endpoints = ["/api/acl/permissions", "/api/permissions"];

    for (const endpoint of endpoints) {
      try {
        const payload = await this.request<any>("GET", endpoint, undefined, { expectedOk: [200] });
        const candidates = [payload, payload?.permissions, payload?.data, payload?.items];
        for (const candidate of candidates) {
          const list = extractList<any>(candidate)
            .map((entry) => normalizePermissionDefinition(entry))
            .filter((entry): entry is PermissionDefinition => entry !== null);
          if (list.length > 0) {
            return mergePermissionDefinitions(list);
          }
        }
      } catch (err: any) {
        if (err instanceof ApiError && [404, 405, 500, 501].includes(err.status)) {
          continue;
        }
        throw err;
      }
    }

    return mergePermissionDefinitions([]);
  }

  async createRole(payload: {
    slug: string;
    name: string;
    description?: string | null;
    permissions?: Permission[];
  }): Promise<RoleWithPermissions> {
    const body: Record<string, any> = {
      slug: String(payload.slug ?? "").trim(),
      name: String(payload.name ?? "").trim(),
      description: payload.description ?? null,
    };
    if (Array.isArray(payload.permissions)) {
      body.permissions = serializePermissionArray(payload.permissions);
    }

    const data = await this.request<any>("POST", "/api/acl/roles", body, { expectedOk: [200, 201] });
    const normalized = normalizeRoleWithPermissions(data);
    if (!normalized) {
      throw new Error("Respuesta inválida al crear el rol");
    }
    return normalized;
  }

  async updateRole(
    id: number,
    payload: { slug?: string; name?: string; description?: string | null },
  ): Promise<RoleWithPermissions> {
    const body: Record<string, any> = {};
    if (payload.slug !== undefined) body.slug = String(payload.slug ?? "").trim();
    if (payload.name !== undefined) body.name = String(payload.name ?? "").trim();
    if (payload.description !== undefined) body.description = payload.description ?? null;

    const data = await this.request<any>("PUT", `/api/acl/roles/${id}`, body, { expectedOk: [200] });
    const normalized = normalizeRoleWithPermissions(data);
    if (!normalized) {
      throw new Error("Respuesta inválida al actualizar el rol");
    }
    return normalized;
  }

  async updateRolePermissions(id: number, permissions: Permission[]): Promise<RoleWithPermissions> {
    const body = { permissions: serializePermissionArray(permissions) };
    const data = await this.request<any>("PUT", `/api/acl/roles/${id}/permissions`, body, { expectedOk: [200] });
    const normalized = normalizeRoleWithPermissions(data);
    if (!normalized) {
      throw new Error("Respuesta inválida al actualizar permisos del rol");
    }
    return normalized;
  }

  async getCurrentUserPermissions(): Promise<Permission[]> {
    const endpoints = [
      "/api/auth/me/permissions",
      "/api/auth/me",
      "/api/acl/me/permissions",
    ];

    for (const endpoint of endpoints) {
      try {
        const payload = await this.request<any>("GET", endpoint, undefined, { expectedOk: [200] });
        const permissions = resolvePermissionsFromPayload(payload);
        if (permissions.length > 0) {
          return permissions;
        }
      } catch (err: any) {
        if (err instanceof ApiError && [404, 405, 500, 501].includes(err.status)) {
          continue;
        }
        throw err;
      }
    }

    return [];
  }

  /* ======================
   * Reports
   * ====================== */
  private qs(o: Record<string, any>) {
    return new URLSearchParams(
      Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => [k, String(v)]) // robustez
    ).toString();
  }

  async getReportSummary(filters: {
    from?: string; to?: string;
    serviceId?: number; operatorId?: number;
    ticketNumberFrom?: number; ticketNumberTo?: number;
    granularity?: "hour"|"day";
  }) {
    const query = this.qs(filters);
    return this.request<{
      totals: { total: number; attended: number; cancelled: number; abandoned: number };
      kpis: { tmeSec: number | null; tmaSec: number | null; leadSec: number | null; slaPct: number | null; totalInQueue: number | null; peakBucket: string | null };
      operators: Array<{
        operatorId: number;
        name: string;
        position: string | null;
        role: string | null;
        active: boolean;
        totalTickets: number;
        completedTickets: number;
        cancelledTickets: number;
        abandonedTickets: number;
        serviceCount: number;
        avgWaitSec: number | null;
        avgHandleSec: number | null;
        avgLeadSec: number | null;
        totalWaitSec: number | null;
        totalHandleSec: number | null;
        throughputPerHour: number | null;
        occupancyPct: number | null;
        attendanceRatePct: number | null;
        firstActivityAt: string | null;
        lastActivityAt: string | null;
      }>;
    }>("GET", `/api/reports/summary?${query}`, undefined, { expectedOk: [200] });
  }

  async getReportThroughput(filters: {
    from?: string; to?: string;
    serviceId?: number; operatorId?: number;
    ticketNumberFrom?: number; ticketNumberTo?: number;
    granularity?: "hour"|"day";
  }) {
    const query = this.qs(filters);
    return this.request<Array<{ bucket: string; attended: number; avgWaitSec: number }>>(
      "GET", `/api/reports/throughput?${query}`, undefined, { expectedOk: [200] }
    );
  }

  async createReportSnapshot(payload: {
    type: 'summary'|'throughput'|'weekly'|'services_distribution'|'operators_performance';
    from?: string; to?: string; serviceId?: number; operatorId?: number;
    ticketNumberFrom?: number; ticketNumberTo?: number; granularity?: 'hour'|'day';
  }) {
    return this.request<any>("POST", `/api/reports/snapshots`, payload, { expectedOk: [201, 200] });
  }

  async listReportSnapshots(filters: {
    type?: string; from?: string; to?: string; serviceId?: number; operatorId?: number;
    ticketNumberFrom?: number; ticketNumberTo?: number; limit?: number; offset?: number;
  }) {
    const query = this.qs(filters);
    return this.request<{ total: number; items: any[] }>(
      "GET", `/api/reports/snapshots?${query}`, undefined, { expectedOk: [200] }
    );
  }

  exportReportsCsvUrl(filters: {
    from?: string; to?: string;
    serviceId?: number; operatorId?: number;
    ticketNumberFrom?: number; ticketNumberTo?: number;
    granularity?: "hour"|"day";
  }) {
    const base = this.normalizeBase();
    const query = this.qs(filters);
    return `${base}/api/reports/export.csv?${query}`;
  }

  exportReportsXlsxUrl(filters: {
    from?: string; to?: string;
    serviceId?: number; operatorId?: number;
    ticketNumberFrom?: number; ticketNumberTo?: number;
    granularity?: "hour"|"day";
  }) {
    const base = this.normalizeBase();
    const query = this.qs(filters);
    return `${base}/api/reports/export.xlsx?${query}`;
  }
}

/* ======================
 * Singleton export
 * ====================== */
export const apiClient = new ApiClient();
