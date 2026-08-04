"use client"

import { useEffect } from "react"
import { io } from "socket.io-client"

export function useQueueRealtime(onQueueUpdated: () => void) {
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"

    const socket = io(`${apiUrl.replace(/\/$/, "")}/display`, {
      transports: ["websocket"],
      query: { clientKey: "staging", screen: "operator" },
      reconnection: true,
    })

    socket.on("queue.updated", onQueueUpdated)

    return () => {
      socket.off("queue.updated", onQueueUpdated)
      socket.disconnect()
    }
  }, [onQueueUpdated])
}
