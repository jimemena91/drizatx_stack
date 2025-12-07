"use client"

import { useState, useEffect, useCallback } from "react"
import { useQueue } from "@/contexts/queue-context"
import { type Ticket, Status, type TicketWithRelations } from "@/lib/types"
import { apiClient, ApiError } from "@/lib/api-client"
import { notificationService } from "@/lib/notification-service"
import { audioService } from "@/lib/audio-service"
import { TimeEstimationService } from "@/lib/time-estimation"
import { comparePriorityDesc, normalizePriorityLevel } from "@/lib/priority"

// ---------- Normalización de tickets (camel/snake + fechas) ----------
function normalizeTicket(raw: any): Ticket {
  const toDate = (v: any) => (v ? new Date(v) : null)
  const num =
    raw.number ??
    raw.ticketNumber ?? // alias común
    raw.ticket_number ?? // snake case
    raw.code ?? // a veces "code"
    ""
  const attentionRaw = raw.attentionDuration ?? raw.attention_duration

  return {
    id: Number(raw.id ?? raw.ticketId),
    number: String(num),
    serviceId: Number(raw.serviceId ?? raw.service_id),
    status: (raw.status as Status) ?? Status.WAITING,
    priority:
      normalizePriorityLevel(
        raw.priority ??
          raw.priorityLevel ??
          raw.priority_level ??
          raw.prioritylevel,
      ) ?? 0,
    createdAt: raw.createdAt
      ? new Date(raw.createdAt)
      : raw.created_at
        ? new Date(raw.created_at)
        : new Date(),
    calledAt: toDate(raw.calledAt ?? raw.called_at),
    startedAt: toDate(raw.startedAt ?? raw.started_at),
    completedAt: toDate(raw.completedAt ?? raw.completed_at),
    absentAt: toDate(raw.absentAt ?? raw.absent_at),
    requeuedAt: toDate(raw.requeuedAt ?? raw.requeued_at),
    attentionDuration:
      attentionRaw === undefined || attentionRaw === null
        ? null
        : Number.isFinite(Number(attentionRaw))
          ? Number(attentionRaw)
          : null,
    operatorId: raw.operatorId ?? raw.operator_id ?? null,
    estimatedWaitTime:
      typeof raw.estimatedWaitTime === "number"
        ? raw.estimatedWaitTime
        : Number(raw.estimated_wait_time ?? 0),
    actualWaitTime:
      typeof raw.actualWaitTime === "number"
        ? raw.actualWaitTime
        : raw.actual_wait_time ?? null,
    mobilePhone: raw.mobilePhone ?? raw.phone ?? null,
    notificationSent: Boolean(
      raw.notificationSent ?? raw.notification_sent ?? false,
    ),
    almostReadyNotificationSentAt: raw.almostReadyNotificationSentAt
      ? new Date(raw.almostReadyNotificationSentAt)
      : raw.almost_ready_notification_sent_at
        ? new Date(raw.almost_ready_notification_sent_at)
        : null,
    clientId: raw.clientId ?? raw.client_id ?? null,
    qrScannedAt: raw.qrScannedAt
      ? new Date(raw.qrScannedAt)
      : raw.qr_scanned_at
        ? new Date(raw.qr_scanned_at)
        : null,
  }
}

const HAS_TICKETS_LIST =
  (process.env.NEXT_PUBLIC_HAS_TICKETS_LIST ?? "true") === "true"

const toValidDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const compareTicketsByQueue = (a: Ticket, b: Ticket) => {
  const priorityDiff = comparePriorityDesc(a.priority, b.priority)
  if (priorityDiff !== 0) return priorityDiff

  const createdA = toValidDate(a.createdAt) ?? new Date(0)
  const createdB = toValidDate(b.createdAt) ?? new Date(0)
  return createdA.getTime() - createdB.getTime()
}

type UseTicketsOptions = {
  skipInitialFetch?: boolean
  publicMode?: boolean
}

export function useTickets(opts: UseTicketsOptions = {}) {
  const { skipInitialFetch = false, publicMode = false } = opts
  const { state, dispatch, isApiMode } = useQueue()
  const [tickets, setTickets] = useState<TicketWithRelations[]>([])
  const [loading, setLoading] = useState(!skipInitialFetch)
  const [error, setError] = useState<string | null>(null)

  const toWithRelations = (ts: Ticket[]): TicketWithRelations[] =>
    ts.map((ticket) => ({
      ...ticket,
      service: state.services.find((s) => s.id === ticket.serviceId)!,
      operator: ticket.operatorId
        ? state.operators.find((o) => o.id === ticket.operatorId) ?? null
        : null,
      client: ticket.clientId
        ? state.clients.find((c) => c.id === ticket.clientId) ?? null
        : null,
    }))

  const fetchTickets = async () => {
    try {
      setLoading(true)
      setError(null)

      if (isApiMode && !publicMode) {
        const data = await apiClient.getTickets()
        const normalized = (data ?? []).map(normalizeTicket)
        dispatch({ type: "SET_TICKETS", payload: normalized })
        setTickets(toWithRelations(normalized))
      } else {
        const data = toWithRelations(state.tickets)
        setTickets(data)
      }
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) {
        const errorMessage =
          err instanceof ApiError ? err.message : "Error fetching tickets"
        setError(errorMessage)
        console.error("Error fetching tickets:", err)
      } else {
        dispatch({ type: "SET_TICKETS", payload: [] })
        setTickets([])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const shouldFetch =
      !skipInitialFetch && (!isApiMode || (!publicMode && HAS_TICKETS_LIST))
    if (shouldFetch) void fetchTickets()
    else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiMode, skipInitialFetch, publicMode])

  // Recalcular tiempos automáticamente cada 30s (solo modo local)
  useEffect(() => {
    const recalculateInterval = setInterval(() => {
      if (!isApiMode) {
        const updatedTickets =
          TimeEstimationService.recalculateAllWaitTimes(
            state.tickets,
            state.services,
            state.operators,
          )

        const hasSignificantChanges = updatedTickets.some((ticket, index) => {
          const originalTicket = state.tickets[index]
          return (
            originalTicket &&
            Math.abs(
              (ticket.estimatedWaitTime || 0) -
                (originalTicket.estimatedWaitTime || 0),
            ) > 2
          )
        })

        if (hasSignificantChanges) {
          updatedTickets.forEach((ticket) => {
            if (
              ticket.estimatedWaitTime !==
              state.tickets.find((t) => t.id === ticket.id)
                ?.estimatedWaitTime
            ) {
              dispatch({
                type: "UPDATE_TICKET",
                payload: {
                  id: ticket.id,
                  data: { estimatedWaitTime: ticket.estimatedWaitTime },
                },
              })
            }
          })
        }
      }
    }, 30000)

    return () => clearInterval(recalculateInterval)
  }, [state.tickets, state.services, state.operators, isApiMode, dispatch])

  const checkAndNotifyAlmostReady = useCallback(async () => {
    const queuesByService = state.tickets.reduce<Map<number, Ticket[]>>(
      (acc, ticket) => {
        if (ticket.status !== Status.WAITING) return acc
        const queue = acc.get(ticket.serviceId)
        if (queue) queue.push(ticket)
        else acc.set(ticket.serviceId, [ticket])
        return acc
      },
      new Map(),
    )

    queuesByService.forEach((queue) => queue.sort(compareTicketsByQueue))

    const waitingTickets = state.tickets
      .filter((t) => t.status === Status.WAITING && t.mobilePhone)
      .sort(compareTicketsByQueue)

    const candidates: Ticket[] = []

    for (const ticket of waitingTickets) {
      if (ticket.almostReadyNotificationSentAt) continue

      const serviceQueue = queuesByService.get(ticket.serviceId) ?? []
      const position = serviceQueue.findIndex(
        (queuedTicket) => queuedTicket.id === ticket.id,
      )
      if (position !== 1) continue

      candidates.push(ticket)
    }

    const ticketsToNotify = candidates.slice(0, 3)

    if (ticketsToNotify.length === 0) return

    const notifications: { id: number; timestamp: Date }[] = []

    for (const ticket of ticketsToNotify) {
      const service = state.services.find((s) => s.id === ticket.serviceId)
      const client = ticket.clientId
        ? state.clients.find((c) => c.id === ticket.clientId)
        : null

      try {
        await notificationService.notifyAlmostReady(
          ticket.id,
          ticket.number,
          service?.name || "Servicio",
          ticket.mobilePhone ?? undefined,
          client?.name,
        )

        const timestamp = new Date()
        notifications.push({ id: ticket.id, timestamp })
        dispatch({
          type: "UPDATE_TICKET",
          payload: {
            id: ticket.id,
            data: { almostReadyNotificationSentAt: timestamp },
          },
        })
      } catch (error) {
        console.error("Error sending almost ready notification", error)
      }
    }

    if (notifications.length > 0) {
      const notificationMap = new Map(
        notifications.map((item) => [item.id, item.timestamp]),
      )
      setTickets((prev) =>
        prev.map((ticket) => {
          const notifiedAt = notificationMap.get(ticket.id)
          return notifiedAt
            ? { ...ticket, almostReadyNotificationSentAt: notifiedAt }
            : ticket
        }),
      )
    }
  }, [state.tickets, state.services, state.clients, dispatch, setTickets])

  useEffect(() => {
    const hasPendingNotifications = state.tickets.some(
      (ticket) =>
        ticket.status === Status.WAITING &&
        ticket.mobilePhone &&
        !ticket.almostReadyNotificationSentAt,
    )

    if (!hasPendingNotifications) return

    void checkAndNotifyAlmostReady()

    const interval = setInterval(() => {
      void checkAndNotifyAlmostReady()
    }, 60000)

    return () => clearInterval(interval)
  }, [state.tickets, checkAndNotifyAlmostReady])

  const createTicket = async (
    serviceId: number,
    mobilePhone?: string,
    priority?: number,
    clientId?: number,
  ) => {
    try {
      setError(null)

      if (isApiMode) {
        if (publicMode) {
          setLoading(true)
          const createdRaw = await apiClient.enqueuePublicTicket({
            serviceId,
            clientId: clientId ?? null,
          })
          const newTicket = normalizeTicket(createdRaw)

          if (!newTicket.number || !newTicket.number.trim()) {
            const svc = state.services.find((s) => s.id === serviceId)
            const seq =
              (newTicket.id ?? Math.floor(Math.random() * 1000)) % 1000
            newTicket.number = `${svc?.prefix ?? ""}${String(seq).padStart(
              3,
              "0",
            )}`
          }

          dispatch({ type: "ADD_TICKET", payload: newTicket })
          setTickets((prev) => [toWithRelations([newTicket])[0], ...prev])
          return newTicket
        }
        setLoading(true)
        const payload: {
          serviceId: number
          mobilePhone?: string
          priority?: number
          clientId?: number
        } = { serviceId }

        if (mobilePhone) payload.mobilePhone = mobilePhone
        if (clientId !== undefined) payload.clientId = clientId
        if (priority !== undefined && priority !== null)
          payload.priority = priority

        const createdRaw = await apiClient.createTicket(payload)
        const newTicket = normalizeTicket(createdRaw)

        // Fallback si el backend aún no arma "number"
        if (!newTicket.number || !newTicket.number.trim()) {
          const svc = state.services.find((s) => s.id === serviceId)
          const seq =
            (newTicket.id ?? Math.floor(Math.random() * 1000)) % 1000
          newTicket.number = `${svc?.prefix ?? ""}${String(seq).padStart(
            3,
            "0",
          )}`
        }

        dispatch({ type: "ADD_TICKET", payload: newTicket })
        setTickets((prev) => [toWithRelations([newTicket])[0], ...prev])
        return newTicket
      } else {
        const service = state.services.find((s) => s.id === serviceId)
        if (!service) throw new Error("Service not found")

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const todayTickets = state.tickets.filter(
          (t) => t.serviceId === serviceId && t.createdAt >= today,
        )
        const nextNumber = todayTickets.length + 1
        const ticketNumber = `${service.prefix}${nextNumber
          .toString()
          .padStart(3, "0")}`

        const queuePosition =
          TimeEstimationService.getQueuePosition(state.tickets, serviceId)
        const activeOperators = state.operators.filter((op) => op.active).length
        const client = clientId
          ? state.clients.find((c) => c.id === clientId)
          : null

        const estimatedWaitTime = TimeEstimationService.getEstimatedWaitTime(
          serviceId,
          queuePosition,
          service.estimatedTime,
          {
            availableOperators: activeOperators,
            queueLength: queuePosition,
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            operatorEfficiency: 1.0,
            serviceComplexity: service.estimatedTime,
            clientType: client?.vip ? "vip" : "regular",
          },
        )

        const effectivePriority =
          normalizePriorityLevel(priority ?? service.priority) ??
          service.priority ??
          0

        const newTicket: Ticket = {
          id: Math.max(...state.tickets.map((t) => t.id), 0) + 1,
          number: ticketNumber,
          serviceId,
          status: Status.WAITING,
          priority: effectivePriority,
          createdAt: new Date(),
          calledAt: null,
          startedAt: null,
          completedAt: null,
          attentionDuration: null,
          operatorId: null,
          estimatedWaitTime,
          actualWaitTime: null,
          mobilePhone: mobilePhone || null,
          notificationSent: false,
          almostReadyNotificationSentAt: null,
          clientId: clientId ?? null,
        }

        dispatch({ type: "ADD_TICKET", payload: newTicket })
        setTickets((prev) => [toWithRelations([newTicket])[0], ...prev])
        return newTicket
      }
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Error creating ticket"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // NUEVO: llamar un ticket puntual (WAITING -> CALLED)
  const callTicket = async (id: number, operatorId: number) => {
    try {
      setError(null)

      if (isApiMode) {
        if (publicMode) {
          throw new Error("Llamar ticket no está disponible en modo público")
        }
        setLoading(true)

        const updatedTicketRaw = await apiClient.callTicket(id, operatorId)
        const updatedTicket = normalizeTicket(updatedTicketRaw)

        // 🔊 y notificación
        try {
          const service = state.services.find(
            (s) => s.id === updatedTicket.serviceId,
          )
          await audioService.playTicketCalled(
            updatedTicket.number,
            service?.name || "Servicio",
          )
        } catch {}

        if (updatedTicket.mobilePhone) {
          const service = state.services.find(
            (s) => s.id === updatedTicket.serviceId,
          )
          const client = updatedTicket.clientId
            ? state.clients.find((c) => c.id === updatedTicket.clientId)
            : null
          await notificationService.notifyTicketCalled(
            updatedTicket.id,
            updatedTicket.number,
            service?.name || "Servicio",
            updatedTicket.mobilePhone,
            client?.name,
          )
        }

        dispatch({
          type: "UPDATE_TICKET",
          payload: { id, data: updatedTicket },
        })
        setTickets((prev) =>
          prev.map((t) =>
            t.id === id ? toWithRelations([updatedTicket])[0] : t,
          ),
        )

        return updatedTicket
      }

      // ---- MODO LOCAL (sin API) ----
      await updateTicketStatus(id, Status.CALLED, operatorId)
      return state.tickets.find((t) => t.id === id) ?? null
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Error calling ticket"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const updateTicketStatus = async (
    id: number,
    status: Status,
    operatorId?: number,
  ): Promise<TicketWithRelations | null> => {
    try {
      setError(null)

      let updatedTicket: Ticket | null = null

      if (isApiMode) {
        if (publicMode) {
          throw new Error("Actualizar estado no está disponible en modo público")
        }
        setLoading(true)

        // 👉 Ruteamos por endpoint específico según transición
        const statusWire = typeof status === "string" ? status : String(status)

        if (status === Status.CALLED) {
          if (!operatorId) {
            throw new ApiError(
              400,
              "operatorId es requerido para llamar un ticket",
            )
          }
          const updated = normalizeTicket(await callTicket(id, operatorId))
          updatedTicket = updated
        }

        if (status === Status.IN_PROGRESS) {
          updatedTicket = normalizeTicket(await apiClient.startTicket(id))
        } else if (status === Status.COMPLETED) {
          updatedTicket = normalizeTicket(await apiClient.completeTicket(id))
        } else if (status === Status.ABSENT) {
          updatedTicket = normalizeTicket(await apiClient.markAbsent(id))
        } else if (status === Status.WAITING) {
          updatedTicket = normalizeTicket(await apiClient.reintegrateTicket(id))
        } else if (!updatedTicket) {
          throw new ApiError(
            409,
            `Transición no soportada desde el hook: ${statusWire}`,
          )
        }

        if (updatedTicket) {
          dispatch({
            type: "UPDATE_TICKET",
            payload: { id, data: updatedTicket },
          })
          const updatedWithRelations = toWithRelations([updatedTicket])[0]
          setTickets((prev) =>
            prev.map((t) => (t.id === id ? updatedWithRelations : t)),
          )
          return updatedWithRelations
        }

        return null
      }

      // ---- MODO LOCAL (sin API) ----
      const updateData: Partial<Ticket> = { status }
      if (operatorId) updateData.operatorId = operatorId

      const now = new Date()
      switch (status) {
        case Status.CALLED: {
          updateData.calledAt = now
          updateData.startedAt = null
          updateData.completedAt = null
          updateData.attentionDuration = null
          updateData.requeuedAt = null
          const ticket = state.tickets.find((t) => t.id === id)
          if (ticket?.mobilePhone) {
            const service = state.services.find((s) => s.id === ticket.serviceId)
            const client = ticket.clientId
              ? state.clients.find((c) => c.id === ticket.clientId)
              : null
            await notificationService.notifyTicketCalled(
              ticket.id,
              ticket.number,
              service?.name || "Servicio",
              ticket.mobilePhone,
              client?.name,
            )
          }
          try {
            const service = state.services.find(
              (s) => s.id === ticket?.serviceId,
            )
            if (ticket)
              await audioService.playTicketCalled(
                ticket.number,
                service?.name || "Servicio",
              )
          } catch {}
          break
        }
        case Status.IN_PROGRESS:
          updateData.startedAt = now
          updateData.attentionDuration = 0
          break
        case Status.COMPLETED: {
          updateData.completedAt = now
          const ticket = state.tickets.find((t) => t.id === id)
          if (ticket) {
            updateData.actualWaitTime = Math.round(
              (now.getTime() - ticket.createdAt.getTime()) / 60000,
            )
            if (ticket.startedAt) {
              const actualServiceTime = Math.round(
                (now.getTime() - ticket.startedAt.getTime()) / 60000,
              )
              TimeEstimationService.updateHistoricalData(
                ticket.serviceId,
                actualServiceTime,
                operatorId,
              )
              updateData.attentionDuration = Math.max(
                0,
                Math.round(
                  (now.getTime() - ticket.startedAt.getTime()) / 1000,
                ),
              )
            }
          }
          break
        }
        case Status.ABSENT: {
          // CALLED -> ABSENT: liberar operador
          updateData.operatorId = null
          updateData.absentAt = now
          updateData.requeuedAt = null
          break
        }
        case Status.WAITING: {
          // ABSENT -> WAITING: vuelve a la cola (limpiamos llamado/atención)
          updateData.operatorId = null
          updateData.calledAt = null
          updateData.startedAt = null
          updateData.completedAt = null
          updateData.attentionDuration = null
          updateData.absentAt = null
          updateData.requeuedAt = now
          break
        }
      }

      dispatch({ type: "UPDATE_TICKET", payload: { id, data: updateData } })

      const existingTicket = state.tickets.find((t) => t.id === id) ?? null
      const mergedTicket = existingTicket
        ? ({ ...existingTicket, ...updateData } as Ticket)
        : null
      const updatedWithRelations = mergedTicket
        ? toWithRelations([mergedTicket])[0]
        : null

      setTickets((prev) =>
        prev.map((t) => (t.id === id ? updatedWithRelations ?? t : t)),
      )

      return updatedWithRelations
    } catch (err) {
      const errorMessage =
        err instanceof ApiError
          ? err.message
          : "Error updating ticket status"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // 🔄 Llamar siguiente ticket: en modo API solo se usa operatorId,
  // el backend decide el servicio; en modo local, serviceId es opcional.
  const callNextTicket = async (
    operatorId: number,
    serviceId?: number,
  ): Promise<Ticket | null> => {
    try {
      setError(null)

      const opId = Number(operatorId)
      if (!Number.isInteger(opId) || opId <= 0) {
        throw new Error("IDs inválidos: operatorId debe ser numérico")
      }

      if (isApiMode) {
        if (publicMode) {
          throw new Error(
            "Llamar siguiente ticket no está disponible en modo público",
          )
        }
        setLoading(true)

        // 🟢 Nuevo: el backend decide el ticket en base al operador
        const nextTicketRaw = await apiClient.callNextTicketForOperator(opId)

        if (nextTicketRaw) {
          const nextTicket = normalizeTicket(nextTicketRaw)

          // 🔊 sonido “ticket-called”
          try {
            const service = state.services.find(
              (s) => s.id === nextTicket.serviceId,
            )
            await audioService.playTicketCalled(
              nextTicket.number,
              service?.name || "Servicio",
            )
          } catch {}

          dispatch({
            type: "UPDATE_TICKET",
            payload: { id: nextTicket.id, data: nextTicket },
          })
          setTickets((prev) =>
            prev.map((t) =>
              t.id === nextTicket.id
                ? toWithRelations([nextTicket])[0]
                : t,
            ),
          )

          if (nextTicket.mobilePhone) {
            const service = state.services.find(
              (s) => s.id === nextTicket.serviceId,
            )
            const client = nextTicket.clientId
              ? state.clients.find((c) => c.id === nextTicket.clientId)
              : null
            await notificationService.notifyTicketCalled(
              nextTicket.id,
              nextTicket.number,
              service?.name || "Servicio",
              nextTicket.mobilePhone,
              client?.name,
            )
          }

          return nextTicket
        }

        return null
      }

      // ---- MODO LOCAL (sin API) ----
      const svcId = serviceId ? Number(serviceId) : NaN

      const candidateTickets = state.tickets
        .filter((t) => {
          if (t.status !== Status.WAITING) return false
          if (Number.isInteger(svcId) && svcId > 0) {
            // Si se pasó serviceId, filtramos por ese servicio
            return t.serviceId === svcId
          }
          // Si NO se pasó serviceId, tomamos cualquiera en espera
          return true
        })
        .sort(compareTicketsByQueue)

      const nextTicket = candidateTickets[0]

      if (nextTicket) {
        try {
          const service = state.services.find(
            (s) => s.id === nextTicket.serviceId,
          )
          await audioService.playTicketCalled(
            nextTicket.number,
            service?.name || "Servicio",
          )
        } catch {}

        await updateTicketStatus(nextTicket.id, Status.CALLED, opId)
        return nextTicket
      }

      return null
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Error calling next ticket"
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const acknowledgeTicketByQr = async (
    id: number,
  ): Promise<TicketWithRelations | null> => {
    try {
      setError(null)

      if (isApiMode) {
        if (publicMode) {
          throw new Error(
            "Registrar escaneo no está disponible en modo público",
          )
        }
        const updatedTicketRaw = await apiClient.registerTicketQrScan(id)
        const updatedTicket = normalizeTicket(updatedTicketRaw)
        const withRelations = toWithRelations([updatedTicket])[0]

        dispatch({
          type: "UPDATE_TICKET",
          payload: { id, data: updatedTicket },
        })
        setTickets((prev) =>
          prev.map((ticket) => (ticket.id === id ? withRelations : ticket)),
        )

        if (updatedTicket.mobilePhone) {
          const service = state.services.find(
            (s) => s.id === updatedTicket.serviceId,
          )
          const client = updatedTicket.clientId
            ? state.clients.find((c) => c.id === updatedTicket.clientId)
            : null
          await notificationService.notifyScanConfirmed(
            updatedTicket.id,
            updatedTicket.number,
            service?.name || "Servicio",
            updatedTicket.mobilePhone,
            client?.name,
          )
        }

        return withRelations
      }

      const ticket = state.tickets.find((t) => t.id === id)
      if (!ticket) throw new Error("Ticket no encontrado")

      const qrScannedAt = new Date()
      const updateData: Partial<Ticket> = { qrScannedAt }

      dispatch({ type: "UPDATE_TICKET", payload: { id, data: updateData } })

      const mergedTicket = { ...ticket, ...updateData } as Ticket
      const withRelations = toWithRelations([mergedTicket])[0]

      setTickets((prev) =>
        prev.map((t) => (t.id === id ? withRelations : t)),
      )

      if (mergedTicket.mobilePhone) {
        const service = state.services.find(
          (s) => s.id === mergedTicket.serviceId,
        )
        const client = mergedTicket.clientId
          ? state.clients.find((c) => c.id === mergedTicket.clientId)
          : null
        await notificationService.notifyScanConfirmed(
          mergedTicket.id,
          mergedTicket.number,
          service?.name || "Servicio",
          mergedTicket.mobilePhone,
          client?.name,
        )
      }

      return withRelations
    } catch (err) {
      const errorMessage =
        err instanceof ApiError ? err.message : "Error registrando escaneo"
      setError(errorMessage)
      throw err
    }
  }

  const getTicketsWithRelations = (): TicketWithRelations[] =>
    toWithRelations(state.tickets)

  const getTicketsByStatus = (status: Status) =>
    getTicketsWithRelations().filter((ticket) => ticket.status === status)
  const getTicketsByService = (serviceId: number) =>
    getTicketsWithRelations().filter((ticket) => ticket.serviceId === serviceId)

  const getTodayTickets = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return getTicketsWithRelations().filter(
      (ticket) => ticket.createdAt >= today,
    )
  }

  const recalculateWaitTimes = () => {
    const updatedTickets =
      TimeEstimationService.recalculateAllWaitTimes(
        state.tickets,
        state.services,
        state.operators,
      )
    updatedTickets.forEach((ticket) => {
      const originalTicket = state.tickets.find((t) => t.id === ticket.id)
      if (
        originalTicket &&
        ticket.estimatedWaitTime !== originalTicket.estimatedWaitTime
      ) {
        dispatch({
          type: "UPDATE_TICKET",
          payload: {
            id: ticket.id,
            data: { estimatedWaitTime: ticket.estimatedWaitTime },
          },
        })
      }
    })
  }

  const getPrecisionMetrics = (serviceId: number) => {
    return TimeEstimationService.getPrecisionMetrics(serviceId)
  }

  return {
    tickets,
    loading,
    error,
    createTicket,
    updateTicketStatus,
    callTicket, // ⬅️ llamar puntual
    callNextTicket, // ⬅️ ahora usa operatorId en API mode
    checkAndNotifyAlmostReady,
    getTicketsWithRelations,
    getTicketsByStatus,
    getTicketsByService,
    getTodayTickets,
    recalculateWaitTimes,
    getPrecisionMetrics,
    refetch: fetchTickets,
    acknowledgeTicketByQr,
  }
}
