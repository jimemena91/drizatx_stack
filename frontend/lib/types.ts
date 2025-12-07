// =======================
// Enums
// =======================
export enum Status {
  WAITING = "WAITING",
  CALLED = "CALLED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  ABSENT = "ABSENT", // clientes ausentes
}

export enum Role {
  SUPERADMIN = "SUPERADMIN",
  OPERATOR = "OPERATOR",
  SUPERVISOR = "SUPERVISOR",
  ADMIN = "ADMIN",
}

export type Permission =
  | "view_dashboard"
  | "manage_clients"
  | "view_reports"
  | "manage_settings"
  | "manage_services"
  | "manage_operators"
  | "call_tickets"
  | "view_system_logs"
  | "manage_roles";

// =======================
// Modelos base
// =======================
export interface Client {
  id: number
  dni: string
  name: string
  email?: string | null
  phone?: string | null
  vip?: boolean
  createdAt: string | Date
  updatedAt: string | Date
}

export interface ClientVisitHistoryItem {
  ticketId: number
  ticketNumber: string
  status: Status | string
  serviceId: number | null
  serviceName: string | null
  operatorId: number | null
  operatorName: string | null
  createdAt: string | Date
  calledAt: string | Date | null
  startedAt: string | Date | null
  completedAt: string | Date | null
}

export interface ClientHistory {
  client: Client
  totalVisits: number
  lastVisitAt: string | Date | null
  lastTicketNumber: string | null
  lastOperator: { id: number | null; name: string | null } | null
  lastService: { id: number | null; name: string | null } | null
  history: ClientVisitHistoryItem[]
}

// Mensajes personalizados (cartelería/display)
export interface CustomMessage {
  id: number
  title: string
  content: string
  type: "info" | "warning" | "promotion" | "announcement"
  active: boolean
  priority: number
  startDate?: string | Date | null
  endDate?: string | Date | null
  mediaUrl?: string | null
  mediaType?: string | null
  displayDurationSeconds?: number | null
  activeDays?: string[] | null
  createdAt: string | Date
  updatedAt: string | Date
}

export type AuditLogSeverity = "low" | "medium" | "high" | "critical"

export interface AuditLogChange {
  field: string
  before?: string | number | boolean | null
  after?: string | number | boolean | null
}

export interface AuditLogActor {
  id: number | null
  name: string | null
  username?: string | null
  email?: string | null
  role?: string | null
  roles?: string[] | null
}

export interface AuditLogRecord {
  id: number
  eventType: string
  action: string
  target: string | null
  description: string | null
  severity: AuditLogSeverity
  timestamp: string
  ip: string | null
  source: string | null
  tags: string[]
  changes: AuditLogChange[]
  metadata: Record<string, any> | null
  actor: AuditLogActor | null
}

export interface AuditLogListMeta {
  page: number
  limit: number
  total: number
  filtered: number
  pageCount: number
  hasNext: boolean
  hasPrevious: boolean
  severityTotals: Record<AuditLogSeverity, number>
  severityTotalsAll: Record<AuditLogSeverity, number>
  actorTotals: { total: number; filtered: number }
}

export interface AuditLogListResponse {
  data: AuditLogRecord[]
  meta: AuditLogListMeta
}

export interface Service {
  id: number
  name: string
  icon?: string | null
  prefix: string
  active: boolean | 0 | 1
  priority: number
  estimatedTime: number
  maxAttentionTime?: number | null
  createdAt: string | Date
  updatedAt: string | Date
  operatorIds?: number[]
  operators?: Array<Pick<Operator, 'id' | 'name'>>
}

export interface Operator {
  id: number
  name: string
  username: string
  email: string
  position: string | null
  role: Role
  roles?: Role[]
  active: boolean | 0 | 1
  online?: boolean | 0 | 1 // si tu dominio lo usa
  // Conveniencias para UI:
  services?: Array<Partial<Service> & { id: number; name: string }>
  serviceIds?: number[]       // cuando el backend devuelve solo IDs
  createdAt: string | Date
  updatedAt: string | Date
}

export interface Ticket {
  id: number
  number: string
  serviceId: number
  status: Status
  priority: number
  createdAt: string | Date
  calledAt: string | Date | null
  startedAt: string | Date | null
  completedAt: string | Date | null
  attentionDuration?: number | null
  operatorId: number | null
  estimatedWaitTime: number | null
  actualWaitTime: number | null
  mobilePhone: string | null
  notificationSent: boolean
  almostReadyNotificationSentAt?: string | Date | null
  clientId?: number | null
  qrScannedAt?: string | Date | null
  absentAt?: string | Date | null
  requeuedAt?: string | Date | null
}

export interface SystemSetting {
  id: number
  key: string
  value: string
  description: string | null
  updatedAt: string | Date
}

// =======================
// Extendidos / agregados
// =======================
export interface TicketWithRelations extends Ticket {
  service: Service
  operator?: Operator | null
  client?: Client | null
}

export interface ServiceWithStats extends Service {
  waitingCount: number
  averageTime: number
  todayTickets: number
  absentCount: number
}

export interface OperatorWithStats extends Operator {
  todayTickets: number
  averageTime: number
  currentTicket?: TicketWithRelations | null
}

// Relación puente operador–servicio (útil para admin/diagnóstico)
export interface OperatorService {
  operatorId: number
  serviceId: number
  enabled: boolean | 0 | 1
  createdAt?: string | Date
  updatedAt?: string | Date
}

export interface OperatorAttentionHistoryItem {
  ticketId: number
  ticketNumber: string
  status: Status | string
  serviceId: number
  serviceName: string
  startedAt: string | Date | null
  completedAt: string | Date | null
  attentionSeconds: number | null
  maxAttentionTime: number | null
  exceededSeconds: number | null
}

export interface OperatorAttentionMetrics {
  operatorId: number
  totalCompleted: number
  averageAttentionSeconds: number | null
  exceededCount: number
  history: OperatorAttentionHistoryItem[]
  period: 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'
  from: string | null
  to: string | null
  statuses: Status[]
  limit: number
  serviceId: number | null
}

// =======================
// Estado global
// =======================
export interface QueueState {
  services: Service[]
  operators: Operator[]
  tickets: Ticket[]
  settings: SystemSetting[]
  clients: Client[]
  customMessages: CustomMessage[]
  currentTime: string | Date
}

// =======================
// Autenticación
// =======================
export interface User {
  id: number
  username: string
  email?: string | null
  name: string
  role: Role
  roles?: Role[]
  permissions?: Permission[]
  active: boolean | 0 | 1
  position?: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

export interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  user: User | null
  error: string | null
  token: string | null
  permissions: Permission[]
  rolePermissions: Record<string, Permission[]>
}

export interface LoginWithUsername {
  username: string
  password: string
  email?: never
}
export interface LoginWithEmail {
  email: string
  password: string
  username?: never
}
export type LoginCredentials = LoginWithUsername | LoginWithEmail

// =======================
// Métricas / dashboard
// =======================
export interface DashboardMetrics {
  totalInQueue: number | null
  averageWaitTime: number | null
  attendedToday: number | null
  serviceLevel: number | null
  peakHour: number | null
}

export interface QueueStatus {
  queues: ServiceWithStats[]
  currentTicket?: TicketWithRelations | null
  nextTickets: TicketWithRelations[]
  inProgressTickets: TicketWithRelations[]
  calledTickets: TicketWithRelations[]
  waitingTickets: TicketWithRelations[]
  absentTickets: TicketWithRelations[]
  recentlyCompletedTickets: TicketWithRelations[]
  todayMetrics: DashboardMetrics
}

// =======================
// Payloads API (frontend -> backend)
// =======================

// Crear operador (igual a lo que probaste en Swagger)
export type CreateOperatorPayload = {
  name: string
  username: string
  password: string
  email: string
  position: string
  role: Role
  active: boolean
  serviceIds: number[] // CLAVE: crea la relación operador–servicio
}

// Actualizar operador (campos opcionales)
export type UpdateOperatorPayload = Partial<Omit<CreateOperatorPayload, "password">> & {
  password?: string // permitir cambiar contraseña si se envía
}

// Administrar asignaciones (endpoint dedicado opcional)
export type AssignOperatorServicesPayload = {
  serviceIds: number[]
}

export type AssignServiceOperatorsPayload = {
  operatorIds: number[]
}

// Llamar siguiente ticket (recomendado vía body)
export type CallNextPayload = {
  serviceId: number
}
