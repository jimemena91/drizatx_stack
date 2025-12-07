// src/lib/api-mode.ts
// Utilidades del “modo API” para el Dashboard.
// - isApiMode(): determina si usar API real según .env
// - checkBackendHealth(): compat para api-status-indicator (usa ping/isApiReachable)
// - Endpoints correctos (NO usar /api/queue/status; usar /api/queue/dashboard)

import type { DashboardResponse, Ticket } from "@/lib/api-client"

import { resolveApiBaseUrl } from "@/lib/resolve-api-base"

const API_BASE_FALLBACK = resolveApiBaseUrl()
const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL
const RAW_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || RAW_API_URL || process.env.NEXT_PUBLIC_API
const HEALTHCHECK_PATH_ENV = process.env.NEXT_PUBLIC_API_HEALTHCHECK_PATH?.trim()
const API_HEALTHCHECK_PATH = HEALTHCHECK_PATH_ENV
  ? HEALTHCHECK_PATH_ENV.startsWith("/")
    ? HEALTHCHECK_PATH_ENV
    : `/${HEALTHCHECK_PATH_ENV}`
  : "/api/health"

/* ==================== Base URL normalizada ==================== */
export const API_BASE: string = (() => {
  const raw = (RAW_BASE_URL ?? API_BASE_FALLBACK).replace(/\/$/, "")
  const normalized = raw.replace(/\/api$/, "") // evita doble /api
  if (typeof window !== "undefined") {
    console.debug("[api-mode] API_BASE =", normalized)
    if (!RAW_API_URL || RAW_API_URL.trim().length === 0) {
      console.error(
        "[api-mode] NEXT_PUBLIC_API_URL está vacío o indefinido. Configura frontend/.env.local con la URL pública del backend.",
      )
    }
  }
  return normalized
})()

function url(path: string) {
  // acepta path con o sin /api inicial; garantiza un solo /api
  const p = path.replace(/^\/+/, "")
  return `${API_BASE}/${p.replace(/^api\/?/, "api/")}`
}

async function jsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

/* ==================== Detección de modo API ==================== */
function toBool(v: any): boolean {
  if (v == null) return false
  const s = String(v).toLowerCase().trim()
  return s === "1" || s === "true" || s === "yes" || s === "on"
}

/** Devuelve true si el front debe usar la API real. */
export function isApiMode(): boolean {
  const apiMode = toBool(process.env.NEXT_PUBLIC_API_MODE ?? "false")
  const demoMode = toBool(process.env.NEXT_PUBLIC_DEMO_MODE ?? "0")
  const enabled = apiMode && !demoMode
  if (typeof window !== "undefined") {
    console.debug("[api-mode] isApiMode:", enabled, {
      NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE,
      NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
    })
  }
  return enabled
}

/* ==================== Checks de conectividad ==================== */
/** Lanza error si /api/health no responde 200. */
export async function ping(): Promise<void> {
  const res = await fetch(url(API_HEALTHCHECK_PATH), { credentials: "include" })
  if (!res.ok) throw new Error(`Health check falló (HTTP ${res.status})`)
  if (typeof window !== "undefined") console.debug(`[api-mode] ${API_HEALTHCHECK_PATH} OK`)
}

/** True si la API responde OK al ping. */
export async function isApiReachable(): Promise<boolean> {
  try {
    await ping()
    return true
  } catch {
    return false
  }
}

/** ⚠️ Compatibilidad para componentes que importaban `checkBackendHealth`. */
export async function checkBackendHealth(): Promise<boolean> {
  return isApiReachable()
}

/* ==================== Endpoints de Queue ==================== */
/** Dashboard correcto del backend (reemplaza /api/queue/status). */
export async function fetchQueueDashboard(options: { publicMode?: boolean } = {}): Promise<DashboardResponse> {
  const path = options.publicMode ? "/api/queue/public/dashboard" : "/api/queue/dashboard"
  const credentials: RequestCredentials = options.publicMode ? "omit" : "include"
  const res = await fetch(url(path), { credentials })
  if (res.status === 404) {
    const body = await res.text().catch(() => "")
    throw new Error(`El endpoint /api/queue/dashboard no existe (404). Body: ${body}`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Error al obtener dashboard (HTTP ${res.status}). Body: ${body}`)
  }
  const data = (await jsonSafe<DashboardResponse>(res))!
  if (typeof window !== "undefined") console.debug("[api-mode] dashboard OK", data)
  return data
}

/** Próximo ticket (o null) para un servicio. */
export async function fetchQueueNext(serviceId: number): Promise<Ticket | null> {
  if (!Number.isInteger(serviceId) || serviceId <= 0) throw new Error("serviceId inválido")
  const res = await fetch(url(`/api/queue/next/${serviceId}`), { credentials: "include" })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Error al obtener próximo (HTTP ${res.status})`)
  return (await jsonSafe<Ticket>(res)) as Ticket
}

/* ==================== Debug opcional ==================== */
export async function debugApiStatus(): Promise<void> {
  try {
    console.debug("[api-mode] BASE =", API_BASE)
    await ping()
    const dash = await fetchQueueDashboard()
    console.debug("[api-mode] DASHBOARD LEN =", dash?.services?.length ?? 0)
  } catch (e) {
    console.error("[api-mode] debugApiStatus error:", e)
    throw e
  }
}

/* Export agrupado opcional */
export default {
  API_BASE,
  isApiMode,
  ping,
  isApiReachable,
  checkBackendHealth,
  fetchQueueDashboard,
  fetchQueueNext,
  debugApiStatus,
}
