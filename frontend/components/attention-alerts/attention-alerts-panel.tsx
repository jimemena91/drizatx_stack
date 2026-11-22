"use client";

import { AlertTriangle, CheckCircle2, Clock, Loader2, User } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { AttentionAlertHistory, AttentionAlertLogEntry } from "@/lib/api-client";

type AttentionAlertsPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: AttentionAlertHistory | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

const FINAL_STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Finalizado",
  DAILY_CLOSED: "Cerrado por cierre diario",
  CANCELLED: "Cancelado",
  ABSENT: "Ausente",
  DELETED: "Eliminado",
};

export function formatAlertDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  if (minutes > 0) return `${minutes} min ${String(rest).padStart(2, "0")} s`;
  return `${rest} s`;
}

/** "sáb, 21 nov" a partir de un día comercial YYYY-MM-DD (sin corrimientos de zona). */
export function formatBusinessDay(businessDate: string): string {
  const date = new Date(`${businessDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return businessDate;
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

const formatTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
};

function AlertRow({ alert }: { alert: AttentionAlertLogEntry }) {
  const statusLabel = alert.ongoing
    ? "En curso"
    : (alert.finalStatus && FINAL_STATUS_LABELS[alert.finalStatus]) || "Finalizado";

  return (
    <li
      className="rounded-xl border border-border bg-card p-3 text-sm"
      data-testid="attention-alert-row"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-card-foreground">
            Turno {alert.ticketNumber}
            <span className="ml-2 font-normal text-muted-foreground">{alert.serviceName}</span>
          </p>
          {alert.operatorName && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {alert.operatorName}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formatTime(alert.exceededAt)}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatAlertDuration(alert.elapsedSeconds)} de {alert.maxAttentionMinutes} min
        </span>
        <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">
          +{formatAlertDuration(alert.exceededSeconds)}
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-medium",
            alert.ongoing
              ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
              : "bg-muted text-muted-foreground",
          )}
        >
          {statusLabel}
        </span>
      </div>
    </li>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
      <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

export function AttentionAlertsPanel({
  open,
  onOpenChange,
  history,
  loading,
  error,
  onRetry,
}: AttentionAlertsPanelProps) {
  const today = history?.businessDate ?? null;
  const todayAlerts = history?.days.find((day) => day.businessDate === today)?.alerts ?? [];
  const previousDays = (history?.days ?? []).filter((day) => day.businessDate !== today);
  const previousTotal = previousDays.reduce((sum, day) => sum + day.count, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md" data-testid="attention-alerts-panel">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Alertas de atención
          </SheetTitle>
          <SheetDescription>
            Turnos que superaron el tiempo máximo de atención de su servicio.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col p-4">
          {error && !history ? (
            <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <p>{error}</p>
              <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">
                Reintentar
              </button>
            </div>
          ) : !history && loading ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando alertas…
            </div>
          ) : (
            <Tabs defaultValue="today" className="flex min-h-0 flex-1 flex-col gap-3">
              <TabsList className="w-full">
                <TabsTrigger value="today" className="flex-1">
                  Hoy ({todayAlerts.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1">
                  Historial ({previousTotal})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="today" className="min-h-0 flex-1 overflow-y-auto">
                {todayAlerts.length === 0 ? (
                  <EmptyState
                    title="Sin alertas hoy"
                    hint="Ningún turno superó el tiempo de atención en el día."
                  />
                ) : (
                  <ul className="space-y-2">
                    {todayAlerts.map((alert) => (
                      <AlertRow key={alert.id} alert={alert} />
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="history" className="min-h-0 flex-1 overflow-y-auto">
                {previousDays.length === 0 ? (
                  <EmptyState
                    title="Sin alertas anteriores"
                    hint="Acá vas a ver las alertas de días anteriores. No se pierden al cambiar el día."
                  />
                ) : (
                  <div className="space-y-5">
                    {previousDays.map((day) => (
                      <section key={day.businessDate} data-testid="attention-alert-day">
                        <h3 className="mb-2 flex items-center justify-between text-sm font-semibold capitalize text-foreground">
                          {formatBusinessDay(day.businessDate)}
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium normal-case text-destructive">
                            {day.count} {day.count === 1 ? "alerta" : "alertas"}
                          </span>
                        </h3>
                        <ul className="space-y-2">
                          {day.alerts.map((alert) => (
                            <AlertRow key={alert.id} alert={alert} />
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
