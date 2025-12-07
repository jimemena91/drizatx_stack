"use client"

import { useEffect, useState } from "react"
import { CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { TicketWithRelations } from "@/lib/types"

interface AnimatedTicketDisplayProps {
  currentTicket: TicketWithRelations | null
  calledTickets: TicketWithRelations[]
  recentlyCompletedTickets: TicketWithRelations[]
  isNewTicket: boolean
  audioEnabled: boolean
}

function getCompletedOrderTimestamp(ticket: TicketWithRelations) {
  const candidates: Array<string | Date | null | undefined> = [
    ticket.startedAt,
    ticket.completedAt,
    ticket.calledAt,
    ticket.updatedAt,
    ticket.createdAt,
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const time = new Date(candidate).getTime()
    if (!Number.isNaN(time)) {
      return time
    }
  }

  return 0
}

function getPositionLabel(ticket: TicketWithRelations) {
  const rawPosition = ticket.operator?.position
  const normalized =
    typeof rawPosition === "string"
      ? rawPosition.trim()
      : rawPosition != null
        ? String(rawPosition).trim()
        : ""
  if (normalized.length === 0) return "Puesto sin asignar"
  return normalized
}

export function AnimatedTicketDisplay({
  currentTicket,
  calledTickets,
  recentlyCompletedTickets,
  isNewTicket,
  audioEnabled, // <- ahora se desestructura (aunque no lo usemos todavía)
}: AnimatedTicketDisplayProps) {
  const [showPulse, setShowPulse] = useState(false)
  const [showGlow, setShowGlow] = useState(false)

  const heroTicket = currentTicket ?? (calledTickets.length > 0 ? calledTickets[0] : null)
  const heroTicketId = heroTicket?.id != null ? String(heroTicket.id) : null

  const secondaryCalledTickets = heroTicket
    ? calledTickets.filter((ticket, index) => {
        if (!ticket) return false
        const sameId =
          heroTicketId != null && ticket.id != null ? String(ticket.id) === heroTicketId : false
        if (!currentTicket && index === 0) return false
        return !sameId
      })
    : calledTickets

  const activeTickets: TicketWithRelations[] = heroTicket
    ? [heroTicket, ...secondaryCalledTickets]
    : [...secondaryCalledTickets]

  // IDs de tickets activos para no repetirlos como "atendidos"
  const activeIds = new Set(
    activeTickets
      .filter((t) => t && t.id != null)
      .map((t) => String(t.id)),
  )

  // Tomamos los "recentlyCompletedTickets" (que ahora son los atendidos de hoy)
  // y filtramos los que ya están en la lista activa.
  const completedTickets = [...recentlyCompletedTickets]
    .filter((ticket) => {
      if (!ticket) return false
      if (ticket.id == null) return true
      return !activeIds.has(String(ticket.id))
    })
    .sort((a, b) => getCompletedOrderTimestamp(b) - getCompletedOrderTimestamp(a))

  const maxVisibleTickets = 5
  const displayedActiveTickets = activeTickets.slice(0, maxVisibleTickets)
  const remainingSlots = Math.max(0, maxVisibleTickets - displayedActiveTickets.length)
  const displayedCompletedTickets = completedTickets.slice(0, remainingSlots)

  useEffect(() => {
    if (isNewTicket && heroTicket) {
      setShowPulse(true)
      setShowGlow(true)
      const timer = setTimeout(() => {
        setShowPulse(false)
        setShowGlow(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [heroTicket, isNewTicket])

  return (
    <Card
      className={`relative h-full w-full max-w-full overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-900/70 text-slate-100 shadow-[0_35px_80px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-all duration-1000 ${
        showGlow ? "ring-2 ring-amber-300/60" : ""
      }`}
    >
      <CardContent className="relative flex h-full flex-col gap-6 overflow-visible p-4 sm:gap-7 sm:p-6">
        {showPulse && (
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-400/15 via-orange-500/10 to-amber-300/15" />
        )}

        <div className="relative z-10 flex flex-1 flex-col gap-5 sm:gap-6">
          <div className="flex flex-col gap-4">
            <span className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200">
              Turnos en llamado
            </span>

            {displayedActiveTickets.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {displayedActiveTickets.map((ticket, index) => {
                  const positionText = getPositionLabel(ticket)
                  const animationDelay = `${index * 0.3}s`
                  const isHeroTicket = index === 0
                  const heroCardBackground =
                    "bg-gradient-to-br from-amber-200 via-amber-300 to-amber-400 text-amber-950 shadow-[0_20px_45px_rgba(250,204,21,0.45)]"
                  const defaultCardBackground =
                    "bg-gradient-to-br from-slate-950/85 via-slate-950/65 to-slate-950/85 text-white shadow-[0_14px_30px_rgba(15,23,42,0.55)]"
                  const heroBadgeClasses =
                    "bg-amber-500/95 text-amber-950 shadow-[0_10px_22px_rgba(217,119,6,0.45)]"
                  const defaultBadgeClasses =
                    "bg-orange-600/90 text-white shadow-[0_10px_22px_rgba(194,65,12,0.45)]"
                  const heroNumberClasses =
                    "text-amber-950 drop-shadow-[0_6px_18px_rgba(202,138,4,0.45)]"
                  const defaultNumberClasses =
                    "text-amber-50 drop-shadow-[0_6px_18px_rgba(251,191,36,0.45)]"
                  const heroServiceClasses = "text-xs text-amber-950/90"
                  const defaultServiceClasses = "text-xs text-amber-100/90"
                  const heroPuestoLabelClasses =
                    "text-[0.55rem] uppercase tracking-[0.3em] text-amber-900/80"
                  const defaultPuestoLabelClasses =
                    "text-[0.55rem] uppercase tracking-[0.3em] text-amber-100/80"
                  const heroPuestoValueClasses =
                    "rounded-lg border border-amber-500/60 bg-amber-200/70 px-3 py-1 text-[clamp(1.2rem,2.8vw,1.7rem)] font-semibold leading-none text-amber-950 shadow-[0_12px_26px_rgba(217,119,6,0.35)]"
                  const defaultPuestoValueClasses =
                    "rounded-lg border border-amber-100/50 bg-amber-500/20 px-3 py-1 text-[clamp(1.2rem,2.8vw,1.7rem)] font-semibold leading-none text-amber-50 shadow-[0_10px_22px_rgba(245,158,11,0.35)]"

                  return (
                    <article
                      key={`${ticket.id ?? "active"}-${index}`}
                      className={`relative w-full overflow-hidden rounded-2xl border border-transparent bg-gradient-to-br from-amber-400 via-orange-400 to-amber-500 p-[1px] shadow-[0_18px_40px_rgba(251,191,36,0.32)] transition-transform duration-500 ${
                        index === 0 && showGlow ? "ring-2 ring-amber-200/80" : ""
                      }`}
                      style={{
                        animation: `ticketEntrance 0.5s ease-out forwards`,
                        animationDelay,
                      }}
                    >
                      <div className="pointer-events-none absolute inset-0 rounded-[1.55rem] bg-amber-100/35 blur-3xl opacity-50" />
                      <div
                        className={`relative z-10 flex items-center justify-between gap-3 rounded-[1.45rem] px-4 py-3 backdrop-blur-2xl sm:gap-4 sm:px-5 ${
                          isHeroTicket ? heroCardBackground : defaultCardBackground
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.3em] ${
                              isHeroTicket ? heroBadgeClasses : defaultBadgeClasses
                            }`}
                          >
                            Llamando
                          </span>
                          <span
                            className={`text-[clamp(1.35rem,3.2vw,1.85rem)] font-bold leading-tight tracking-tight ${
                              isHeroTicket ? heroNumberClasses : defaultNumberClasses
                            }`}
                          >
                            {ticket.number}
                          </span>
                          <span className={isHeroTicket ? heroServiceClasses : defaultServiceClasses}>
                            {ticket.service?.name ?? "Servicio"}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-right">
                          <span
                            className={
                              isHeroTicket
                                ? heroPuestoLabelClasses
                                : defaultPuestoLabelClasses
                            }
                          >
                            Puesto
                          </span>
                          <span
                            className={
                              isHeroTicket
                                ? heroPuestoValueClasses
                                : defaultPuestoValueClasses
                            }
                          >
                            {positionText}
                          </span>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-700/60 bg-slate-900/50 px-4 py-6 text-center text-slate-400 backdrop-blur-xl">
                <p className="text-xs font-semibold uppercase tracking-[0.35em]">
                  Sin turnos en llamado
                </p>
                <p className="text-sm text-slate-300">Esperando el próximo número.</p>
              </div>
            )}
          </div>

          {displayedCompletedTickets.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-200">
                Turnos atendidos
              </span>
              {displayedCompletedTickets.map((ticket, index) => {
                const positionText = getPositionLabel(ticket)
                const animationDelay = `${index * 0.3 + displayedActiveTickets.length * 0.3}s`

                return (
                  <article
                    key={`${ticket.id ?? "completed"}-${index}`}
                    className="relative w-full overflow-hidden rounded-2xl border border-transparent bg-gradient-to-br from-emerald-400 via-teal-400 to-emerald-500 p-[1px] shadow-[0_18px_40px_rgba(16,185,129,0.28)] transition-transform duration-500"
                    style={{
                      animation: `ticketEntrance 0.5s ease-out forwards`,
                      animationDelay,
                    }}
                  >
                    <div className="pointer-events-none absolute inset-0 rounded-[1.55rem] bg-emerald-100/25 blur-3xl opacity-40" />
                    <div className="relative z-10 flex items-center justify-between gap-3 rounded-[1.45rem] bg-gradient-to-br from-slate-950/85 via-slate-950/65 to-slate-950/85 px-4 py-3 text-white shadow-[0_14px_30px_rgba(15,23,42,0.55)] backdrop-blur-2xl sm:gap-4 sm:px-5">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/90 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.28em] text-emerald-50 shadow-[0_10px_22px_rgba(5,150,105,0.4)]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Atendido
                        </span>
                        <span className="text-[clamp(1.35rem,3.2vw,1.85rem)] font-bold leading-tight tracking-tight text-emerald-50 drop-shadow-[0_6px_18px_rgba(52,211,153,0.35)]">
                          {ticket.number}
                        </span>
                        <span className="text-xs text-emerald-100/90">
                          {ticket.service?.name ?? "Servicio"}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span className="text-[0.55rem] uppercase tracking-[0.3em] text-emerald-100/80">
                          Puesto
                        </span>
                        <span className="rounded-lg border border-emerald-100/50 bg-emerald-500/20 px-3 py-1 text-[clamp(1.2rem,2.8vw,1.7rem)] font-semibold leading-none text-emerald-50 shadow-[0_10px_22px_rgba(16,185,129,0.35)]">
                          {positionText}
                        </span>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        {showPulse && (
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300/50"
              style={{ animation: "callWave 2.4s ease-out infinite" }}
            />
            <div
              className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-200/40"
              style={{ animation: "callWave 2.4s ease-out infinite", animationDelay: "0.3s" }}
            />
            <div
              className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-100/30"
              style={{ animation: "callWave 2.4s ease-out infinite", animationDelay: "0.6s" }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
