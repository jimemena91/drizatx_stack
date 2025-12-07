"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Printer, ArrowRight, Ticket, User, Search } from "lucide-react"
import { getServiceIcon } from "@/lib/service-icons"
import { useServices } from "@/hooks/use-services"
import { useTickets } from "@/hooks/use-tickets"
import { useClients } from "@/hooks/use-clients"
import { useSystemSettings } from "@/hooks/use-system-settings"
import { sendTicketToPrinter } from "@/lib/print-service"
import { cn } from "@/lib/utils"
import { type Ticket as TicketType, type Service } from "@/lib/types"

const PRIORITY_AUDIENCE: Array<{ label: string; symbol: string }> = [
  { label: "Personas mayores", symbol: "🧓" },
  { label: "Embarazadas", symbol: "🤰" },
  { label: "Movilidad reducida", symbol: "♿" },
]

function isPriorityService(service: Service | null | undefined): boolean {
  if (!service) return false
  const normalizedName = service.name?.trim().toLowerCase() ?? ""
  if (normalizedName.includes("priori")) return true
  if (typeof service.priority === "number" && Number.isFinite(service.priority)) {
    return service.priority >= 6
  }
  return false
}

function PriorityAudienceIcons({
  className,
  size = "md",
}: {
  className?: string
  size?: "sm" | "md"
}) {
  const isSmall = size === "sm"
  const iconWrapperClasses = cn(
    "flex items-center justify-center rounded-full bg-slate-100",
    isSmall ? "h-10 w-10 text-xl" : "h-12 w-12 text-2xl",
  )
  const labelClasses = cn(
    "mt-2 text-center font-medium text-slate-600",
    isSmall ? "text-[10px] leading-tight" : "text-xs",
  )

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center justify-center gap-4 text-slate-600",
        isSmall ? "gap-3" : "gap-4",
        className,
      )}
    >
      <span className="sr-only">
        Atención prioritaria para personas mayores, embarazadas y con movilidad reducida
      </span>
      {PRIORITY_AUDIENCE.map(({ label, symbol }) => (
        <div key={label} className="flex flex-col items-center">
          <span className={iconWrapperClasses} aria-hidden="true">
            <span>{symbol}</span>
          </span>
          <span className={labelClasses}>{label}</span>
        </div>
      ))}
    </div>
  )
}

export default function TerminalPage() {
  // --- Estado principal ---
  const [selectedService, setSelectedService] = useState<number | null>(null)
  const [showTicket, setShowTicket] = useState(false)
  const [activeTicketInfo, setActiveTicketInfo] = useState<
    { ticket: TicketType; service: Service; clientName?: string | null } | null
  >(null)
  const [creating, setCreating] = useState(false)

  // Cliente (opcional)
  const [dni, setDni] = useState("")
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null)
  const [clientNotFound, setClientNotFound] = useState(false)
  const [clientLookupError, setClientLookupError] = useState<string | null>(null)
  const [showClientForm, setShowClientForm] = useState(false)
  const isClientLookupEnabled = false

  // Impresión / feedback
  const [printMessage, setPrintMessage] = useState<string | null>(null)
  const [printTimestamp, setPrintTimestamp] = useState<Date | null>(null)
  const [thankYouMessage, setThankYouMessage] = useState<string | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)

  // Debug overlay (?debug=1)
  const [debug, setDebug] = useState(false)

  // Refs
  const dniInputRef = useRef<HTMLInputElement>(null)
  const redirectTimeoutRef = useRef<number | null>(null)
  const lastAutoPrintTicketRef = useRef<string | null>(null)

  // Data hooks
  const { getActiveServices } = useServices({ publicMode: true })
  const { createTicket, getTicketsWithRelations } = useTickets({ skipInitialFetch: true, publicMode: true })
  const { findByDni } = useClients({ publicMode: true })
  const { getSetting } = useSystemSettings({ publicMode: true })

  // Bootstrap: si vienen ?bridge=...&token=... desde el .bat, guardarlos y limpiar URL
  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const bridge = params.get("bridge")
    const token = params.get("token")
    if (bridge && token) {
      localStorage.setItem("terminal.printWebhookUrl", bridge)
      localStorage.setItem("terminal.printWebhookToken", token)
      params.delete("bridge")
      params.delete("token")
      const nextSearch = params.toString()
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`
      window.history.replaceState({}, "", nextUrl)
    }
  }, [])

  // URL/TOKEN del bridge: primero System Settings, si faltan → localStorage
  const printWebhookUrl = useMemo(
    () =>
      (
        getSetting("terminal.printWebhookUrl", "") ||
        (typeof window !== "undefined" ? localStorage.getItem("terminal.printWebhookUrl") : "") ||
        ""
      ).trim(),
    [getSetting]
  )

  const printWebhookToken = useMemo(
    () =>
      (
        getSetting("terminal.printWebhookToken", "") ||
        (typeof window !== "undefined" ? localStorage.getItem("terminal.printWebhookToken") : "") ||
        ""
      ).trim(),
    [getSetting]
  )

  // Datos derivados
  const services = getActiveServices()
  const selectedServiceData = useMemo(
    () => services.find((service) => service.id === selectedService) ?? null,
    [services, selectedService],
  )
  const generatedTicket = activeTicketInfo?.ticket
  const generatedService = activeTicketInfo?.service
  const GeneratedServiceIcon = getServiceIcon(generatedService?.icon)

  const displayServiceName = activeTicketInfo?.service?.name ?? generatedService?.name ?? ""
  const displayClientName = activeTicketInfo?.clientName?.trim() ?? ""
  const displayTicketNumber = generatedTicket?.number ?? ""

  const kioskLocationName = useMemo(() => getSetting("kioskLocationName", "").trim(), [getSetting])
  const hasConfiguredLocation = kioskLocationName.length > 0

  const brandDisplayName = useMemo(() => {
    const configuredName = getSetting("brandDisplayName", "").trim()
    if (configuredName) return configuredName
    const fallbackTitle = getSetting("displayTitle", "").trim()
    return fallbackTitle || "DrizaTx"
  }, [getSetting])

  const ticketCreatedAt = useMemo(() => {
    if (!generatedTicket) return null
    const value = generatedTicket.createdAt
    return value instanceof Date ? value : new Date(value ?? Date.now())
  }, [generatedTicket])

  const ticketCreatedDate = useMemo(() => {
    if (!ticketCreatedAt) return ""
    return ticketCreatedAt.toLocaleDateString()
  }, [ticketCreatedAt])

  const actionsDisabled = Boolean(printMessage) || isPrinting
  const confirmDisabled = creating

  // Lee ?debug=1
  useEffect(() => {
    if (typeof window === "undefined") return
    const qs = new URLSearchParams(window.location.search)
    setDebug((qs.get("debug") ?? "").toLowerCase() === "1")
  }, [])

  // --- Utilidades de tiempo/redirect ---
  const clearRedirectTimeout = useCallback(() => {
    if (redirectTimeoutRef.current) {
      window.clearTimeout(redirectTimeoutRef.current)
      redirectTimeoutRef.current = null
    }
  }, [])

  const handleNewTicket = useCallback(() => {
    clearRedirectTimeout()
    setPrintMessage(null)
    setPrintTimestamp(null)
    setSelectedService(null)
    setShowTicket(false)
    setActiveTicketInfo(null)
    setDni("")
    setSelectedClientId(null)
    setSelectedClientName(null)
    setClientNotFound(false)
    setShowClientForm(false)
    setClientLookupError(null)
    setIsPrinting(false)
    setThankYouMessage(null)
    lastAutoPrintTicketRef.current = null
  }, [clearRedirectTimeout])

  const scheduleRedirect = useCallback(() => {
    clearRedirectTimeout()
    redirectTimeoutRef.current = window.setTimeout(() => {
      handleNewTicket()
    }, 5000)
  }, [clearRedirectTimeout, handleNewTicket])

  // --- Impresión directa al bridge local ---
  const handlePrint = useCallback(async () => {
    if (!activeTicketInfo) return

    if (!printWebhookUrl || !printWebhookToken) {
      alert("Servicio de impresión local no configurado en este equipo.")
      return
    }

    setIsPrinting(true)
    setPrintMessage(null)
    setPrintTimestamp(null)

    try {
      const result = await sendTicketToPrinter({
        ticket: activeTicketInfo.ticket,
        service: activeTicketInfo.service,
        clientName: activeTicketInfo.clientName ?? undefined,
        printWebhookUrl,
        printWebhookToken,
      })

      if (!result?.success) {
        const message =
          (result as any)?.error?.message ??
          (typeof (result as any)?.error === "string" ? (result as any).error : null) ??
          "No pudimos imprimir el turno. Intente nuevamente."
        alert(message)
        return
      }

      setPrintTimestamp(new Date())
      setPrintMessage("¡Gracias por su visita! El ticket se imprimió correctamente.")
      scheduleRedirect()
    } catch (error) {
      console.error("Error al imprimir el turno:", error)
      alert("No pudimos imprimir el turno. Por favor, intente nuevamente.")
    } finally {
      setIsPrinting(false)
    }
  }, [activeTicketInfo, printWebhookUrl, printWebhookToken, scheduleRedirect])

  // Auto-print apenas aparece el ticket (idempotente por ticket)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!showTicket || !activeTicketInfo || isPrinting) return

    const ticketKey = `${activeTicketInfo.ticket.id}:${activeTicketInfo.ticket.number}`
    if (lastAutoPrintTicketRef.current === ticketKey) return
    lastAutoPrintTicketRef.current = ticketKey

    const id = window.setTimeout(() => {
      void handlePrint()
    }, 150)
    return () => window.clearTimeout(id)
  }, [showTicket, activeTicketInfo, isPrinting, handlePrint])

  // Focus DNI
  useEffect(() => {
    if (showClientForm && !selectedService && !showTicket) {
      dniInputRef.current?.focus()
    }
  }, [selectedService, showTicket, showClientForm])

  // Limpieza al desmontar
  useEffect(() => () => clearRedirectTimeout(), [clearRedirectTimeout])

  // --- Acciones de UI ---
  const handleServiceSelect = (serviceId: number) => {
    setSelectedService(serviceId)
  }

  const handleFindClient = async () => {
    if (!isClientLookupEnabled) return
    setClientLookupError(null)
    if (!dni || dni.length < 7) {
      setSelectedClientId(null)
      setClientNotFound(false)
      return
    }
    try {
      const client = await findByDni(dni)
      if (client) {
        setSelectedClientId(client.id)
        setSelectedClientName(client.name?.trim() ?? null)
        setClientNotFound(false)
      } else {
        setSelectedClientId(null)
        setSelectedClientName(null)
        setClientNotFound(true)
      }
    } catch (error) {
      console.error("Error fetching client by DNI:", error)
      setSelectedClientId(null)
      setClientNotFound(false)
      setClientLookupError("No pudimos buscar el cliente. Verifique su conexión e intente nuevamente.")
    }
  }

  const handleGetTicket = async () => {
    if (!selectedService || creating) return
    try {
      setCreating(true)
      // Crea ticket (serviceId, channel=1: terminal, clientId opcional)
      const newTicket = await createTicket(
        selectedService,
        undefined,
        undefined,
        selectedClientId || undefined,
      )
      const ticketsWithRelations = getTicketsWithRelations()
      const ticketWithRelations = ticketsWithRelations.find((t) => t.id === newTicket.id)

      const selectedServiceData = services.find((s) => s.id === selectedService) ?? null
      const normalizedNumber = (() => {
        const num = newTicket?.number
        const hasNumber = typeof num === "string" && num.trim().length > 0
        if (hasNumber) return num.trim()
        const prefix = selectedServiceData?.prefix ?? ticketWithRelations?.service?.prefix ?? ""
        return `${prefix}${String(newTicket?.id ?? 1).padStart(3, "0")}`
      })()

      const fallbackService: Service = (() => {
        if (ticketWithRelations?.service) return ticketWithRelations.service
        if (selectedServiceData) return selectedServiceData
        const estimated =
          typeof newTicket?.estimatedWaitTime === "number" && !Number.isNaN(newTicket.estimatedWaitTime)
            ? newTicket.estimatedWaitTime
            : 10
        return {
          id: selectedService,
          name: `Servicio ${selectedService}`,
          prefix: normalizedNumber.replace(/\d+/g, "").slice(0, 3),
          active: true,
          priority: selectedServiceData?.priority ?? ticketWithRelations?.service?.priority ?? 1,
          estimatedTime: estimated || 10,
          maxAttentionTime: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      })()

      const normalizedTicket: TicketType = {
        ...newTicket,
        number: normalizedNumber,
        serviceId: newTicket?.serviceId ?? selectedService,
        mobilePhone: null,
      }

      const normalizedClientName = (() => {
        const nameFromTicket = ticketWithRelations?.client?.name?.trim()
        if (nameFromTicket) return nameFromTicket
        return selectedClientName?.trim() ?? null
      })()

      setActiveTicketInfo({
        ticket: normalizedTicket,
        service: fallbackService,
        clientName: normalizedClientName,
      })
      setShowTicket(true)

      const gratitudeMessage =
        "¡Gracias por utilizar la terminal! Puede anotar su número; el ticket se imprimirá automáticamente."
      setThankYouMessage(gratitudeMessage)
      // scheduleRedirect después de imprimir OK
    } catch (error) {
      console.error("Error al generar el turno:", error)
      alert("Error al generar el turno. Por favor intente nuevamente.")
    } finally {
      setCreating(false)
    }
  }

  // Overlay debug opcional
  const DebugOverlay = () =>
    !debug ? null : (
      <div
        data-print-hidden="true"
        style={{
          position: "fixed",
          right: 12,
          bottom: 12,
          zIndex: 9999,
          background: "#0f172a",
          color: "white",
          padding: "12px 14px",
          borderRadius: 10,
          boxShadow: "0 6px 24px rgba(0,0,0,.35)",
          fontSize: 12,
          lineHeight: 1.3,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 6 }}>DEBUG TERMINAL</div>
        <div>showTicket: <b>{String(showTicket)}</b></div>
        <div>isPrinting: <b>{String(isPrinting)}</b></div>
        <div>ticket: <b>{generatedTicket?.number ?? "—"}</b></div>
        <div>bridge: <b>{printWebhookUrl || "(sin URL)"}{printWebhookUrl ? "" : ""}</b></div>
      </div>
    )

  // --- UI ---
  return (
    <div className="flex-1 space-y-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Terminal de Autoservicio</h1>
        <p className="text-gray-600 text-lg">Seleccione el servicio para obtener su turno.</p>
      </div>

      {isPrinting && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-md p-3 text-sm mx-auto max-w-md" data-print-hidden="true">
          Enviando el ticket a la impresora…
        </div>
      )}

      {!selectedService ? (
        // Lista de servicios
        <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {services.map((service) => {
            const ServiceIcon = getServiceIcon(service.icon)
            const isSelected = selectedService === service.id
            const priorityService = isPriorityService(service)
            return (
              <Card
                key={service.id}
                className={`h-full cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105 ${
                  isSelected ? "ring-2 ring-blue-500 shadow-lg" : ""
                }`}
                onClick={() => handleServiceSelect(service.id)}
              >
                <CardContent className="flex h-full flex-col items-center gap-4 p-6 text-center sm:p-8">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
                    <ServiceIcon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold">{service.name}</h3>
                  {priorityService && <PriorityAudienceIcons className="mt-1" />}
                  <div className="mt-auto">
                    {isSelected && <div className="mt-2 text-xs font-medium text-blue-600">Seleccionado</div>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : showTicket ? (
        // Ticket generado (vista post-creación)
        <div className="w-full">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center" data-print-hidden="true">
              <CardTitle className="text-2xl">¡Turno Generado!</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div data-print-hidden="true" className="space-y-6">
                <div className="bg-gray-100 p-8 rounded-lg">
                  <div className="text-6xl font-bold text-blue-600 mb-2">{generatedTicket?.number}</div>
                  <p className="text-gray-600">Su número de turno</p>
                  {selectedClientId && (
                    <div className="mt-3 inline-flex items-center gap-2 text-sm text-gray-700">
                      <User className="h-4 w-4" />
                      <span>DNI: {dni}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <GeneratedServiceIcon className="h-5 w-5 text-blue-600" />
                    <p className="font-medium">Servicio: {generatedService?.name}</p>
                  </div>
                  {isPriorityService(generatedService) && (
                    <PriorityAudienceIcons size="sm" className="mt-1" />
                  )}
                  {hasConfiguredLocation && <p className="text-sm text-gray-600">Lugar: {kioskLocationName}</p>}
                  <p className="text-xs text-gray-500">Creado: {ticketCreatedDate}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
                  {brandDisplayName}: esté atentx a la pantalla; allí llamarán su turno en orden de llegada.
                </div>

                {thankYouMessage && (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-md p-4 text-sm">
                    <p className="font-semibold">{thankYouMessage}</p>
                    <p className="mt-2 text-xs text-emerald-700">
                      En 5 segundos volveremos a la pantalla principal para solicitar otro turno.
                    </p>
                  </div>
                )}

                {printMessage && (
                  <div className="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 text-sm">
                    <p className="font-semibold">{printMessage}</p>
                    {printTimestamp && (
                      <p className="mt-1 text-xs text-green-700">Impreso a las {printTimestamp.toLocaleTimeString()}</p>
                    )}
                    <p className="mt-2 text-xs text-green-700">Redirigiendo a la pantalla inicial…</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleNewTicket} variant="outline" className="flex-1 bg-transparent" disabled={actionsDisabled}>
                    Nuevo Turno
                  </Button>
                  <Button onClick={handlePrint} className="flex-1" disabled={actionsDisabled}>
                    <Printer className="h-4 w-4 mr-2" />
                    Reintentar impresión
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Confirmación de servicio
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-center">Confirmar Servicio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-3">
              <h3 className="text-xl font-bold">{selectedServiceData?.name}</h3>
              <p className="text-sm text-gray-600">
                Confirmá el servicio para generar el ticket. La impresión será automática.
              </p>
              {isPriorityService(selectedServiceData) && (
                <PriorityAudienceIcons size="sm" className="mt-1" />
              )}
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-600 text-white">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Impresión automática</p>
                  <p className="text-xs text-blue-900">
                    Se envía al servicio local de impresión. Si falla, podrás reintentar.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedService(null)}
                className="w-fit self-start"
              >
                Volver
              </Button>
              <Button
                onClick={handleGetTicket}
                className={cn(
                  // Elegimos el estilo más visible (codex) y lo combinamos con el hint de main
                  "w-full group relative h-auto border-0 py-8 text-3xl font-semibold tracking-wide text-white",
                  "bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600",
                  "shadow-[0_18px_45px_-15px_rgba(37,99,235,0.75)] transition-transform duration-200 ease-out",
                  "hover:from-sky-400 hover:via-blue-500 hover:to-indigo-500 hover:shadow-[0_24px_60px_-20px_rgba(29,78,216,0.9)] hover:scale-[1.02]",
                  "focus-visible:ring-4 focus-visible:ring-sky-300 focus-visible:ring-offset-0"
                )}
                size="lg"
                disabled={confirmDisabled}
              >
                {creating ? "Generando..." : "Obtener Numero"}
                <ArrowRight className="h-6 w-6 ml-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bloque buscar cliente */}
      {!showTicket && !selectedService && (
        <div className="text-center space-y-4">
          {isClientLookupEnabled && !showClientForm && (
            <Button onClick={() => setShowClientForm(true)} size="lg" className="px-10">
              Soy cliente
            </Button>
          )}

          {isClientLookupEnabled && showClientForm && (
            <Card className="max-w-3xl mx-auto">
              <CardHeader>
                <CardTitle className="text-center flex items-center justify-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Verificación de Cliente por DNI
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      ref={dniInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="\d*"
                      placeholder="Ingrese DNI (solo números)"
                      value={dni}
                      onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleFindClient()
                      }}
                      className="w-full p-2 pl-9 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  {selectedClientId && <p className="text-sm text-green-700 mt-2">Cliente encontrado.</p>}
                  {clientNotFound && (
                    <p className="text-sm text-yellow-700 mt-2">
                      No se encontró cliente con ese DNI. Puede continuar como invitado o cargarlo en Gestión {">"} Clientes.
                    </p>
                  )}
                  {clientLookupError && <p className="text-sm text-red-600 mt-2">{clientLookupError}</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <Button className="w-full" onClick={() => void handleFindClient()}>
                    Buscar
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowClientForm(false)
                      setClientNotFound(false)
                      setSelectedClientId(null)
                      setDni("")
                    }}
                  >
                    Continuar sin DNI
                  </Button>
                </div>
                <div className="md:col-span-3 text-sm text-gray-500">
                  Sugerencia: Si es cliente VIP, el sistema podría priorizar su atención (configurable).
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="text-center">
        <p className="text-gray-500 text-sm">Para asistencia, presione el botón de ayuda o consulte con el personal</p>
      </div>

      {/* Overlay de depuración (solo si ?debug=1) */}
      <DebugOverlay />
    </div>
  )
}
