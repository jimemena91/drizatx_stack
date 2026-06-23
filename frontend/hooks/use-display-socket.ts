"use client"

import { useEffect, useRef, useState } from "react"
import { io, type Socket } from "socket.io-client"
import type { TicketWithRelations } from "@/lib/types"

type TicketCalledEvent = {
  type: "ticket.called"
  eventId: string
  clientKey: string
  emittedAt: string
  payload: {
    ticketId: number
    number: string
    serviceName?: string | null
    counterName?: string | null
    operatorId?: number | null
    calledAt: string
  }
}

type QueueUpdatedEvent = {
  type: "queue.updated"
  eventId: string
  clientKey: string
  emittedAt: string
  payload?: Record<string, unknown>
}

type DisplayConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error"

function getDisplaySocketUrl() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"
  return `${apiUrl.replace(/\/$/, "")}/display`
}

function mapTicketCalledToTicket(event: TicketCalledEvent): TicketWithRelations {
  const payload = event.payload

  return {
    id: payload.ticketId,
    number: payload.number,
    status: "CALLED",
    calledAt: payload.calledAt,
    operatorId: payload.operatorId ?? null,
    service: {
      id: 0,
      name: payload.serviceName || "Servicio",
    } as any,
    operator: payload.counterName
      ? ({
          id: payload.operatorId ?? 0,
          name: payload.counterName,
          position: payload.counterName,
        } as any)
      : null,
  } as TicketWithRelations
}

export function useDisplaySocket(options?: {
  enabled?: boolean
  clientKey?: string
  screen?: string
}) {
  const enabled = options?.enabled ?? process.env.NEXT_PUBLIC_API_MODE === "true"
  const clientKey = options?.clientKey ?? "staging"
  const screen = options?.screen ?? "display"

  const socketRef = useRef<Socket | null>(null)
  const lastEventIdsRef = useRef<Set<string>>(new Set())

  const [status, setStatus] = useState<DisplayConnectionStatus>("idle")
  const [liveTicket, setLiveTicket] = useState<TicketWithRelations | null>(null)
  const [lastQueueUpdatedAt, setLastQueueUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setStatus("idle")
      return
    }

    setStatus("connecting")

    const socket = io(getDisplaySocketUrl(), {
      transports: ["websocket"],
      query: { clientKey, screen },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current = socket

    const rememberEvent = (eventId?: string | null) => {
      if (!eventId) return true
      if (lastEventIdsRef.current.has(eventId)) return false

      lastEventIdsRef.current.add(eventId)

      if (lastEventIdsRef.current.size > 100) {
        const first = lastEventIdsRef.current.values().next().value
        if (first) lastEventIdsRef.current.delete(first)
      }

      return true
    }

    socket.on("connect", () => setStatus("connected"))
    socket.on("disconnect", () => setStatus("disconnected"))
    socket.on("connect_error", (error) => {
      console.warn("[useDisplaySocket] connection error:", error.message)
      setStatus("error")
    })

    socket.on("ticket.called", (event: TicketCalledEvent) => {
      if (!rememberEvent(event.eventId)) return
      setLiveTicket(mapTicketCalledToTicket(event))
    })

    socket.on("queue.updated", (event: QueueUpdatedEvent) => {
      if (!rememberEvent(event.eventId)) return
      setLastQueueUpdatedAt(event.emittedAt)
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [enabled, clientKey, screen])

  return {
    status,
    liveTicket,
    lastQueueUpdatedAt,
  }
}
