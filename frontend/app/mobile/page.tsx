"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { QrCode, Clock, Users, MapPin, Bell, CheckCircle, AlertCircle, Smartphone } from 'lucide-react'
import Link from "next/link"
import { useServices } from "@/hooks/use-services"
import { useTickets } from "@/hooks/use-tickets"
import { useQueueStatus } from "@/hooks/use-queue-status"
import { Status } from "@/lib/types"
import { useQueue } from "@/contexts/queue-context"
import { getBooleanSetting } from "@/lib/system-settings"
import { getServiceIcon } from "@/lib/service-icons"

export default function MobilePage() {
  const [hasTicket, setHasTicket] = useState(false)
  const [userTicket, setUserTicket] = useState<any>(null)
  const [mobilePhone, setMobilePhone] = useState("")
  const [notifications, setNotifications] = useState(true)

  const { getActiveServices } = useServices()
  const { createTicket, getTicketsWithRelations } = useTickets()
  const { getQueueStatus, currentTime } = useQueueStatus()
  const { state } = useQueue()

  const services = getActiveServices()
  const queueStatus = getQueueStatus()
  const showWaitTimes = getBooleanSetting(state.settings, "showWaitTimes", true)

  // Simular seguimiento de turno existente
  useEffect(() => {
    const savedTicketId = localStorage.getItem('mobile-ticket-id')
    if (savedTicketId) {
      const allTickets = getTicketsWithRelations()
      const ticket = allTickets.find(t => t.id === parseInt(savedTicketId))
      if (ticket && ticket.status !== Status.COMPLETED && ticket.status !== Status.CANCELLED) {
        setUserTicket(ticket)
        setHasTicket(true)
      } else {
        localStorage.removeItem('mobile-ticket-id')
      }
    }
  }, [])

  // Actualizar estado del ticket cada 5 segundos
  useEffect(() => {
    if (hasTicket && userTicket) {
      const interval = setInterval(() => {
        const allTickets = getTicketsWithRelations()
        const updatedTicket = allTickets.find(t => t.id === userTicket.id)
        if (updatedTicket) {
          setUserTicket(updatedTicket)
          
          // Si el ticket fue completado, limpiar
          if (updatedTicket.status === Status.COMPLETED) {
            setTimeout(() => {
              setHasTicket(false)
              setUserTicket(null)
              localStorage.removeItem('mobile-ticket-id')
            }, 10000) // Mostrar por 10 segundos más
          }
        }
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [hasTicket, userTicket])

  const handleGetTicket = async (serviceId: number) => {
    try {
      const newTicket = await createTicket(serviceId, mobilePhone || undefined)
      const allTickets = getTicketsWithRelations()
      const ticketWithRelations = allTickets.find(t => t.id === newTicket.id)

      const fallbackTicket = ticketWithRelations ?? {
        ...newTicket,
        service: services.find(s => s.id === serviceId) ?? null,
        operator: null,
        client: null,
      }

      setUserTicket(fallbackTicket)
      setHasTicket(true)
      if (newTicket?.id != null) {
        localStorage.setItem('mobile-ticket-id', String(newTicket.id))
      }
    } catch (error) {
      console.error('Error creating ticket:', error)
      alert('Error al generar el turno. Por favor intente nuevamente.')
    }
  }

  const handleCancelTicket = () => {
    if (userTicket) {
      // En un sistema real, aquí actualizaríamos el estado a CANCELLED
      setHasTicket(false)
      setUserTicket(null)
      localStorage.removeItem('mobile-ticket-id')
    }
  }

  const getPositionInQueue = () => {
    if (!userTicket) return 0
    
    const waitingTickets = getTicketsWithRelations()
      .filter(t => 
        t.serviceId === userTicket.serviceId && 
        t.status === Status.WAITING &&
        t.createdAt < userTicket.createdAt
      )
    
    return waitingTickets.length
  }

  const getEstimatedWaitTime = () => {
    const position = getPositionInQueue()
    const service = services.find(s => s.id === userTicket?.serviceId)
    return position * (service?.estimatedTime || 10)
  }

  const getProgressPercentage = () => {
    if (!userTicket) return 0
    
    const totalTicketsToday = getTicketsWithRelations()
      .filter(t => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return t.serviceId === userTicket.serviceId && t.createdAt >= today
      }).length

    const completedBefore = getTicketsWithRelations()
      .filter(t => 
        t.serviceId === userTicket.serviceId &&
        t.status === Status.COMPLETED &&
        t.createdAt < userTicket.createdAt
      ).length

    return totalTicketsToday > 0 ? (completedBefore / totalTicketsToday) * 100 : 0
  }

  if (hasTicket && userTicket) {
    const position = getPositionInQueue()
    const estimatedTime = getEstimatedWaitTime()
    const progress = getProgressPercentage()
    const currentTicket = queueStatus.currentTicket
    const TicketServiceIcon = getServiceIcon(userTicket.service?.icon)

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-sm">DT</span>
              </div>
              <span className="text-lg font-bold text-gray-800">DrizaTx</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Mi Turno</h1>
            <p className="text-gray-600">Centro de Atención al Cliente</p>
            <p className="text-sm text-gray-500">{currentTime.toLocaleTimeString()}</p>
          </div>

          {/* Estado del turno */}
          {userTicket.status === Status.COMPLETED ? (
            <Card className="mb-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                <div className="text-3xl font-bold mb-2">¡Completado!</div>
                <p className="text-green-100 mb-4">Tu turno {userTicket.number} ha sido atendido</p>
                <p className="text-sm text-green-200">
                  Gracias por usar nuestro sistema
                </p>
              </CardContent>
            </Card>
          ) : userTicket.status === Status.IN_PROGRESS ? (
            <Card className="mb-6 bg-gradient-to-r from-orange-500 to-red-600 text-white animate-pulse">
              <CardContent className="p-6 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <div className="text-3xl font-bold mb-2">¡ES TU TURNO!</div>
                <div className="text-5xl font-bold mb-2">{userTicket.number}</div>
                <p className="text-orange-100 mb-2">Diríjase inmediatamente al</p>
                <p className="text-xl font-bold">{userTicket.operator?.position || 'Puesto de Atención'}</p>
              </CardContent>
            </Card>
          ) : userTicket.status === Status.CALLED ? (
            <Card className="mb-6 bg-gradient-to-r from-yellow-500 to-orange-600 text-white animate-pulse">
              <CardContent className="p-6 text-center">
                <Bell className="h-12 w-12 mx-auto mb-4" />
                <div className="text-3xl font-bold mb-2">¡Te están llamando!</div>
                <div className="text-5xl font-bold mb-2">{userTicket.number}</div>
                <p className="text-yellow-100 mb-2">Acércate al</p>
                <p className="text-xl font-bold">{userTicket.operator?.position || 'Puesto de Atención'}</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <CardContent className="p-6 text-center space-y-4">
                <div className="flex items-center justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20 text-white">
                    <TicketServiceIcon className="h-6 w-6" />
                  </div>
                </div>
                <div>
                  <div className="text-5xl font-bold mb-2">{userTicket.number}</div>
                  <p className="text-blue-100">{userTicket.service.name}</p>
                </div>
                <Badge className="bg-white/20 text-white">Tu turno</Badge>
              </CardContent>
            </Card>
          )}

          {/* Estado actual */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Estado Actual
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentTicket && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Turno en atención:</span>
                    <span className="font-bold text-lg">{currentTicket.number}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Tu posición:</span>
                  <Badge variant="secondary">
                    {userTicket.status === Status.WAITING ? `${position} en cola` : 
                     userTicket.status === Status.CALLED ? 'Llamado' :
                     userTicket.status === Status.IN_PROGRESS ? 'En atención' : 'Completado'}
                  </Badge>
                </div>

                {userTicket.status === Status.WAITING && (
                  <>
                    {showWaitTimes && (
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Tiempo estimado:</span>
                        <span className="font-medium text-green-600">{estimatedTime} min</span>
                      </div>
                    )}

                    <div className="mt-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Progreso</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notificaciones */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-600" />
                Notificaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Turno confirmado</p>
                    <p className="text-xs text-gray-600">
                      {userTicket.createdAt.toLocaleTimeString()} - Tu turno ha sido registrado exitosamente
                    </p>
                  </div>
                </div>

                {userTicket.status === Status.WAITING && position <= 3 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Mantente cerca</p>
                      <p className="text-xs text-gray-600">
                        {showWaitTimes
                          ? `Te llamaremos en aproximadamente ${estimatedTime} minutos`
                          : "Te avisaremos cuando sea tu turno"}
                      </p>
                    </div>
                  </div>
                )}

                {notifications && userTicket.mobilePhone && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <Smartphone className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">SMS habilitado</p>
                      <p className="text-xs text-gray-600">
                        Te enviaremos un mensaje cuando sea tu turno
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Información adicional */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-green-600" />
                Información del Local
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Dirección:</strong> Av. Corrientes 1234, CABA
                </p>
                <p>
                  <strong>Horario:</strong> Lunes a Viernes 8:00 - 18:00
                </p>
                <p>
                  <strong>Teléfono:</strong> (011) 4567-8900
                </p>
                <p className="flex items-center gap-2">
                  <strong className="flex items-center gap-2">
                    <TicketServiceIcon className="h-4 w-4 text-primary" />
                    Servicio:
                  </strong>
                  <span>{userTicket.service.name}</span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Acciones */}
          <div className="space-y-3">
            {!notifications && (
              <Button 
                className="w-full bg-transparent" 
                variant="outline"
                onClick={() => setNotifications(true)}
              >
                <Bell className="h-4 w-4 mr-2" />
                Activar Notificaciones
              </Button>
            )}

            {userTicket.status === Status.WAITING && (
              <Button 
                className="w-full" 
                variant="destructive" 
                onClick={handleCancelTicket}
              >
                Cancelar Turno
              </Button>
            )}

            {userTicket.status === Status.COMPLETED && (
              <Link href="/terminal">
                <Button className="w-full">
                  Obtener Nuevo Turno
                </Button>
              </Link>
            )}
          </div>

          <div className="text-center mt-6 text-sm text-gray-500">
            <p>Mantén esta pantalla abierta para recibir actualizaciones</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 p-4 z-50 overflow-auto">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-between items-center mb-4">
            <Link href="/">
              <Button variant="outline" size="sm">
                ← Volver
              </Button>
            </Link>
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">DT</span>
            </div>
            <div></div>
          </div>
          <div className="mb-4">
            <span className="text-2xl font-bold text-gray-800">DrizaTx</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Turnos Móviles</h1>
          <p className="text-gray-600">Obtén tu turno sin hacer cola</p>
        </div>

        {/* Campo para teléfono móvil */}
        <Card className="mb-6 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          <CardContent className="p-6 text-center">
            <Smartphone className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">¿Quieres recibir notificaciones?</h3>
            <input
              type="tel"
              placeholder="Número de celular (opcional)"
              value={mobilePhone}
              onChange={(e) => setMobilePhone(e.target.value)}
              className="w-full p-3 border rounded-md text-center text-gray-800 mb-4"
            />
            <p className="text-purple-100 text-sm">
              Te enviaremos un SMS cuando sea tu turno
            </p>
          </CardContent>
        </Card>

        {/* QR Scanner alternativo */}
        <Card className="mb-6 bg-gradient-to-r from-indigo-500 to-blue-500 text-white">
          <CardContent className="p-6 text-center">
            <QrCode className="h-12 w-12 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">¿Tienes un código QR?</h3>
            <p className="text-blue-100 text-sm mb-4">Escanea el código de tu ticket físico para seguir tu turno</p>
            <Button variant="secondary" className="w-full">
              Escanear Código QR
            </Button>
          </CardContent>
        </Card>

        {/* Servicios disponibles */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Selecciona un Servicio</h2>

          {services.map((service) => {
            const ServiceIcon = getServiceIcon(service.icon)
            const serviceStats = queueStatus.queues.find(q => q.id === service.id)
            return (
              <Card key={service.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <ServiceIcon className="h-5 w-5" />
                      </div>
                      <h3 className="font-bold text-lg">{service.name}</h3>
                    </div>
                    <Badge variant={
                      (serviceStats?.waitingCount || 0) > 15
                        ? "destructive"
                        : (serviceStats?.waitingCount || 0) > 10
                          ? "secondary" 
                          : "default"
                    }>
                      {(serviceStats?.waitingCount || 0) > 15 
                        ? "Cola Larga" 
                        : (serviceStats?.waitingCount || 0) > 10 
                          ? "Cola Media" 
                          : "Cola Corta"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                    {showWaitTimes && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{serviceStats?.averageTime || service.estimatedTime} min</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{serviceStats?.waitingCount || 0} en cola</span>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    onClick={() => handleGetTicket(service.id)} 
                    disabled={(serviceStats?.waitingCount || 0) > 20}
                  >
                    {(serviceStats?.waitingCount || 0) > 20 ? "No Disponible" : "Obtener Turno"}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Información adicional */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h3 className="font-bold text-blue-900 mb-2">¿Cómo funciona?</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Selecciona el servicio que necesitas</li>
              <li>• Recibe tu número de turno al instante</li>
              <li>• Sigue el progreso en tiempo real</li>
              <li>• Recibe notificaciones cuando sea tu turno</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
