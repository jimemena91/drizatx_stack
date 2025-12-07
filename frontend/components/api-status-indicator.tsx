"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { checkBackendHealth, isApiMode } from "@/lib/api-mode"
import { Wifi, WifiOff } from "lucide-react"

export function ApiStatusIndicator() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const apiMode = isApiMode()

  useEffect(() => {
    if (!apiMode) {
      setIsConnected(null)
      return
    }

    const checkConnection = async () => {
      setIsChecking(true)
      const connected = await checkBackendHealth()
      setIsConnected(connected)
      setIsChecking(false)
    }

    checkConnection()

    // Verificar conexión cada 30 segundos
    const interval = setInterval(checkConnection, 30000)
    return () => clearInterval(interval)
  }, [apiMode])

  if (!apiMode) {
    return (
      <Badge variant="secondary" className="gap-1">
        <WifiOff className="h-3 w-3" />
        Modo Simulado
      </Badge>
    )
  }

  if (isChecking || isConnected === null) {
    return (
      <Badge variant="outline" className="gap-1">
        <div className="h-3 w-3 animate-pulse rounded-full bg-gray-400" />
        Verificando...
      </Badge>
    )
  }

  return (
    <Badge variant={isConnected ? "default" : "destructive"} className="gap-1">
      {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {isConnected ? "API Conectada" : "API Desconectada"}
    </Badge>
  )
}
