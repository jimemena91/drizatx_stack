"use client"

import { useState, useEffect, useCallback } from "react"
import { useQueue } from "@/contexts/queue-context"
import type { CustomMessage } from "@/lib/types"
import { apiClient, ApiError } from "@/lib/api-client"
import type { CreateCustomMessagePayload, UpdateCustomMessagePayload } from "@/lib/api-client"
import { comparePriorityDesc, normalizePriorityLevel } from "@/lib/priority"

function toDate(v: any): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(+d) ? null : d
}

const DAY_ORDER = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const

function normalizeDays(raw: any): string[] | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const sanitized = raw
      .map((item) => String(item).toLowerCase())
      .map((item) => (item === "sunday" ? "sun" : item === "monday" ? "mon" : item))
      .filter((item) => DAY_ORDER.includes(item as (typeof DAY_ORDER)[number]))
    return sanitized.length ? sanitized : null
  }
  if (typeof raw === "string") {
    const parts = raw
      .split(/[,;\s]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
    return normalizeDays(parts)
  }
  return null
}

function isMessageScheduledForToday(message: CustomMessage, referenceDate = new Date()): boolean {
  // @ts-expect-error: activeDays puede no estar tipado en CustomMessage original
  const allowedDays = normalizeDays(message.activeDays)
  if (!allowedDays || allowedDays.length === 0) return true
  const dayIndex = referenceDate.getDay()
  const code = DAY_ORDER[dayIndex]
  return allowedDays.includes(code)
}

function normalizeMessage(raw: any): CustomMessage {
  return {
    id: Number(raw.id),
    title: String(raw.title ?? ""),
    content: String(raw.content ?? ""),
    type: (raw.type ?? "info") as CustomMessage["type"],
    active: !!raw.active,
    priority: normalizePriorityLevel(raw.priority) ?? 1,
    // en runtime trabajamos con Date, aunque el tipo original use string
    // @ts-expect-error: startDate/endDate pueden ser string en el tipo
    startDate: toDate(raw.startDate),
    // @ts-expect-error
    endDate: toDate(raw.endDate),
    mediaUrl: raw.mediaUrl === undefined || raw.mediaUrl === null ? null : String(raw.mediaUrl),
    mediaType: raw.mediaType === undefined || raw.mediaType === null ? null : String(raw.mediaType),
    // @ts-expect-error: puede no existir en el tipo
    displayDurationSeconds: Number.isFinite(Number(raw.displayDurationSeconds))
      ? Number(raw.displayDurationSeconds)
      : null,
    // @ts-expect-error: puede no existir en el tipo
    activeDays: normalizeDays(raw.activeDays),
    // @ts-expect-error
    createdAt: toDate(raw.createdAt) ?? new Date(),
    // @ts-expect-error
    updatedAt: toDate(raw.updatedAt) ?? new Date(),
  }
}

export type UseCustomMessagesOptions = {
  publicMode?: boolean
}

export function useCustomMessages(options: UseCustomMessagesOptions = {}) {
  const { state, dispatch, isApiMode } = useQueue()
  const { publicMode = false } = options
  const [messages, setMessages] = useState<CustomMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const buildCreatePayload = useCallback(
    (data: Omit<CustomMessage, "id" | "createdAt" | "updatedAt">): CreateCustomMessagePayload => ({
      title: data.title,
      content: data.content,
      type: data.type,
      active: data.active,
      priority: normalizePriorityLevel(data.priority) ?? 1,
      // @ts-expect-error: en runtime usamos Date|null
      startDate: data.startDate ?? null,
      // @ts-expect-error
      endDate: data.endDate ?? null,
      // @ts-expect-error
      mediaUrl: data.mediaUrl ?? null,
      // @ts-expect-error
      mediaType: data.mediaType ?? null,
      // @ts-expect-error
      displayDurationSeconds: data.displayDurationSeconds ?? null,
      // @ts-expect-error
      activeDays: normalizeDays(data.activeDays) ?? null,
    }),
    [],
  )

  const buildUpdatePayload = useCallback(
    (data: Partial<CustomMessage>): UpdateCustomMessagePayload => {
      const payload: UpdateCustomMessagePayload = {}
      if (data.title !== undefined) payload.title = data.title
      if (data.content !== undefined) payload.content = data.content
      if (data.type !== undefined) payload.type = data.type
      if (data.active !== undefined) payload.active = data.active
      if (data.priority !== undefined)
        payload.priority = normalizePriorityLevel(data.priority) ?? 1
      // @ts-expect-error
      if (data.startDate !== undefined) payload.startDate = data.startDate
      // @ts-expect-error
      if (data.endDate !== undefined) payload.endDate = data.endDate
      // @ts-expect-error
      if (data.mediaUrl !== undefined) payload.mediaUrl = data.mediaUrl
      // @ts-expect-error
      if (data.mediaType !== undefined) payload.mediaType = data.mediaType
      // @ts-expect-error
      if (data.displayDurationSeconds !== undefined)
        // @ts-expect-error
        payload.displayDurationSeconds = data.displayDurationSeconds
      // @ts-expect-error
      if (data.activeDays !== undefined) payload.activeDays = normalizeDays(data.activeDays)
      return payload
    },
    [],
  )

  // ========= Fetch: API real =========
  const fetchFromApi = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const data = publicMode
        ? await apiClient.getPublicCustomMessages()
        : await apiClient.getCustomMessages()
      const list = (data ?? []).map(normalizeMessage)
      setMessages(list)
      dispatch({ type: "SET_CUSTOM_MESSAGES", payload: list })
    } catch (err) {
      const errorMessage = err instanceof ApiError ? err.message : "Error fetching messages"
      setError(errorMessage)
      console.error("[useCustomMessages] fetchFromApi error:", err)
    } finally {
      setLoading(false)
    }
  }, [dispatch, publicMode])

  // ========= Sync: modo local / simulado =========
  const syncFromLocalStore = useCallback(() => {
    setMessages(state.customMessages.map(normalizeMessage))
  }, [state.customMessages])

  // Montaje + cambios de modo → sólo API
  useEffect(() => {
    if (isApiMode) {
      void fetchFromApi()
    }
  }, [isApiMode, fetchFromApi])

  // En modo local, mantener sincronizado cuando cambia el store global
  useEffect(() => {
    if (!isApiMode) {
      syncFromLocalStore()
    }
  }, [isApiMode, syncFromLocalStore])

  // ========= Refetch público (para la UI) =========
  const refetch = useCallback(async () => {
    if (isApiMode) {
      await fetchFromApi()
    } else {
      syncFromLocalStore()
    }
  }, [isApiMode, fetchFromApi, syncFromLocalStore])

  // ========= CRUD =========
  const createMessage = useCallback(
    async (messageData: Omit<CustomMessage, "id" | "createdAt" | "updatedAt">) => {
      try {
        setError(null)
        setLoading(true)

        if (isApiMode) {
          const created = await apiClient.createCustomMessage(buildCreatePayload(messageData))
          const msg = normalizeMessage(created)
          dispatch({ type: "ADD_CUSTOM_MESSAGE", payload: msg })
          // refrescamos lista local para usos directos del hook
          setMessages((prev) => [...prev, msg])
          return msg
        }

        // Local/mock
        const now = new Date()
        const newMessage: CustomMessage = normalizeMessage({
          ...messageData,
          id: Math.max(0, ...state.customMessages.map((m) => m.id)) + 1,
          createdAt: now,
          updatedAt: now,
        })
        dispatch({ type: "ADD_CUSTOM_MESSAGE", payload: newMessage })
        setMessages((prev) => [...prev, newMessage])
        return newMessage
      } catch (err) {
        const errorMessage = err instanceof ApiError ? err.message : "Error creating message"
        setError(errorMessage)
        throw new Error(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    [buildCreatePayload, dispatch, isApiMode, state.customMessages],
  )

  const updateMessage = useCallback(
    async (id: number, data: Partial<CustomMessage>) => {
      try {
        setError(null)
        setLoading(true)

        if (isApiMode) {
          const updated = await apiClient.updateCustomMessage(id, buildUpdatePayload(data))
          const msg = normalizeMessage(updated)
          dispatch({ type: "UPDATE_CUSTOM_MESSAGE", payload: { id, data: msg } })
          setMessages((prev) => prev.map((m) => (m.id === id ? msg : m)))
          return
        }

        // Local/mock
        const updateData = normalizeMessage({
          ...(state.customMessages.find((m) => m.id === id) ?? {}),
          ...data,
          updatedAt: new Date(),
        })
        dispatch({ type: "UPDATE_CUSTOM_MESSAGE", payload: { id, data: updateData } })
        setMessages((prev) => prev.map((m) => (m.id === id ? updateData : m)))
      } catch (err) {
        const errorMessage = err instanceof ApiError ? err.message : "Error updating message"
        setError(errorMessage)
        throw new Error(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    [buildUpdatePayload, dispatch, isApiMode, state.customMessages],
  )

  const deleteMessage = useCallback(
    async (id: number) => {
      try {
        setError(null)
        setLoading(true)

        if (isApiMode) {
          await apiClient.deleteCustomMessage(id)
        }

        // En ambos casos actualizamos el store local
        dispatch({ type: "DELETE_CUSTOM_MESSAGE", payload: id })
        setMessages((prev) => prev.filter((m) => m.id !== id))
      } catch (err) {
        const errorMessage = err instanceof ApiError ? err.message : "Error deleting message"
        setError(errorMessage)
        throw new Error(errorMessage)
      } finally {
        setLoading(false)
      }
    },
    [dispatch, isApiMode],
  )

  // ========= Selectores (memoizados) =========
  const getActiveMessages = useCallback((): CustomMessage[] => {
    const now = Date.now()
    return (messages ?? [])
      .filter((m: any) => {
        if (!m.active) return false
        const startOk = !m.startDate || +new Date(m.startDate) <= now
        const endOk = !m.endDate || +new Date(m.endDate) >= now
        const dayOk = isMessageScheduledForToday(m, new Date(now))
        return startOk && endOk && dayOk
      })
      .sort((a, b) => comparePriorityDesc(a.priority, b.priority))
  }, [messages])

  const getMessagesByType = useCallback(
    (type: CustomMessage["type"]): CustomMessage[] => {
      return getActiveMessages().filter((m) => m.type === type)
    },
    [getActiveMessages],
  )

  return {
    messages,
    loading,
    error,
    // acciones
    createMessage,
    updateMessage,
    deleteMessage,
    refetch,
    // selectores memoizados
    getActiveMessages,
    getMessagesByType,
  }
}
