"use client"

import { useState } from "react"
import { Bell } from "lucide-react"
import { operatorAlertService } from "@/lib/pwa/operator-alert.service"

export function OperatorNotificationPermission() {
  const [hidden, setHidden] = useState(
    typeof Notification !== "undefined" &&
      Notification.permission !== "default",
  )

  if (hidden) return null

  const enableNotifications = async () => {
    const permission = await operatorAlertService.requestPermission()
    if (permission !== "default") setHidden(true)
  }

  return (
    <button
      type="button"
      onClick={() => void enableNotifications()}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-violet-700"
    >
      <Bell className="h-4 w-4" />
      Activar avisos de turnos
    </button>
  )
}
