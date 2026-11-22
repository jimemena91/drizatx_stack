"use client";

import { FormEvent, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  LogOut,
  Megaphone,
  Moon,
  PlayCircle,
  Route as RouteIcon,
  Search,
  Ticket as TicketIcon,
  Undo2,
  UserX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatAlertDuration } from "@/components/attention-alerts/attention-alerts-panel";
import { cn } from "@/lib/utils";
import type {
  TicketRoute,
  TicketRouteAbsence,
  TicketRouteEvent,
  TicketRouteEventType,
} from "@/lib/api-client";

const BUSINESS_TZ = "America/Argentina/Mendoza";

/** Día comercial de hoy (AAAA-MM-DD) en la zona del negocio. */
export function todayBusinessDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const formatClock = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: BUSINESS_TZ,
  });
};

const STATUS_LABELS: Record<string, string> = {
  WAITING: "En fila",
  CALLED: "Llamado",
  IN_PROGRESS: "En atención",
  COMPLETED: "Finalizado",
  CANCELLED: "Cancelado",
  ABSENT: "Ausente",
  DAILY_CLOSED: "Cerrado por cierre diario",
};

type EventStyle = { label: string; icon: typeof Clock; tone: string };

const EVENT_STYLES: Record<TicketRouteEventType, EventStyle> = {
  CREATED: { label: "Sacó el turno", icon: TicketIcon, tone: "bg-sky-500/15 text-sky-600 dark:text-sky-300" },
  CALLED: { label: "Llamado", icon: Megaphone, tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300" },
  TAKEN_FROM_ABSENT: { label: "Retomado desde ausente", icon: Undo2, tone: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300" },
  STARTED: { label: "Comenzó la atención", icon: PlayCircle, tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
  ABSENT: { label: "Marcado ausente", icon: UserX, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  REQUEUED: { label: "Vuelto a la fila", icon: Hourglass, tone: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  COMPLETED: { label: "Atención finalizada", icon: CheckCircle2, tone: "bg-green-500/15 text-green-600 dark:text-green-300" },
  CANCELLED: { label: "Cancelado", icon: Ban, tone: "bg-destructive/10 text-destructive" },
  DAILY_CLOSED: { label: "Cerrado por cierre diario", icon: Moon, tone: "bg-muted text-muted-foreground" },
  STATUS_CHANGE: { label: "Cambio de estado", icon: Clock, tone: "bg-muted text-muted-foreground" },
};

/** Quién hizo qué en cada paso, con su puesto. */
function operatorLine(event: TicketRouteEvent): string | null {
  if (!event.operatorName) return null;
  const who = event.operatorPosition
    ? `${event.operatorName} · ${event.operatorPosition}`
    : event.operatorName;

  switch (event.type) {
    case "CALLED":
      return `${event.afterAbsent ? "Lo retomó" : "Lo llamó"}: ${who}`;
    case "TAKEN_FROM_ABSENT":
      return `Lo retomó: ${who}`;
    case "ABSENT":
      return `Lo marcó ausente: ${who}`;
    case "STARTED":
      return `Atiende: ${who}`;
    case "COMPLETED":
      return `Atendió: ${who}`;
    default:
      return who;
  }
}

function eventLabel(event: TicketRouteEvent): string {
  const base = EVENT_STYLES[event.type] ?? EVENT_STYLES.STATUS_CHANGE;
  if (event.type === "CALLED" && event.afterAbsent) return "Llamado de nuevo";
  if (event.type === "STARTED" && event.source === "AUTO") return "Comenzó la atención (automático)";
  return base.label;
}

function SummaryItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

const dur = (seconds: number | null | undefined): string =>
  seconds === null || seconds === undefined ? "—" : formatAlertDuration(seconds);

function AbsenceRow({ absence, index }: { absence: TicketRouteAbsence; index: number }) {
  const markedBy = absence.markedByName
    ? absence.markedByPosition
      ? `${absence.markedByName} · ${absence.markedByPosition}`
      : absence.markedByName
    : "operador no registrado";
  const takenBy = absence.takenByName
    ? absence.takenByPosition
      ? `${absence.takenByName} · ${absence.takenByPosition}`
      : absence.takenByName
    : null;

  return (
    <li
      className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
      data-testid="ticket-route-absence"
    >
      <p className="font-semibold text-foreground">
        Ausencia {index + 1} · {formatClock(absence.markedAt)}
      </p>
      <p className="mt-1 text-muted-foreground">
        Lo marcó ausente: <span className="text-foreground">{markedBy}</span>
      </p>
      <p className="text-muted-foreground">
        Ausente durante: <span className="text-foreground">{dur(absence.absentSeconds)}</span>
      </p>
      {absence.backInQueueSeconds !== null && (
        <p className="text-muted-foreground">
          Esperando de nuevo en la fila:{" "}
          <span className="text-foreground">{dur(absence.backInQueueSeconds)}</span>
        </p>
      )}
      <p className="text-muted-foreground">
        Lo retomó:{" "}
        <span className="text-foreground">
          {takenBy ? `${takenBy} (${absence.takenAt ? formatClock(absence.takenAt) : ""})` : "nadie todavía"}
        </span>
      </p>
    </li>
  );
}

function RouteCard({ route }: { route: TicketRoute }) {
  const { ticket, events, summary } = route;
  const statusLabel = STATUS_LABELS[ticket.status] ?? ticket.status;

  return (
    <article
      className="space-y-4 rounded-xl border border-border bg-card p-4"
      data-testid="ticket-route-card"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-card-foreground">
            Turno {ticket.number}
            {ticket.serviceName && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">{ticket.serviceName}</span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground">Fecha comercial {ticket.issuedForDate}</p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            route.ongoing ? "bg-amber-500/15 text-amber-600 dark:text-amber-300" : "bg-muted text-muted-foreground",
          )}
        >
          {route.ongoing ? "Abierto · " : ""}
          {statusLabel}
        </span>
      </header>

      {route.reconstructed && (
        <p
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200"
          data-testid="ticket-route-reconstructed"
        >
          Este turno es anterior al registro de la ruta. Se reconstruyó con lo que quedó guardado
          (sólo la última vuelta y los avisos de ausente), así que puede faltar información.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2" data-testid="ticket-route-summary">
        <SummaryItem
          label="Esperó hasta ser atendido"
          value={dur(summary.waitUntilAttentionSeconds)}
          hint={route.ongoing ? "Sigue corriendo" : undefined}
        />
        <SummaryItem label="Hasta el primer llamado" value={dur(summary.waitBeforeFirstCallSeconds)} />
        <SummaryItem label="Veces llamado" value={String(summary.callCount)} />
        <SummaryItem
          label="Veces ausente"
          value={String(summary.absentCount)}
          hint={summary.absentCount > 0 ? `${dur(summary.absentSeconds)} ausente en total` : undefined}
        />
        <SummaryItem label="En fila" value={dur(summary.waitingSeconds)} />
        <SummaryItem label="En atención" value={dur(summary.attentionSeconds)} />
      </div>

      {summary.absences.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-foreground">Ausencias y quién las retomó</h4>
          <ul className="space-y-2">
            {summary.absences.map((absence, index) => (
              <AbsenceRow key={`${absence.markedAt}-${index}`} absence={absence} index={index} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h4 className="mb-2 text-sm font-semibold text-foreground">Recorrido paso a paso</h4>
        <ol className="relative space-y-3 border-l border-border pl-5" data-testid="ticket-route-timeline">
          {events.map((event, index) => {
            const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.STATUS_CHANGE;
            const Icon = style.icon;
            const who = operatorLine(event);
            const isLast = index === events.length - 1;
            return (
              <li key={`${event.id ?? "r"}-${index}`} className="relative" data-testid="ticket-route-event">
                <span
                  className={cn(
                    "absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-card",
                    style.tone,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{eventLabel(event)}</p>
                  <time className="shrink-0 font-mono text-xs text-muted-foreground" dateTime={event.occurredAt}>
                    {formatClock(event.occurredAt)}
                  </time>
                </div>
                {who && <p className="text-xs text-muted-foreground">{who}</p>}
                {event.secondsUntilNext !== null && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <Clock className="mr-1 inline h-3 w-3" />
                    {isLast && route.ongoing ? "Hasta ahora" : "Hasta el siguiente paso"}:{" "}
                    <span className="font-medium text-foreground">{formatAlertDuration(event.secondsUntilNext)}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <p className="flex items-center gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <LogOut className="h-3 w-3" />
        Tiempo total desde que sacó el turno: <span className="font-medium text-foreground">{dur(summary.totalSeconds)}</span>
      </p>
    </article>
  );
}

type TicketRoutePanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSearch: (number: string, date: string) => Promise<TicketRoute[]>;
};

export function TicketRoutePanel({ open, onOpenChange, onSearch }: TicketRoutePanelProps) {
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(() => todayBusinessDate());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<TicketRoute[] | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = number.trim();
    if (!trimmed) {
      setError("Escribí el número de turno.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRoutes(await onSearch(trimmed, date));
    } catch (err) {
      setRoutes(null);
      setError(err instanceof Error && err.message ? err.message : "No se pudo consultar el turno.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-lg" data-testid="ticket-route-panel">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <RouteIcon className="h-5 w-5 text-primary" />
            Ruta del ticket
          </SheetTitle>
          <SheetDescription>
            Buscá un turno para ver cuándo se sacó, quién lo llamó y desde qué puesto, quién lo marcó
            ausente, quién lo retomó y cuánto duró cada tramo.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex flex-wrap items-end gap-2 border-b border-border p-4">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-muted-foreground">
            Número de turno
            <Input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ej: A-123"
              autoComplete="off"
              data-testid="ticket-route-number"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Fecha
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="ticket-route-date"
            />
          </label>
          <Button type="submit" disabled={loading} data-testid="ticket-route-search">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Buscar
          </Button>
        </form>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {error && (
            <p
              className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              data-testid="ticket-route-error"
            >
              {error}
            </p>
          )}

          {!error && routes === null && !loading && (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Escribí el número del turno y la fecha, y tocá Buscar.
            </p>
          )}

          {routes !== null && routes.length === 0 && !error && (
            <p
              className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground"
              data-testid="ticket-route-empty"
            >
              No encontramos ningún turno con ese número en esa fecha. Revisá el número y el día.
            </p>
          )}

          {routes?.map((route) => <RouteCard key={route.ticket.id} route={route} />)}
        </div>
      </SheetContent>
    </Sheet>
  );
}
