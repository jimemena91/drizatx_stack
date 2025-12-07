"use client"

import { useEffect, useState } from "react"
import { Bell, X, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface NotificationToastProps {
  message: string
  type: "sms" | "push" | "info"
  onClose: () => void
  duration?: number
}

export function NotificationToast({ message, type, onClose, duration = 5000 }: NotificationToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) // Esperar animación
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  const getIcon = () => {
    switch (type) {
      case "sms":
        return <Smartphone className="h-4 w-4 text-green-600" />
      case "push":
        return <Bell className="h-4 w-4 text-blue-600" />
      default:
        return <Bell className="h-4 w-4 text-gray-600" />
    }
  }

  const getBgColor = () => {
    switch (type) {
      case "sms":
        return "bg-green-50 border-green-200"
      case "push":
        return "bg-blue-50 border-blue-200"
      default:
        return "bg-gray-50 border-gray-200"
    }
  }

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
      }`}
    >
      <Card className={`w-80 ${getBgColor()}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {getIcon()}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {type === "sms" ? "SMS Enviado" : type === "push" ? "Notificación Push" : "Notificación"}
              </p>
              <p className="text-xs text-gray-600 mt-1">{message}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsVisible(false)
                setTimeout(onClose, 300)
              }}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
