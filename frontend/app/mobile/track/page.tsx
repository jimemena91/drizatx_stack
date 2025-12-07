"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle, AlertCircle, QrCode } from "lucide-react"
import Link from "next/link"
import { useTickets } from "@/hooks/use-tickets"
import type { TicketWithRelations } from "@/lib/types"

const CONFIRMATION_MESSAGE =
  "Escaneo registrado. Revisá tu celular: recibirás un mensaje cuando quede una sola persona adelante."

export default function TrackTicketPage() {
  const searchParams = useSearchParams()
  const [ticketData, setTicketData] = useState<TicketWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState<{ message: string; timestamp: Date } | null>(null)

  const { getTicketsWithRelations, acknowledgeTicketByQr } = useTickets()
  const lastScanTicketIdRef = useRef<number | null>(null)
  useEffect(() => {
    const ticketNumber = searchParams.get("ticket")
    const ticketId = searchParams.get("id")
    if (ticketNumber && ticketId) {
      // Buscar el ticket en los datos locales
      const tickets = getTicketsWithRelations()
      const ticket = tickets.find((t) => t.id === Number.parseInt(ticketId) && t.number === ticketNumber)

      if (ticket) {
        setTicketData(ticket)
        if (ticket.qrScannedAt) {
          setScanStatus({
            message: CONFIRMATION_MESSAGE,
            timestamp: new Date(ticket.qrScannedAt),
          })
          lastScanTicketIdRef.current = ticket.id
        }
      } else {
        setError("Turno no encontrado")
      }
    } else {
      setError("Datos de turno inválidos")
    }

    setLoading(false)
  }, [searchParams, getTicketsWithRelations])

  useEffect(() => {
    if (!ticketData) return

    if (ticketData.qrScannedAt) {
      setScanStatus({ message: CONFIRMATION_MESSAGE, timestamp: new Date(ticketData.qrScannedAt) })
      lastScanTicketIdRef.current = ticketData.id
      return
    }

    if (lastScanTicketIdRef.current === ticketData.id) {
      return
    }

    lastScanTicketIdRef.current = ticketData.id
    const localTimestamp = new Date()
    setScanStatus({ message: CONFIRMATION_MESSAGE, timestamp: localTimestamp })

    void acknowledgeTicketByQr(ticketData.id)
      .then((updated) => {
        if (!updated) return
        setTicketData(updated)
        if (updated.qrScannedAt) {
          setScanStatus({ message: CONFIRMATION_MESSAGE, timestamp: new Date(updated.qrScannedAt) })
        }
      })
      .catch((err) => {
        console.error("Error registrando escaneo", err)
        setScanStatus((prev) =>
          prev
            ? {
                message: `${CONFIRMATION_MESSAGE} (Hubo un inconveniente al sincronizar, intentá nuevamente más tarde)`,
                timestamp: prev.timestamp,
              }
            : prev,
        )
      })
  }, [ticketData, acknowledgeTicketByQr])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <div className="animate-spin mb-4">
              <QrCode className="h-8 w-8 text-blue-600 mx-auto" />
            </div>
            <p>Cargando información del turno...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !ticketData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Link href="/mobile">
              <Button>Volver a App Móvil</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "WAITING":
        return "bg-yellow-500"
      case "CALLED":
        return "bg-blue-500"
      case "IN_PROGRESS":
        return "bg-green-500"
      case "COMPLETED":
        return "bg-gray-500"
      case "CANCELLED":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "WAITING":
        return "En Espera"
      case "CALLED":
        return "Llamado"
      case "IN_PROGRESS":
        return "En Atención"
      case "COMPLETED":
        return "Completado"
      case "CANCELLED":
        return "Cancelado"
      default:
        return status
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-blue-600" />
              Seguimiento de Turno
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">{ticketData.number}</div>
              <Badge className={getStatusColor(ticketData.status)}>{getStatusText(ticketData.status)}</Badge>
              {ticketData.qrScannedAt && (
                <div className="mt-2">
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                    QR confirmado
                  </Badge>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Servicio:</span>
                <span className="font-medium">{ticketData.service.name}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Creado:</span>
                <span className="font-medium">{new Date(ticketData.createdAt).toLocaleTimeString()}</span>
              </div>

              {ticketData.operator && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Operador:</span>
                  <span className="font-medium">{ticketData.operator.name}</span>
                </div>
              )}

              {ticketData.client && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Cliente:</span>
                  <span className="font-medium">{ticketData.client.name}</span>
                </div>
              )}
            </div>

            {scanStatus && (
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-green-800">{scanStatus.message}</p>
                <p className="text-xs text-green-600 mt-1">
                  Registrado {scanStatus.timestamp.toLocaleTimeString()}
                </p>
              </div>
            )}

            {ticketData.status === "CALLED" && (
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <CheckCircle className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="font-medium text-blue-800">¡Su turno está siendo llamado!</p>
                <p className="text-sm text-blue-600">Diríjase al mostrador de atención</p>
              </div>
            )}

            {ticketData.status === "WAITING" && (
              <div className="bg-yellow-50 p-4 rounded-lg text-center">
                <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <p className="font-medium text-yellow-800">Su turno está en espera</p>
                <p className="text-sm text-yellow-600">Le notificaremos cuando sea llamado</p>
              </div>
            )}

            <div className="flex gap-2">
              <Link href="/mobile" className="flex-1">
                <Button variant="outline" className="w-full bg-transparent">
                  App Móvil
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button className="w-full">Ir al Sistema</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
