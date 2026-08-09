"use client"

import { audioService } from "@/lib/audio-service"

type NavigatorWithBadge = Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

class OperatorAlertService {
  private lastWaitingCount = 0

  async requestPermission(): Promise<NotificationPermission | "unsupported"> {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported"
    }

    if (Notification.permission !== "default") {
      return Notification.permission
    }

    return Notification.requestPermission()
  }

  async updateWaitingCount(count: number): Promise<void> {
    if (typeof window === "undefined") return

    const normalizedCount = Math.max(0, Math.floor(count))
    await this.updateBadge(normalizedCount)

    if (normalizedCount > this.lastWaitingCount) {
      await this.notify(normalizedCount)
      await audioService.playAttentionAlert()
    }

    this.lastWaitingCount = normalizedCount
  }

  async clear(): Promise<void> {
    this.lastWaitingCount = 0
    await this.updateBadge(0)
  }

  private async notify(waitingCount: number): Promise<void> {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      return
    }

    const body =
      waitingCount === 1
        ? "Hay 1 ticket esperando atención."
        : `Hay ${waitingCount} tickets esperando atención.`

    const notification = new Notification("DrizaTx Operador", {
      body,
      icon: "/drizatx-icon-512.png",
      badge: "/drizatx-icon-512.png",
      tag: "drizatx-waiting-tickets",
      requireInteraction: true,
    })

    notification.onclick = () => {
      window.focus()
      window.location.assign("/operator")
      notification.close()
    }
  }

  private async updateBadge(waitingCount: number): Promise<void> {
    const badgeNavigator = navigator as NavigatorWithBadge

    try {
      if (waitingCount > 0 && badgeNavigator.setAppBadge) {
        await badgeNavigator.setAppBadge(waitingCount)
      } else if (waitingCount === 0 && badgeNavigator.clearAppBadge) {
        await badgeNavigator.clearAppBadge()
      }
    } catch (error) {
      console.warn("[pwa] No se pudo actualizar el badge", error)
    }
  }
}

export const operatorAlertService = new OperatorAlertService()
