"use client"

import { useEffect, useRef } from "react"
import { io } from "socket.io-client"

export function useQueueRealtime(onQueueUpdated: () => void) {
  const callbackRef = useRef(onQueueUpdated)

  useEffect(() => {
    callbackRef.current = onQueueUpdated
  }, [onQueueUpdated])

  useEffect(() => {
    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

    const socketUrl = `${apiUrl.replace(/\/$/, "")}/display`

    console.info("[operator-realtime] connecting", socketUrl)

    const socket = io(socketUrl, {
      transports: ["websocket"],
      query: {
        clientKey: "staging",
        screen: "operator",
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socket.on("connect", () => {
      console.info("[operator-realtime] connected", socket.id)
    })

    socket.on("disconnect", (reason) => {
      console.warn("[operator-realtime] disconnected", reason)
    })

    socket.on("connect_error", (error) => {
      console.error("[operator-realtime] connection error", error.message)
    })

    socket.on("queue.updated", (event) => {
      console.info("[operator-realtime] queue.updated", event)
      void callbackRef.current()
    })

    return () => {
      console.info("[operator-realtime] cleanup")
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [])
}
