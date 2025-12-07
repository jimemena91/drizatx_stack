"use client"

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Volume2, CloudSun } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useQueueStatus } from "@/hooks/use-queue-status"
import { useQueue } from "@/contexts/queue-context"
import { audioService } from "@/lib/audio-service"
import { AudioControls } from "@/components/audio-controls"
import { AnimatedTicketDisplay } from "@/components/animated-ticket-display"
import { AudioVisualizer } from "@/components/audio-visualizer"
import { useCustomMessages } from "@/hooks/use-custom-messages"
import { getBooleanSetting, getSettingValue } from "@/lib/system-settings"
import { useSystemSettings } from "@/hooks/use-system-settings"
import type { TicketWithRelations } from "@/lib/types"
import { normalizePriorityLevel } from "@/lib/priority"

/** Tipos locales mínimos para no romper el build si el tipo real no está importado */
type NeutralPromotion = {
  title: string
  content: string
  cta?: string
}

type WeatherSnapshot = {
  temperature: number | null
  windSpeed: number | null
  description: string
  observationTime: string
}

const WEATHER_CODE_DESCRIPTIONS: Record<number, string> = {
  0: "Cielo despejado",
  1: "Mayormente despejado",
  2: "Parcialmente nublado",
  3: "Nublado",
  45: "Neblina",
  48: "Neblina congelante",
  51: "Llovizna ligera",
  53: "Llovizna moderada",
  55: "Llovizna intensa",
  56: "Llovizna helada ligera",
  57: "Llovizna helada intensa",
  61: "Lluvia ligera",
  63: "Lluvia moderada",
  65: "Lluvia intensa",
  66: "Lluvia helada ligera",
  67: "Lluvia helada intensa",
  71: "Nevada ligera",
  73: "Nevada moderada",
  75: "Nevada intensa",
  80: "Chubascos ligeros",
  81: "Chubascos moderados",
  82: "Chubascos intensos",
  95: "Tormenta eléctrica",
  96: "Tormenta con granizo",
  99: "Tormenta severa con granizo",
}

function describeWeatherCode(code: number | null | undefined): string {
  if (code == null) return "Condiciones variables"
  return WEATHER_CODE_DESCRIPTIONS[Number(code)] ?? "Condiciones variables"
}

function formatRelativeTime(dateLike: string | Date | null | undefined): string {
  if (!dateLike) return "hace instantes"
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(date.getTime())) return "hace instantes"
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes <= 0) return "hace instantes"
  if (diffMinutes === 1) return "hace 1 minuto"
  if (diffMinutes < 60) return `hace ${diffMinutes} minutos`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours === 1) return "hace 1 hora"
  if (diffHours < 24) return `hace ${diffHours} horas`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return "hace 1 día"
  return `hace ${diffDays} días`
}

type DisplayBrandingHeaderProps = {
  brandName: string
  title: string
  slogan: string
  logoUrl?: string
  currentTime: Date
  isPlayingAudio: boolean
  primaryColor: string
  secondaryColor: string
  theme: string
  weather?: {
    enabled: boolean
    location: string
    status: "idle" | "loading" | "error" | "success"
    snapshot: WeatherSnapshot | null
    error?: string | null
  }
}

function DisplayBrandingHeader({
  brandName,
  title,
  slogan,
  logoUrl,
  currentTime,
  isPlayingAudio,
  primaryColor,
  secondaryColor,
  theme,
  weather,
}: DisplayBrandingHeaderProps) {
  const normalizedName = brandName.trim() || "DrizaTx"
  const normalizedTitle = title.trim() || "Centro de Atención al Cliente"
  const normalizedSlogan = slogan.trim()
  const headerTooltip = [normalizedTitle, normalizedSlogan].filter(Boolean).join(" · ")
  const initials =
    normalizedName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment.charAt(0).toUpperCase())
      .join("") || "DT"

  const normalizedPrimary = primaryColor || "#0f172a"
  const normalizedSecondary = secondaryColor || "#22d3ee"
  const containerClasses = [
    "flex",
    "w-full",
    "items-center",
    "justify-between",
    "gap-3",
    "rounded-2xl",
    "border",
    "border-slate-800/80",
    "bg-slate-950/70",
    "shadow-[0_18px_40px_rgba(8,15,40,0.45)]",
    "backdrop-blur",
    "transition-colors",
    "duration-500",
    "px-4",
    "py-2",
    "sm:px-5",
    "sm:py-2.5",
    "xl:px-6",
    "xl:py-3",
    "text-slate-100",
  ].join(" ")
  const containerStyle: CSSProperties = {
    background: `linear-gradient(135deg, ${normalizedPrimary}f0, ${normalizedSecondary}d9)`,
    color: "#f8fafc",
    boxShadow: "0 18px 40px rgba(8, 15, 40, 0.55)",
  }
  const subtitleColor = "rgba(148,160,184,0.85)"

  const logoFallbackStyle: CSSProperties = {
    background: "rgba(15,23,42,0.85)",
    color: normalizedSecondary,
    border: "1px solid rgba(148,163,184,0.4)",
    boxShadow: "0 8px 24px rgba(8,15,40,0.45)",
  }

  const weatherDetails = useMemo(() => {
    if (!weather?.enabled) {
      return null
    }

    if (weather.status === "error") {
      return {
        temperature: null,
        description: weather.error || "Clima no disponible",
        statusColor: "text-red-500",
      }
    }

    if (weather.status === "loading") {
      return {
        temperature: null,
        description: "Actualizando clima...",
        statusColor: "text-slate-100",
      }
    }

    const formattedTemperature =
      weather.snapshot?.temperature != null
        ? `${weather.snapshot.temperature.toFixed(1)}°C`
        : null

    return {
      temperature: formattedTemperature,
      description: weather.snapshot?.description || "Condiciones variables",
      statusColor: "text-slate-100",
    }
  }, [weather])

  return (
    <div className={containerClasses} style={containerStyle} title={headerTooltip || normalizedName}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {logoUrl ? (
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/80 shadow-[0_12px_32px_rgba(8,15,40,0.45)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={`Logo ${normalizedName}`}
              className="h-full w-full object-contain"
            />
          </div>
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
            style={logoFallbackStyle}
          >
            <span className="text-lg font-bold tracking-wide">{initials}</span>
          </div>
        )}
        <div className="flex flex-col justify-center gap-0.5">
          <span
            className="truncate text-lg font-semibold sm:text-xl"
            style={{ color: normalizedSecondary }}
          >
            {normalizedName}
          </span>
          {weather?.enabled && weatherDetails && (
            <div className="flex items-center gap-2 text-xs text-slate-200">
              <CloudSun className="h-4 w-4" />
              <span className={`${weatherDetails.statusColor} truncate font-medium`}>{weatherDetails.description}</span>
              {weatherDetails.temperature && (
                <span className="font-semibold text-slate-100">{weatherDetails.temperature}</span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 text-right">
        <AudioVisualizer
          isPlaying={isPlayingAudio}
          type="announcement"
          className="text-slate-200"
          style={{ color: secondaryColor || "#22d3ee" }}
        />
        <div className="flex flex-col items-end leading-tight">
          <span className="text-xl font-bold sm:text-2xl">{currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
          <span
            className="text-[11px] uppercase tracking-[0.3em] text-slate-200 sm:text-xs"
            style={{ color: subtitleColor }}
          >
            {currentTime.toLocaleDateString("es-ES", {
              weekday: "short",
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  )
}

/** ---------- Componente principal ---------- */
export default function DisplayPage() {
  /** estado/config */
  const { getQueueStatus, currentTime, refetch } = useQueueStatus()
  const { state } = useQueue()
  const { settings: systemSettings } = useSystemSettings()
  const settingsSource = systemSettings.length > 0 ? systemSettings : state.settings

  const brandLogoUrl = getSettingValue(settingsSource, "brandLogoUrl", "")
  const brandDisplayName = getSettingValue(settingsSource, "brandDisplayName", "DrizaTx") || "DrizaTx"
  const displayTitle = getSettingValue(settingsSource, "displayTitle", "Centro de Atención al Cliente")
  const displaySlogan = getSettingValue(settingsSource, "displaySlogan", "Sistema de Gestión de Colas DrizaTx")
  const brandPrimaryColor = getSettingValue(settingsSource, "brandPrimaryColor", "#0f172a")
  const brandSecondaryColor = getSettingValue(settingsSource, "brandSecondaryColor", "#22d3ee")
  const signageTheme = getSettingValue(settingsSource, "signageTheme", "corporate")

  const signageWeatherLocation = getSettingValue(settingsSource, "signageWeatherLocation", "Buenos Aires, AR")
  const signageWeatherLatitude = getSettingValue(settingsSource, "signageWeatherLatitude", "-34.6037")
  const signageWeatherLongitude = getSettingValue(settingsSource, "signageWeatherLongitude", "-58.3816")

  const displayTimeoutSetting = getSettingValue(settingsSource, "displayTimeout", "30")
  const showWaitTimes = getBooleanSetting(settingsSource, "showWaitTimes", true)
  const signageShowNews = getBooleanSetting(settingsSource, "signageShowNews", false)
  const signageShowWeather = getBooleanSetting(settingsSource, "signageShowWeather", true)
  const signageShowFlowSummary = getBooleanSetting(settingsSource, "signageShowFlowSummary", true)

  const rotationSeconds = useMemo(() => {
    const parsed = Number.parseInt(String(displayTimeoutSetting ?? "").trim(), 10)
    if (!Number.isFinite(parsed) || parsed < 5) return 30
    return parsed
  }, [displayTimeoutSetting])
  const rotationMs = rotationSeconds * 1000

  const { getActiveMessages = () => [], getMessagesByType = (_type?: string) => [] } = useCustomMessages()

  const [queueStatus, setQueueStatus] = useState(getQueueStatus())
  const [lastAnnouncedTicket, setLastAnnouncedTicket] = useState<string | null>(null)
  const [showAudioControls, setShowAudioControls] = useState(false)
  const [isNewTicket, setIsNewTicket] = useState(false)
  const [audioConfig, setAudioConfig] = useState(audioService.getConfig())
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  const [customMessages, setCustomMessages] = useState(getActiveMessages())
  const [weatherSnapshot, setWeatherSnapshot] = useState<WeatherSnapshot | null>(null)
  const [weatherStatus, setWeatherStatus] = useState<"idle" | "loading" | "error" | "success">(
    signageShowWeather ? "loading" : "idle",
  )
  const [weatherError, setWeatherError] = useState<string | null>(null)

  const rawPromotions = useMemo(() => getMessagesByType("promotion"), [getMessagesByType])
  const promotions = useMemo(() => (signageShowNews ? rawPromotions : []), [rawPromotions, signageShowNews])
  const promotionSignature = useMemo(
    () =>
      promotions
        .map((m: any) => {
          const updatedAt = m.updatedAt instanceof Date ? m.updatedAt.getTime() : m.updatedAt ?? ""
          return `${m.id}-${updatedAt}-${m.displayDurationSeconds ?? ""}-${(m.activeDays ?? []).join("-")}`
        })
        .join("|"),
    [promotions],
  )
  const [currentPromotionIndex, setCurrentPromotionIndex] = useState(0)

  /** anuncios estáticos */
  const staticAnnouncements = [
    "Recuerde mantener su distancia de seguridad",
    "Puede seguir su turno desde su móvil escaneando el código QR",
    "Horario de atención: Lunes a Viernes 8:00 - 18:00",
    "Para consultas urgentes, diríjase al mostrador de información",
  ]
  const [currentAnnouncement, setCurrentAnnouncement] = useState(0)

  /** efectos */
  useEffect(() => {
    setAudioConfig(audioService.getConfig())
  }, [])

  useEffect(() => {
    setCurrentPromotionIndex(0)
  }, [promotionSignature, signageShowNews])

  /** rotación de promos */
  useEffect(() => {
    if (!signageShowNews) return
    if (promotions.length === 0) return
    const current = promotions[currentPromotionIndex % promotions.length]
    const priority = normalizePriorityLevel(current?.priority) ?? 1
    const customDurationSeconds = Number.isFinite(Number(current?.displayDurationSeconds))
      ? Math.max(5, Number(current?.displayDurationSeconds))
      : rotationSeconds
    const duration = Math.max(customDurationSeconds * 1000, rotationMs) + (priority - 1) * 500
    const timer = setTimeout(() => {
      setCurrentPromotionIndex((prev) => (prev + 1) % promotions.length)
    }, duration)
    return () => clearTimeout(timer)
  }, [currentPromotionIndex, promotions, rotationMs, signageShowNews, promotionSignature, rotationSeconds])

  /** anuncios combinados */
  const getAllAnnouncements = useCallback(() => {
    if (!signageShowNews) return []
    const customAnnouncements = (customMessages || [])
      .filter((msg: any) => msg.type === "announcement" || msg.type === "info")
      .map((msg: any) => msg.content)
    return [...customAnnouncements, ...staticAnnouncements]
  }, [customMessages, signageShowNews])
  const currentAnnouncements = useMemo(() => getAllAnnouncements(), [getAllAnnouncements])
  /** datos de cola + audio */
  useEffect(() => {
    let isMounted = true
    let audioResetTimeout: ReturnType<typeof setTimeout> | null = null

    const handleStatusUpdate = (status: typeof queueStatus) => {
      if (!isMounted) return

      setCustomMessages(getActiveMessages())

      const audioTicket = status.calledTickets?.[0] ?? null
      const audioKey = audioTicket
        ? `${audioTicket.id}-${audioTicket.status}`
        : null

      if (audioKey && audioKey !== lastAnnouncedTicket) {
        setLastAnnouncedTicket(audioKey)
        setIsNewTicket(true)
        setIsPlayingAudio(true)

        const svcName = audioTicket?.service?.name ?? "Servicio"
        audioService.playTicketCalled(audioTicket.number, svcName)

        if (audioResetTimeout) clearTimeout(audioResetTimeout)
        audioResetTimeout = setTimeout(() => {
          setIsNewTicket(false)
          setIsPlayingAudio(false)
        }, 4200)
      }
    }

    const updateQueueStatus = () => {
      const fallbackStatus = getQueueStatus()
      handleStatusUpdate(fallbackStatus)
      setQueueStatus(fallbackStatus)

      void refetch()
        .then((fetchedStatus) => {
          if (!fetchedStatus || !isMounted) return
          handleStatusUpdate(fetchedStatus)
          setQueueStatus(fetchedStatus)
        })
        .catch((error) => {
          console.error("[DisplayPage] refetch error:", error)
        })
    }

    updateQueueStatus()
    const dataInterval = setInterval(updateQueueStatus, 4200)

    let announcementTimer: ReturnType<typeof setInterval> | null = null
    if (signageShowNews && currentAnnouncements.length > 0) {
      announcementTimer = setInterval(() => {
        setCurrentAnnouncement((prev) => {
          const total = currentAnnouncements.length || 1
          return (prev + 1) % total
        })
      }, rotationMs)
    }

    return () => {
      isMounted = false
      clearInterval(dataInterval)
      if (announcementTimer) clearInterval(announcementTimer)
      if (audioResetTimeout) clearTimeout(audioResetTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAnnouncedTicket, rotationMs, signageShowNews, currentAnnouncements.length])

  /** handlers */
  const handleScreenClick = async () => {
    await audioService.requestAudioPermission()
  }
  const handleAudioConfigChange = (newConfig: any) => {
    audioService.updateConfig(newConfig)
    setAudioConfig(audioService.getConfig())
  }

  /** clima */
  useEffect(() => {
    if (!signageShowWeather) {
      setWeatherStatus("idle")
      setWeatherSnapshot(null)
      return
    }

    const lat = Number.parseFloat(String(signageWeatherLatitude ?? "").replace(",", "."))
    const lon = Number.parseFloat(String(signageWeatherLongitude ?? "").replace(",", "."))

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setWeatherStatus("error")
      setWeatherError("Coordenadas de clima inválidas")
      setWeatherSnapshot(null)
      return
    }

    let cancelled = false
    const fetchWeather = async () => {
      try {
        setWeatherStatus((s) => (s === "success" ? "success" : "loading"))
        setWeatherError(null)
        const params = new URLSearchParams({
          latitude: lat.toString(),
          longitude: lon.toString(),
          current_weather: "true",
          timezone: "auto",
        })
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (cancelled) return
        const current = data?.current_weather
        if (!current) throw new Error("Respuesta inválida del servicio meteorológico")
        const temperatureRaw = Number.parseFloat(String(current.temperature ?? ""))
        const windRaw = Number.parseFloat(String(current.windspeed ?? ""))
        setWeatherSnapshot({
          temperature: Number.isFinite(temperatureRaw) ? temperatureRaw : null,
          windSpeed: Number.isFinite(windRaw) ? windRaw : null,
          description: describeWeatherCode(current.weathercode),
          observationTime: typeof current.time === "string" ? current.time : new Date().toISOString(),
        })
        setWeatherStatus("success")
      } catch (err) {
        if (cancelled) return
        setWeatherStatus("error")
        setWeatherError(err instanceof Error ? err.message : "No se pudo obtener el clima")
        setWeatherSnapshot(null)
      }
    }

    void fetchWeather()
    const interval = setInterval(fetchWeather, Math.max(300000, rotationMs * 2))
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [signageShowWeather, signageWeatherLatitude, signageWeatherLongitude, rotationMs])

  /** datos visibles */
  const calledTickets = queueStatus.calledTickets
  const activeCalledTicket = calledTickets[0] ?? null

  // 🔹 NUEVA LÓGICA: tickets “atendidos” = IN_PROGRESS + COMPLETED de hoy (por startOfService)
  const attendedTickets = useMemo(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date(startOfToday)
    endOfToday.setDate(endOfToday.getDate() + 1)

    const getStartOfServiceDate = (
      ticket: TicketWithRelations | null | undefined,
    ): Date | null => {
      if (!ticket) return null
      const candidates: Array<string | Date | null | undefined> = [
        (ticket as any)?.startOfServiceTime,
        (ticket as any)?.start_of_service_time,
        ticket.startedAt,
      ]

      for (const candidate of candidates) {
        if (!candidate) continue
        const value = new Date(candidate)
        if (!Number.isNaN(value.getTime())) {
          return value
        }
      }

      return null
    }

    const base: TicketWithRelations[] = [
      ...(queueStatus.inProgressTickets ?? []),
      ...(queueStatus.recentlyCompletedTickets ?? []),
    ]

    const byId = new Map<string | number, TicketWithRelations>()

    for (const ticket of base) {
      if (!ticket) continue
      const id = ticket.id ?? ticket.number ?? Math.random().toString(36)
      const prev = byId.get(id)

      if (!prev) {
        byId.set(id, ticket)
        continue
      }

      const prevStart = getStartOfServiceDate(prev)
      const currStart = getStartOfServiceDate(ticket)

      if (currStart && (!prevStart || currStart.getTime() > prevStart.getTime())) {
        byId.set(id, ticket)
      }
    }

    return Array.from(byId.values())
      .filter((ticket) => {
        const startDate = getStartOfServiceDate(ticket)
        if (!startDate) return false
        return startDate >= startOfToday && startDate < endOfToday
      })
      .sort((a, b) => {
        const aDate = getStartOfServiceDate(a)
        const bDate = getStartOfServiceDate(b)
        const aTime = aDate ? aDate.getTime() : 0
        const bTime = bDate ? bDate.getTime() : 0
        return bTime - aTime
      })
      .slice(0, 5)
  }, [queueStatus.inProgressTickets, queueStatus.recentlyCompletedTickets])

  const renderPromotionMedia = (promotion?: any) => {
    if (!promotion?.mediaUrl) return null
    const mediaType = String(promotion.mediaType ?? "").toLowerCase()
    const isVideo = mediaType.startsWith("video/") || promotion.mediaUrl.toLowerCase().endsWith(".mp4")
    const altText = promotion.title || "Promoción"

    return (
      <div className="relative flex h-full min-h-[45vh] w-full items-center justify-center overflow-hidden rounded-xl border border-slate-800/60 bg-slate-950/70">
        {isVideo ? (
          <video
            className="h-full max-h-full w-full max-w-full object-contain"
            src={promotion.mediaUrl}
            controls
            muted
            loop
            autoPlay
            playsInline
          >
            <source src={promotion.mediaUrl} type={mediaType || "video/mp4"} />
            Tu navegador no soporta la reproducción de video.
          </video>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={promotion.mediaUrl}
            alt={altText}
            className="h-full max-h-full w-full max-w-full object-contain"
          />
        )}
      </div>
    )
  }

  const displayMessagesEnabled = signageShowNews
  const hasPromotions = promotions.length > 0
  const activeCarouselIndex = hasPromotions
    ? promotions.length
      ? ((currentPromotionIndex % promotions.length) + promotions.length) % promotions.length
      : 0
    : 0
  const activePromotion = hasPromotions && promotions.length ? promotions[activeCarouselIndex] : null
  const activePromotionMedia = activePromotion ? renderPromotionMedia(activePromotion) : null

  /** layout */
  return (
    <div
      className="relative h-screen w-full overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-slate-100"
      onClick={handleScreenClick}
    >
      <div className="grid h-full w-full grid-rows-[auto_1fr] gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-5 xl:px-10 xl:py-7 2xl:gap-5 2xl:px-14 2xl:py-8">
        <header className="min-h-0">
          <DisplayBrandingHeader
            brandName={brandDisplayName}
            title={displayTitle}
            slogan={displaySlogan}
            logoUrl={brandLogoUrl || undefined}
            currentTime={currentTime}
            isPlayingAudio={isPlayingAudio}
            primaryColor={brandPrimaryColor}
            secondaryColor={brandSecondaryColor}
            theme={signageTheme}
            weather={{
              enabled: signageShowWeather,
              location: signageWeatherLocation,
              status: weatherStatus,
              snapshot: weatherSnapshot,
              error: weatherError,
            }}
          />
        </header>

        <main
          className={`grid h-full min-h-0 gap-3 sm:gap-4 2xl:gap-5 ${displayMessagesEnabled ? "grid-cols-2" : "grid-cols-1"}`}
        >
          <section className="flex min-h-0 flex-col gap-3">
            <div className="flex-1 rounded-3xl border border-slate-700/50 bg-slate-800/60 p-5 shadow-[0_35px_80px_rgba(15,23,42,0.55)]backdrop-blur-xl sm:p-6">
              <AnimatedTicketDisplay
                currentTicket={activeCalledTicket as unknown as TicketWithRelations}
                calledTickets={calledTickets as unknown as TicketWithRelations[]}
                recentlyCompletedTickets={attendedTickets as unknown as TicketWithRelations[]}
                isNewTicket={isNewTicket}
                audioEnabled={audioConfig.enabled}
              />
            </div>
          </section>

          {displayMessagesEnabled && (
            <section className="min-h-0">
              <Card className="flex h-full flex-col rounded-3xl border border-slate-800/70 bg-slate-950/70 shadow-[0_24px_60px_rgba(8,15,40,0.55)]">
                <CardContent className="flex h-full flex-col p-0">
                  <div className="flex min-h-[50vh] flex-1 items-center justify-center overflow-auto rounded-3xl border border-slate-800/60 bg-slate-950/70">
                    {hasPromotions && activePromotion ? (
                      activePromotionMedia ?? (
                        <div className="flex max-h-full flex-1 items-center justify-center p-6 text-center text-slate-200">
                          <p className="max-h-full whitespace-pre-line break-words text-balance text-lg leading-relaxed">
                            {activePromotion.content || "Sin contenido disponible."}
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-slate-400">
                        <p className="whitespace-pre-line break-words text-balance">
                          No hay contenido para mostrar.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </main>
      </div>

      {/* Botones flotantes */}
      <div className="fixed top-4 right-4 z-10 flex flex-col gap-2 sm:flex-row sm:gap-3">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAudioControls(!showAudioControls)}
            className={`bg-slate-950/70 border border-slate-800/70 text-slate-100 hover:bg-slate-900 transition-all duration-300 shadow ${
              audioConfig.enabled ? "ring-2 ring-amber-400/60" : ""
            }`}
          >
            <Volume2 className="h-4 w-4" />
          </Button>
          {showAudioControls && (
            <div className="absolute top-12 right-0 z-20">
              <div className="rounded-lg border border-slate-800/70 bg-slate-950/80 p-1 shadow-[0_20px_50px_rgba(8,15,40,0.55)]">
                <AudioControls showSettings={true} onChange={handleAudioConfigChange} />
              </div>
            </div>
          )}
        </div>
        <Link href="/">
          <Button
            variant="outline"
            size="sm"
            className="border border-slate-800/70 bg-slate-950/70 text-slate-100 shadow transition-colors hover:bg-slate-900"
          >
            Volver al Sistema
          </Button>
        </Link>
      </div>
    </div>
  )
}
