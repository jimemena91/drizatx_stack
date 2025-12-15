"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useQueue } from "@/contexts/queue-context"
import type { Service } from "@/lib/types"
import { apiClient, ApiError } from "@/lib/api-client"
import { API_BASE } from "@/lib/api-mode"
import { useAuth } from "@/contexts/auth-context"
import { comparePriorityDesc, normalizePriorityLevel } from "@/lib/priority"

/**
 * - normalizeService: asegura tipos/fechas/flags consistentes (active: boolean real).
 * - sortServices: orden estable por priority DESC y luego name ASC.
 * - En modo API: CRUD real contra /api/services.
 * - En modo local: muta estado local sin pegarle al backend.
 */

function toBoolFlag(v: any): boolean {
  if (v === true || v === 1 || v === "1") return true
  if (v === false || v === 0 || v === "0") return false
  return true
}

function toNullableNumber(value: any): number | null {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeService(raw: any): Service {
  return {
    id: Number(raw.id),
    name: String(raw.name ?? raw.serviceName ?? "Servicio"),
    icon:
      typeof raw.icon === "string" && raw.icon.trim().length > 0
        ? raw.icon.trim().toLowerCase()
        : typeof raw.serviceIcon === "string" && raw.serviceIcon.trim().length > 0
          ? raw.serviceIcon.trim().toLowerCase()
          : null,
    prefix: String(raw.prefix ?? raw.codePrefix ?? "").toUpperCase(),
    active: toBoolFlag(raw.active),
    priority:
      normalizePriorityLevel(
        raw.priority ?? raw.priorityLevel ?? raw.priority_level ?? raw.prioritylevel,
      ) ?? 1,
    estimatedTime: Number(raw.estimatedTime ?? raw.estimated_time ?? 10),
    maxAttentionTime: toNullableNumber(raw.maxAttentionTime ?? raw.max_attention_time),
    createdAt: raw.createdAt
      ? new Date(raw.createdAt)
      : raw.created_at
        ? new Date(raw.created_at)
        : new Date(),
    updatedAt: raw.updatedAt
      ? new Date(raw.updatedAt)
      : raw.updated_at
        ? new Date(raw.updated_at)
        : new Date(),
  }
}

function sortServices(services: Service[]): Service[] {
  return [...services].sort((a, b) => {
    if (a.priority !== b.priority) return comparePriorityDesc(a.priority, b.priority)
    return a.name.localeCompare(b.name, "es", { sensitivity: "base" })
  })
}

type UseServicesOptions = {
  publicMode?: boolean;
  requireAuth?: boolean;
};

export function useServices(options: UseServicesOptions = {}) {
  const { state, dispatch, isApiMode } = useQueue()
  const { state: authState } = useAuth()
  const { publicMode = false, requireAuth = false } = options
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authLoading = authState.isLoading
  const authToken = authState.token
  const authAuthenticated = authState.isAuthenticated
  const authReady = !requireAuth || (!authLoading && (authAuthenticated || !!authToken))

  useEffect(() => {
    if (!isApiMode) return
    if (!requireAuth) return
    if (!authReady) {
      setLoading(true)
    }
  }, [isApiMode, requireAuth, authReady])

  const fetchServices = useCallback(async () => {
    if (!isApiMode) return
    if (!authReady) return
    try {
      setLoading(true)
      setError(null)

      let raw: any[] = []
      if (publicMode) {
        console.debug("[services] GET", `${API_BASE}/api/queue/public/services`)
        raw = await apiClient.getPublicServices()
      } else {
        console.debug("[services] GET", `${API_BASE}/api/services`)
        raw = await apiClient.getServices()
      }
      const normalized = sortServices((raw ?? []).map(normalizeService))
      dispatch({ type: "SET_SERVICES", payload: normalized })
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error fetching services"
      setError(errorMessage)
      console.error("Error fetching services:", err)
      dispatch({ type: "SET_SERVICES", payload: [] })
    } finally {
      setLoading(false)
    }
  }, [isApiMode, authReady, publicMode, dispatch])

  // ---------- Fetch inicial desde API cuando corresponde ----------
  useEffect(() => {
    if (!isApiMode) return
    if (!authReady) return
    // limpiamos para no arrastrar mocks
    dispatch({ type: "SET_SERVICES", payload: [] })
    void fetchServices()
  }, [isApiMode, publicMode, authReady, dispatch, fetchServices])

  // ---------- CREATE ----------
  const createService = async (data: Omit<Service, "id" | "createdAt" | "updatedAt">) => {
    try {
      setError(null)

      if (isApiMode) {
        if (publicMode) {
          throw new Error("Crear servicios no está disponible en modo público")
        }
        console.debug("[services] POST", `${API_BASE}/api/services`, data)
        const created = await apiClient.createService({
          name: String(data.name ?? "").trim(),
          prefix: String(data.prefix ?? "").trim().toUpperCase(),
          active: !!data.active,
          priority: normalizePriorityLevel(data.priority) ?? 1,
          estimatedTime: Number.isFinite(Number(data.estimatedTime)) ? Number(data.estimatedTime) : 10,
          maxAttentionTime:
            data.maxAttentionTime === null || data.maxAttentionTime === undefined
              ? undefined
              : Number.isFinite(Number(data.maxAttentionTime)) && Number(data.maxAttentionTime) > 0
                ? Math.round(Number(data.maxAttentionTime))
                : undefined,
          icon:
            data.icon === null
              ? null
              : typeof data.icon === "string" && data.icon.trim().length > 0
                ? data.icon.trim().toLowerCase()
                : undefined,
        } as any)

        const normalized = normalizeService(created)
        dispatch({ type: "ADD_SERVICE", payload: normalized })
        return normalized
      }

      // ---- Modo local (sin API) ----
      const now = new Date()
      const nextId = Math.max(0, ...state.services.map(s => s.id)) + 1
      const local: Service = {
        id: nextId,
        name: String(data.name ?? "").trim(),
        prefix: String(data.prefix ?? "").trim().toUpperCase(),
        active: !!data.active,
        priority: normalizePriorityLevel(data.priority) ?? 1,
        estimatedTime: Number.isFinite(Number(data.estimatedTime)) ? Number(data.estimatedTime) : 10,
        maxAttentionTime:
          data.maxAttentionTime === null || data.maxAttentionTime === undefined
            ? null
            : Number.isFinite(Number(data.maxAttentionTime)) && Number(data.maxAttentionTime) > 0
              ? Math.round(Number(data.maxAttentionTime))
              : null,
        icon:
          data.icon === null
            ? null
            : typeof data.icon === "string" && data.icon.trim().length > 0
              ? data.icon.trim().toLowerCase()
              : null,
        createdAt: now,
        updatedAt: now,
      }
      dispatch({ type: "ADD_SERVICE", payload: local })
      return local
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Error creando servicio"
      setError(msg)
      throw err
    }
  }

  // ---------- UPDATE ----------
  const updateService = async (id: number, data: Partial<Service>) => {
    try {
      setError(null)

      if (isApiMode) {
        if (publicMode) {
          throw new Error("Actualizar servicios no está disponible en modo público")
        }
        console.debug("[services] PUT", `${API_BASE}/api/services/${id}`, data)
        const updated = await apiClient.updateService(id, {
          ...data,
          // saneo por las dudas:
          prefix: data.prefix ? String(data.prefix).toUpperCase() : undefined,
          maxAttentionTime:
            data.maxAttentionTime === undefined
              ? undefined
              : data.maxAttentionTime === null
                ? null
                : Number.isFinite(Number(data.maxAttentionTime)) && Number(data.maxAttentionTime) > 0
                  ? Math.round(Number(data.maxAttentionTime))
                  : null,
          icon:
            data.icon === undefined
              ? undefined
              : data.icon === null
                ? null
                : typeof data.icon === "string" && data.icon.trim().length > 0
                  ? data.icon.trim().toLowerCase()
                  : null,
        } as Partial<Service>)
        const normalized = normalizeService(updated)
        dispatch({ type: "UPDATE_SERVICE", payload: { id, data: normalized } })
        return normalized
      }

      // ---- Modo local ----
      const patch: Partial<Service> = {
        ...data,
        updatedAt: new Date(),
        prefix: data.prefix ? String(data.prefix).toUpperCase() : undefined,
        icon:
          data.icon === undefined
            ? undefined
            : data.icon === null
              ? null
              : typeof data.icon === "string" && data.icon.trim().length > 0
                ? data.icon.trim().toLowerCase()
                : null,
      }
      dispatch({ type: "UPDATE_SERVICE", payload: { id, data: patch } })
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Error actualizando servicio"
      setError(msg)
      throw err
    }
  }

  // ---------- DELETE ----------
  const deleteService = async (id: number) => {
    try {
      setError(null)

      if (isApiMode) {
        if (publicMode) {
          throw new Error("Eliminar servicios no está disponible en modo público")
        }
        console.debug("[services] DELETE", `${API_BASE}/api/services/${id}`)
        await apiClient.deleteService(id)
      }
      // En ambos modos, sacamos del estado local
      dispatch({ type: "DELETE_SERVICE", payload: id })
      return { deleted: true }
    } catch (err: any) {
      const msg = err instanceof ApiError ? err.message : "Error eliminando servicio"
      setError(msg)
      throw err
    }
  }

  // ---------- Selectores memoizados ----------
  const servicesSorted = useMemo(() => sortServices(state.services ?? []), [state.services])
  const activeServices = useMemo(() => servicesSorted.filter((s) => s.active), [servicesSorted])

  const getServiceById = (id: number) => servicesSorted.find((s) => s.id === id)
  const getActiveServices = () => activeServices

  return {
    services: servicesSorted,
    loading,
    error,
    createService,
    updateService,
    deleteService,
    getServiceById,
    getActiveServices,
    refetch: fetchServices,
  }
}
