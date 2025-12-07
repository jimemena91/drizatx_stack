"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"
import { useQueue } from "@/contexts/queue-context"
import { apiClient, type DashboardTicket } from "@/lib/api-client"
import {
  type QueueStatus,
  type ServiceWithStats,
  type DashboardMetrics,
  type TicketWithRelations,
  Status,
} from "@/lib/types"
import {
  compareByPriorityDescAndDateAsc,
  comparePriorityDesc,
  normalizePriorityLevel,
  toTimestamp,
} from "@/lib/priority"
import { getFriendlyApiErrorMessage } from "@/lib/error-messages"
import { sanitizeQueueSnapshot } from "@/lib/queue-snapshot"

/**
 * Hook de estado del tablero:
 * - Si isApiMode === true → consume backend real (/api/queue/dashboard)
 * - Si isApiMode === false → usa el estado local del contexto (modo demo)
 */

export type QueueSnapshotStatus = "idle" | "loading" | "error" | "success"

export type QueueSnapshotState = {
  status: QueueSnapshotStatus
  error: string | null
  hasSnapshot: boolean
  isIdle: boolean
  isLoading: boolean
  isInitialLoading: boolean
  isError: boolean
  isSuccess: boolean
}

export function useQueueStatus() {
  const { state, isApiMode } = useQueue()
  const pathname = usePathname()
  const isPublicQueueRoute = useMemo(() => {
    if (!pathname) return false
    return pathname.startsWith("/terminal") || pathname.startsWith("/display")
  }, [pathname])

  const [queueStatusApi, setQueueStatusApi] = useState<QueueStatus | null>(null)
  const [status, setStatus] = useState<QueueSnapshotStatus>(isApiMode ? "idle" : "success")
  const [error, setError] = useState<string | null>(null)
  const lastQueueSnapshotRef = useRef<QueueStatus | null>(null)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (queueStatusApi) {
      lastQueueSnapshotRef.current = queueStatusApi
    }
  }, [queueStatusApi])

  useEffect(() => {
    if (isApiMode) {
      // primer precarga
      setStatus(queueStatusApi ? "success" : "idle")
      void fetchQueueStatus()
    } else {
      setStatus("success")
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiMode])

  /**
   * Obtiene el dashboard desde la API, lo mapea y
   * 1) actualiza el estado interno del hook
   * 2) DEVUELVE el QueueStatus para que el caller pueda usarlo sin “esperar” el setState de React.
   */
  const computeLocalQueueStatus = useCallback((): QueueStatus => {
    const currentState = stateRef.current

    // ---------------------- MODO DEMO (local) ----------------------
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayStartMs = today.getTime()
    const dayEndMs = tomorrow.getTime()

    const queues: ServiceWithStats[] = currentState.services
      .filter((service) => service.active)
      .map((service) => {
        const serviceTickets = currentState.tickets.filter((t) => t.serviceId === service.id)
        const todayTickets = serviceTickets.filter((t) => t.createdAt >= today)
        const waitingCount = serviceTickets.filter(
          (t) => t.status === Status.WAITING || t.status === Status.CALLED,
        ).length

        const completedToday = todayTickets.filter(
          (t) => t.status === Status.COMPLETED && t.actualWaitTime,
        )
        const absentToday = todayTickets.filter((t) => t.status === Status.ABSENT)
        const attendedTodayCount = todayTickets.filter((t) =>
          [Status.COMPLETED, Status.ABSENT].includes(t.status),
        ).length

        const averageTime =
          completedToday.length > 0
            ? completedToday.reduce((acc, t) => acc + (t.actualWaitTime || 0), 0) /
              completedToday.length
            : service.estimatedTime

        return {
          ...service,
          waitingCount,
          averageTime: Math.round(averageTime),
          todayTickets: attendedTodayCount,
          absentCount: absentToday.length,
          priority: normalizePriorityLevel(service.priority) ?? 0,
        }
      })
      .sort((a, b) => comparePriorityDesc(a.priority, b.priority))

    const mapLocalTicket = (ticket: typeof currentState.tickets[number]): TicketWithRelations => ({
      ...ticket,
      priority: normalizePriorityLevel(ticket.priority) ?? 0,
      service: currentState.services.find((s) => s.id === ticket.serviceId)!,
      operator: ticket.operatorId
        ? currentState.operators.find((o) => o.id === ticket.operatorId) ?? null
        : null,
      client: ticket.clientId
        ? currentState.clients.find((c) => c.id === ticket.clientId) || null
        : null,
    })

    const getRequeueTimestamp = (ticket: typeof currentState.tickets[number]): number => {
      const raw = (ticket as any)?.requeuedAt ?? null
      if (!raw) return toTimestamp(ticket.createdAt)
      if (raw instanceof Date) return raw.getTime()
      try {
        return new Date(raw).getTime()
      } catch {
        return toTimestamp(ticket.createdAt)
      }
    }

    const getAbsentTimestamp = (ticket: typeof currentState.tickets[number]): number => {
      const absentRaw = (ticket as any)?.absentAt ?? null
      if (absentRaw instanceof Date) return absentRaw.getTime()
      if (typeof absentRaw === "string") {
        const parsed = new Date(absentRaw)
        if (!Number.isNaN(parsed.getTime())) return parsed.getTime()
      }
      const requeuedRaw = (ticket as any)?.requeuedAt ?? null
      if (requeuedRaw instanceof Date) return requeuedRaw.getTime()
      if (typeof requeuedRaw === "string") {
        const parsed = new Date(requeuedRaw)
        if (!Number.isNaN(parsed.getTime())) return parsed.getTime()
      }
      return toTimestamp(ticket.calledAt ?? ticket.createdAt)
    }

    const inProgressTickets = currentState.tickets
      .filter((t) => t.status === Status.IN_PROGRESS)
      .sort((a, b) => {
        const aRef = toTimestamp(a.startedAt ?? a.calledAt ?? a.createdAt)
        const bRef = toTimestamp(b.startedAt ?? b.calledAt ?? b.createdAt)
        return aRef - bRef
      })
      .map(mapLocalTicket)

    const calledTickets = currentState.tickets
      .filter((t) => t.status === Status.CALLED)
      .sort((a, b) => {
        const aRef = toTimestamp(a.calledAt ?? a.createdAt)
        const bRef = toTimestamp(b.calledAt ?? b.createdAt)
        return aRef - bRef
      })
      .map(mapLocalTicket)

    const waitingTickets = currentState.tickets
      .filter((t) => t.status === Status.WAITING)
      .sort((a, b) =>
        compareByPriorityDescAndDateAsc(
          a,
          b,
          (ticket) => ticket.priority,
          (ticket) => getRequeueTimestamp(ticket),
        ),
      )
      .map(mapLocalTicket)

    const absentTickets = currentState.tickets
      .filter((t) => t.status === Status.ABSENT)
      .sort((a, b) => getAbsentTimestamp(b) - getAbsentTimestamp(a))
      .map(mapLocalTicket)

    const currentTicket = inProgressTickets[0] ?? calledTickets[0] ?? waitingTickets[0] ?? null

    const allTickets = [...inProgressTickets, ...calledTickets, ...waitingTickets]
    const nextTickets = allTickets.filter((ticket, index) => {
      if (currentTicket && ticket.id === currentTicket.id) return false
      return allTickets.findIndex((t) => t.id === ticket.id) === index
    })

    const todayTickets = currentState.tickets.filter((t) => t.createdAt >= today)
    const startedTodayTickets = currentState.tickets.filter((t) => {
      const startMs = toTimestamp(t.startedAt, Number.NaN)
      return Number.isFinite(startMs) && startMs >= dayStartMs && startMs < dayEndMs
    })
    const recentlyCompletedTickets = startedTodayTickets
      .filter((t) => t.status === Status.COMPLETED)
      .sort((a, b) => {
        const aRef = toTimestamp(a.startedAt, Number.NEGATIVE_INFINITY)
        const bRef = toTimestamp(b.startedAt, Number.NEGATIVE_INFINITY)
        return bRef - aRef
      })
      .slice(0, 5)
      .map(mapLocalTicket)
    const completedTickets = todayTickets.filter((t) => t.status === Status.COMPLETED)
    const absentTicketsToday = todayTickets.filter((t) => t.status === Status.ABSENT)
    const waitingTicketsToday = todayTickets.filter(
      (t) => t.status === Status.WAITING || t.status === Status.CALLED,
    )

    const averageWaitTime =
      completedTickets.length > 0
        ? completedTickets.reduce((acc, t) => acc + (t.actualWaitTime || 0), 0) /
          completedTickets.length
        : 0

    const onTimeTickets = completedTickets.filter((t) => {
      const service = currentState.services.find((s) => s.id === t.serviceId)
      return service && (t.actualWaitTime || 0) <= service.estimatedTime
    })
    const serviceLevel =
      completedTickets.length > 0 ? (onTimeTickets.length / completedTickets.length) * 100 : 0

    const hourCounts = new Array(24).fill(0)
    todayTickets.forEach((ticket) => {
      const hour = ticket.createdAt.getHours()
      hourCounts[hour]++
    })
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

    const todayMetrics: DashboardMetrics = {
      totalInQueue: waitingTicketsToday.length,
      averageWaitTime: Math.round(averageWaitTime),
      attendedToday: completedTickets.length + absentTicketsToday.length,
      serviceLevel: Math.round(serviceLevel),
      peakHour,
    }

    const snapshot: QueueStatus = {
      queues,
      currentTicket,
      nextTickets,
      inProgressTickets,
      calledTickets,
      waitingTickets,
      absentTickets,
      recentlyCompletedTickets,
      todayMetrics,
    }

    const sanitized = sanitizeQueueSnapshot(snapshot)
    lastQueueSnapshotRef.current = sanitized
    return sanitized
  }, [])

  const fetchQueueStatus = useCallback(async (): Promise<QueueStatus | null> => {
    if (!isApiMode) {
      const snapshot = computeLocalQueueStatus()
      setStatus("success")
      setError(null)
      return snapshot
    }

    try {
      setStatus("loading")
      setError(null)

      // Ping explícito para mensajes claros ante CORS/red
      await apiClient.ping()

      const dashboard = await apiClient.getQueueDashboard({ publicMode: isPublicQueueRoute })
      const updatedAt = dashboard?.updatedAt ? new Date(dashboard.updatedAt) : new Date()
      const referenceDayStart = new Date(updatedAt)
      referenceDayStart.setHours(0, 0, 0, 0)
      const referenceDayEnd = new Date(referenceDayStart)
      referenceDayEnd.setDate(referenceDayEnd.getDate() + 1)

      const queueIconLookup = new Map<number, string | null>(
        (dashboard?.services ?? []).map((s) => [s.serviceId, s.serviceIcon ?? null]),
      )

      const queues: ServiceWithStats[] = (dashboard?.services ?? []).map((s) => ({
        id: s.serviceId,
        name: s.serviceName,
        icon:
          typeof s.serviceIcon === "string" && s.serviceIcon.trim().length > 0
            ? s.serviceIcon.trim()
            : null,
        prefix: "",
        active: true,
        priority: normalizePriorityLevel((s as any)?.priority) ?? 0,
        estimatedTime: Math.round(s.avgWaitTime ?? 0),

        createdAt: updatedAt,
        updatedAt: updatedAt,

        waitingCount: s.waitingCount,
        averageTime: Math.round(s.avgWaitTime ?? 0),
        todayTickets: s.attendedCountToday ?? s.completedCountToday ?? 0,
        absentCount: s.absentCountToday ?? 0,
      }))

      const toDate = (value: Date | string | null | undefined): Date | null => {
        if (!value) return null
        return value instanceof Date ? value : new Date(value)
      }

      const ensureNumber = (value: unknown): number | null => {
        if (value === null || value === undefined) return null
        const num = Number(value)
        return Number.isFinite(num) ? num : null
      }

      const mapTicketFromDashboard = (
        ticket: DashboardTicket | null | undefined,
      ): TicketWithRelations | null => {
        if (!ticket) return null

        const serviceBase = ticket.service ?? {
          id: ticket.serviceId,
          name: "",
          prefix: "",
          active: true,
          priority: normalizePriorityLevel(ticket.service?.priority ?? (ticket as any)?.priority) ?? 0,
          estimatedTime: ticket.estimatedWaitTime ?? 0,
          maxAttentionTime: null,
          createdAt: updatedAt,
          updatedAt: updatedAt,
          icon: queueIconLookup.get(ticket.serviceId) ?? null,
        }

        const rawStartedAt =
          (ticket as any)?.start_of_service_time ??
          (ticket as any)?.startOfServiceTime ??
          (ticket as any)?.started_at ??
          ticket.startedAt

        return {
          ...ticket,
          priority: normalizePriorityLevel(ticket.priority) ?? 0,
          createdAt: toDate(ticket.createdAt) ?? updatedAt,
          calledAt: toDate(ticket.calledAt),
          startedAt: toDate(rawStartedAt),
          completedAt: toDate(ticket.completedAt),
          service: {
            ...serviceBase,
            active: Boolean(serviceBase.active),
            priority: normalizePriorityLevel(serviceBase.priority) ?? 0,
            estimatedTime: serviceBase.estimatedTime ?? 0,
            createdAt: toDate(serviceBase.createdAt) ?? updatedAt,
            updatedAt: toDate(serviceBase.updatedAt) ?? updatedAt,
            icon:
              typeof (serviceBase as any).icon === "string" && (serviceBase as any).icon.trim().length > 0
                ? (serviceBase as any).icon.trim()
                : queueIconLookup.get(ticket.serviceId) ?? null,
          },
          operator: ticket.operator
            ? {
                ...ticket.operator,
                active: Boolean(ticket.operator.active),
                createdAt: toDate(ticket.operator.createdAt) ?? updatedAt,
                updatedAt: toDate(ticket.operator.updatedAt) ?? updatedAt,
              }
            : null,
          client: ticket.client
            ? {
                ...ticket.client,
                createdAt: toDate(ticket.client.createdAt) ?? updatedAt,
                updatedAt: toDate(ticket.client.updatedAt) ?? updatedAt,
              }
            : null,
        } as TicketWithRelations
      }

      const mapTicketsFromDashboard = (
        tickets?: DashboardTicket[] | null,
      ): TicketWithRelations[] =>
        (tickets ?? [])
          .map((ticket) => mapTicketFromDashboard(ticket))
          .filter((ticket): ticket is TicketWithRelations => ticket !== null)

      const inProgressTickets = mapTicketsFromDashboard(dashboard?.inProgressTickets)
      const calledTickets = mapTicketsFromDashboard(dashboard?.calledTickets)
      const waitingTickets = mapTicketsFromDashboard(dashboard?.waitingTickets)
      const absentTickets = mapTicketsFromDashboard(dashboard?.absentTickets)

      const getServiceStartDate = (ticket: TicketWithRelations): Date | null => {
        const start = toDate(ticket.startedAt)
        if (!start || Number.isNaN(start.getTime())) {
          return null
        }
        return start
      }

      const recentlyCompletedTickets = mapTicketsFromDashboard(
        dashboard?.recentlyCompletedTickets,
      )
        .filter((ticket) => {
          if (!ticket) return false
          if (ticket.status !== Status.COMPLETED) return false
          const startDate = getServiceStartDate(ticket)
          if (!startDate) return false
          return startDate >= referenceDayStart && startDate < referenceDayEnd
        })
        .sort((a, b) => {
          const aDate = getServiceStartDate(a)
          const bDate = getServiceStartDate(b)
          const aTime = aDate ? aDate.getTime() : 0
          const bTime = bDate ? bDate.getTime() : 0
          return bTime - aTime
        })
        .slice(0, 5)
      const fallbackNextTickets = mapTicketsFromDashboard(dashboard?.nextTickets)

      const currentTicket =
        mapTicketFromDashboard(dashboard?.currentTicket) ??
        inProgressTickets[0] ??
        calledTickets[0] ??
        waitingTickets[0] ??
        null

      const aggregated = [
        ...inProgressTickets,
        ...calledTickets,
        ...waitingTickets,
        ...fallbackNextTickets,
      ]
      const seen = new Set<number>()
      const nextTickets = aggregated.filter((ticket) => {
        if (!ticket) return false
        if (currentTicket && ticket.id === currentTicket.id) return false
        if (seen.has(ticket.id)) return false
        seen.add(ticket.id)
        return true
      })

      const metricsPayload: any = (dashboard as any)?.metrics ?? (dashboard as any)?.todayMetrics ?? null

      const baseTickets = [
        currentTicket,
        ...inProgressTickets,
        ...calledTickets,
        ...waitingTickets,
        ...absentTickets,
        ...fallbackNextTickets,
      ].filter((ticket): ticket is TicketWithRelations => Boolean(ticket))

      const uniqueTickets = Array.from(
        baseTickets.reduce((map, ticket) => {
          if (!map.has(ticket.id)) {
            map.set(ticket.id, ticket)
          }
          return map
        }, new Map<number, TicketWithRelations>()).values(),
      )

      const isSameDay = (date: Date | null) => {
        if (!date) return false
        const time = date.getTime()
        return time >= referenceDayStart.getTime() && time < referenceDayEnd.getTime()
      }

      const computeServiceLevelFromTickets = (): number | null => {
        const samples = uniqueTickets
          .map((ticket) => {
            const createdAt = toDate(ticket.createdAt)
            if (!isSameDay(createdAt)) return null

            const comparisonDate = toDate(ticket.calledAt) ?? toDate(ticket.startedAt) ?? toDate(ticket.completedAt)
            if (!comparisonDate) return null

            const estimatedMinutes = ensureNumber(
              (ticket.service?.estimatedTime ?? null) ?? ticket.estimatedWaitTime ?? null,
            )
            if (estimatedMinutes === null || estimatedMinutes <= 0) return null

            const actualMinutes =
              ensureNumber(ticket.actualWaitTime) ??
              (() => {
                if (!createdAt) return null
                const diff = comparisonDate.getTime() - createdAt.getTime()
                if (!Number.isFinite(diff) || diff < 0) return null
                return Math.round(diff / 60000)
              })()

            if (actualMinutes === null) return null

            return { actualMinutes, estimatedMinutes }
          })
          .filter((value): value is { actualMinutes: number; estimatedMinutes: number } => value !== null)

        if (samples.length === 0) return null

        const onTime = samples.filter((sample) => sample.actualMinutes <= sample.estimatedMinutes).length
        const ratio = (onTime / samples.length) * 100
        return Math.round(ratio)
      }

      const computePeakHourFromTickets = (): number | null => {
        if (uniqueTickets.length === 0) return null

        const hourCounts = new Array(24).fill(0)
        let hasData = false

        for (const ticket of uniqueTickets) {
          const createdAt = toDate(ticket.createdAt)
          if (!isSameDay(createdAt)) continue
          const hour = createdAt.getHours()
          if (!Number.isFinite(hour)) continue
          hasData = true
          hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
        }

        if (!hasData) return null

        const maxCount = Math.max(...hourCounts)
        if (!Number.isFinite(maxCount) || maxCount <= 0) return null
        return hourCounts.findIndex((count) => count === maxCount)
      }

      const totalInQueueFromPayload = ensureNumber(metricsPayload?.totalInQueue ?? (dashboard as any)?.totalInQueue)
      const averageWaitFromPayload = ensureNumber(
        metricsPayload?.averageWaitTime ?? metricsPayload?.avgWaitTime ?? (dashboard as any)?.averageWaitTime,
      )
      const attendedFromPayload = ensureNumber(metricsPayload?.attendedToday ?? metricsPayload?.attended)
      const serviceLevelFromPayload = ensureNumber(
        metricsPayload?.serviceLevel ?? (dashboard as any)?.serviceLevel ?? metricsPayload?.sla,
      )
      const peakHourFromPayload = ensureNumber(metricsPayload?.peakHour ?? (dashboard as any)?.peakHour)

      const todayMetrics: DashboardMetrics = {
        totalInQueue:
          totalInQueueFromPayload ?? queues.reduce((acc, q) => acc + (q.waitingCount ?? 0), 0),
        averageWaitTime:
          averageWaitFromPayload ??
          (queues.length > 0
            ? Math.round(queues.reduce((acc, q) => acc + (q.averageTime ?? 0), 0) / Math.max(1, queues.length))
            : null),
        attendedToday: attendedFromPayload ?? queues.reduce((acc, q) => acc + (q.todayTickets ?? 0), 0),
        serviceLevel: serviceLevelFromPayload ?? computeServiceLevelFromTickets(),
        peakHour: peakHourFromPayload ?? computePeakHourFromTickets(),
      }

      const queueStatusMapped: QueueStatus = {
        queues,
        currentTicket,
        nextTickets,
        inProgressTickets,
        calledTickets,
        waitingTickets,
        absentTickets,
        recentlyCompletedTickets,
        todayMetrics,
      }

      const sanitized = sanitizeQueueSnapshot(queueStatusMapped)

      lastQueueSnapshotRef.current = sanitized
      setQueueStatusApi(sanitized)
      setStatus("success")
      return sanitized
    } catch (err: any) {
      const friendlyMessage = getFriendlyApiErrorMessage(
        err,
        "No se pudo obtener el estado más reciente de la cola.",
      )
      setError(friendlyMessage)
      setStatus("error")
      console.error("[useQueueStatus] error:", err)
      // No “borrar” el último valor bueno: devolvemos el último snapshot disponible
      return lastQueueSnapshotRef.current
    }
  }, [computeLocalQueueStatus, isApiMode, isPublicQueueRoute])

  /**
   * Interface que consume la UI:
   * - En modo API retorna el estado mapeado desde backend.
   * - En modo DEMO retorna el estado calculado del contexto local.
   */
  const getQueueStatus = useCallback((): QueueStatus => {
    if (isApiMode) {
      return lastQueueSnapshotRef.current ?? computeLocalQueueStatus()
    }

    return computeLocalQueueStatus()
  }, [computeLocalQueueStatus, isApiMode])

  const hasSnapshot = useMemo(() => (!isApiMode ? true : queueStatusApi !== null), [isApiMode, queueStatusApi])
  const isInitialLoading = status === "loading" && !hasSnapshot

  const snapshotState = useMemo<QueueSnapshotState>(
    () => ({
      status,
      error,
      hasSnapshot,
      isIdle: status === "idle",
      isLoading: status === "loading",
      isInitialLoading,
      isError: status === "error",
      isSuccess: status === "success",
    }),
    [error, hasSnapshot, isInitialLoading, status],
  )

  const hookValue = useMemo(
    () => ({
      getQueueStatus,
      currentTime: state.currentTime,
      status,
      loading: isInitialLoading,
      isLoading: snapshotState.isLoading,
      isIdle: snapshotState.isIdle,
      isError: snapshotState.isError,
      isSuccess: snapshotState.isSuccess,
      hasSnapshot,
      error,
      snapshotState,
      refetch: fetchQueueStatus, // ahora devuelve Promise<QueueStatus | null>
    }),
    [
      error,
      fetchQueueStatus,
      getQueueStatus,
      hasSnapshot,
      isInitialLoading,
      snapshotState,
      state.currentTime,
      status,
    ],
  )

  return hookValue
}
