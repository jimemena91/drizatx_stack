"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";

import { DashboardHeader } from "@/components/dashboard-header";
import { MetricCard } from "@/components/metric-card";

import { Users, Clock, UserCheck, TrendingUp as TrendIcon, RefreshCw } from "lucide-react";

import { useQueueStatus } from "@/hooks/use-queue-status";
import { useTickets } from "@/hooks/use-tickets";
import { useOperators } from "@/hooks/use-operators";
import { useAttentionAlerts } from "@/hooks/use-attention-alerts";
import { useToast } from "@/components/toast-provider";
import { Status, type Service } from "@/lib/types";
import { apiClient, ApiError, type OperatorWithStatus, type AttentionAlert } from "@/lib/api-client";
import { DashboardTopControls } from "./components/dashboard-top-controls";
import { QueueStatusCard } from "./components/queue-status-card";
import { OperatorsCard, type DashboardOperator } from "./components/operators-card";
import { AbsentTicketsCard } from "./components/absent-tickets-card";
import { CurrentTicketCard } from "./components/current-ticket-card";
import { SystemAlertsCard } from "./components/system-alerts-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
};

type OperatorDTO = DashboardOperator & {
  username?: string | null;
  email?: string | null;
  position?: string | null;
  role: string;
  active: boolean | number;
  currentTicket?: { id: number; number: string; status: number | string } | null;
  derivedStatus?: "AVAILABLE" | "CALLING" | "BUSY" | "OFFLINE";
  derivedStatusLabel?: string;
  serviceIds?: number[] | null;
  services?: Service[] | null;
};

export default function DashboardPage() {
  // Traemos refetch que devuelve el QueueStatus fresco (ver hook actualizado)
  const { getQueueStatus, refetch } = useQueueStatus();
  const { callNextTicket, updateTicketStatus } = useTickets();
  const { getOperatorsWithStats } = useOperators();

  // Estado local del dashboard
  const [queueStatus, setQueueStatus] = useState(getQueueStatus());
  const [operatorsWithStats, setOperatorsWithStats] = useState<any[]>(getOperatorsWithStats());
  const [loadingOperatorId, setLoadingOperatorId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [isAlertsPanelOpen, setAlertsPanelOpen] = useState(false);
  const { addToast } = useToast();

  const handleNewAlert = useCallback(
    (alert: AttentionAlert) => {
      addToast({
        type: "warning",
        title: `Tiempo excedido en ${alert.serviceName}`,
        description: `Turno ${alert.ticketNumber} lleva ${formatDuration(alert.elapsedSeconds)} en atención`,
        duration: 8000,
      });
    },
    [addToast],
  );

  const {
    alerts: attentionAlerts,
    alertsByTicketId,
    refresh: refreshAttentionAlerts,
  } = useAttentionAlerts({ onNewAlert: handleNewAlert, autoStart: false });

  // Tema
  const { theme, setTheme, systemTheme } = useTheme();
  const [mountedTheme, setMountedTheme] = useState(false);
  useEffect(() => setMountedTheme(true), []);
  const isDark = theme === "dark" || (theme === "system" && systemTheme === "dark");
  const toggleTheme = (checked: boolean) => setTheme(checked ? "dark" : "light");

  // =========================================
  // Refresh centralizado y antisolapamiento
  // =========================================
  const refreshingRef = useRef(false);

  const loadOperatorsNow = async () => {
    try {
      const enriched = await apiClient.getOperatorsWithStatus();
      if (enriched.length > 0) {
        setOperatorsWithStats(enriched as OperatorWithStatus[]);
        return;
      }

      const fallback = await apiClient.getOperators();
      setOperatorsWithStats(
        (fallback ?? []).map((o) =>
          deriveStatusLocal({
            ...o,
            active: Boolean((o as any).active),
            currentTicket: (o as any).currentTicket ?? null,
          }),
        ),
      );
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        console.error("[dashboard] loadOperatorsNow auth error:", e.message);
      } else {
        console.error("[dashboard] loadOperatorsNow error:", e);
      }
    }
  };

  const refreshQueuesAndOperators = async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const data = await refetch();          // ← usa el valor fresco del hook
      if (data) setQueueStatus(data);
      else setQueueStatus(getQueueStatus()); // fallback: último snapshot disponible
      await loadOperatorsNow();
      await refreshAttentionAlerts();
    } catch (e) {
      console.error("[dashboard] refresh error:", e);
      await refreshAttentionAlerts();
    } finally {
      refreshingRef.current = false;
    }
  };

  useEffect(() => {
    void refreshAttentionAlerts();
  }, [refreshAttentionAlerts]);

  useEffect(() => {
    if (isAlertsPanelOpen) {
      void refreshAttentionAlerts();
    }
  }, [isAlertsPanelOpen, refreshAttentionAlerts]);

  // ------- Carga inicial -------
  useEffect(() => {
    void refreshQueuesAndOperators();
  }, []);

  // ------- Refresco periódico (1 min) -------
  useEffect(() => {
    const interval = setInterval(() => {
      void refreshQueuesAndOperators();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Botón "Actualizar"
  const refreshNow = async () => {
    await refreshQueuesAndOperators();
  };

  // =========================
  // Fallback de operadores
  // =========================
  const [operatorsFallback, setOperatorsFallback] = useState<OperatorDTO[]>([]);
  const fallbackTried = useRef(false);

  function deriveStatusLocal(op: OperatorDTO): OperatorDTO {
    const active = op.active === true || op.active === 1 || (op as any).active === "1";
    const st = op.currentTicket?.status;
    let derived: OperatorDTO["derivedStatus"] = "AVAILABLE";
    if (!active) derived = "OFFLINE";
    else if (st === Status.IN_PROGRESS || st === "IN_PROGRESS") derived = "BUSY";
    else if (st === Status.CALLED || st === "CALLED") derived = "CALLING";
    const label =
      derived === "AVAILABLE" ? "Disponible" :
      derived === "CALLING"  ? "Llamando"   :
      derived === "BUSY"     ? "Atendiendo" : "Inactivo";
    return { ...op, derivedStatus: derived, derivedStatusLabel: label };
  }

  useEffect(() => {
    const needFallback = !operatorsWithStats || operatorsWithStats.length === 0;
    if (!needFallback || fallbackTried.current) return;

    let cancelled = false;
    const t = setTimeout(async () => {
      if (!needFallback || cancelled) return;
      try {
        const list = await apiClient.getOperators();
        if (!cancelled) {
          setOperatorsFallback(
            (list ?? []).map((o) =>
              deriveStatusLocal({
                ...o,
                active: Boolean((o as any).active),
                currentTicket: (o as any).currentTicket ?? null,
              }),
            ),
          );
          fallbackTried.current = true;
        }
      } catch (error) {
        console.error("[dashboard] fallback operators error:", error);
        fallbackTried.current = true;
      }
    }, 1000);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [operatorsWithStats]);

  const operatorsToRender: OperatorDTO[] =
    operatorsWithStats && operatorsWithStats.length > 0
      ? operatorsWithStats.map((op: any) =>
          deriveStatusLocal({
            ...op,
            active: op.active,
            currentTicket: op.currentTicket ?? null,
          }),
        )
      : operatorsFallback;

  // =========================
  // Helpers Tickets
  // =========================
  async function pickServiceIdForOperator(operatorId: number): Promise<number | null> {
    try {
      const payload = await apiClient.getOperatorServices(operatorId);
      const services: any[] = Array.isArray(payload?.services) ? payload.services : [];
      const actives = services.filter((s) => s && (s.active === 1 || s.active === true));
      const activeIds = actives.map((s) => Number(s.id));
      return activeIds[0] ?? null;
    } catch (error) {
      console.error("[dashboard] pickServiceIdForOperator error:", error);
      return null;
    }
  }

  async function fetchTicketStatus(ticketId: number) {
    try {
      const t = await apiClient.getTicket(ticketId);
      return (t?.status ?? null) as Status | null;
    } catch (error) {
      console.error("[dashboard] fetchTicketStatus error:", error);
      return null;
    }
  }

  // =========================
  // Handlers: flujo de atención
  // =========================
  const handleCallNext = async (op: OperatorDTO) => {
    setErrorMsg(null); setInfoMsg(null);
    const derived = op.derivedStatus ?? deriveStatusLocal(op).derivedStatus;
    if (derived === "OFFLINE") { setErrorMsg("El operador está inactivo"); return; }
    if (derived === "BUSY" || derived === "CALLING") { setErrorMsg("El operador ya tiene un ticket activo o llamado"); return; }

    setLoadingOperatorId(op.id);
    try {
      const svcId = await pickServiceIdForOperator(op.id);
console.log(
  "[Dashboard] callNext → operatorId=%s serviceId=%s",
  op.id,
  svcId
);
      if (!Number.isInteger(svcId)) { setErrorMsg("Este operador no tiene servicios asignados o activos."); return; }

      const nextTicket = await callNextTicket(op.id, Number(svcId));
      if (!nextTicket) { setInfoMsg("No hay turnos en espera"); await loadOperatorsNow(); return; }

      setOperatorsWithStats((prev: any[]) =>
        (prev ?? []).map((p: any) =>
          p.id === op.id
            ? {
                ...p,
                currentTicket: {
                  id: nextTicket.id,
                  number: nextTicket.number,
                  status: "CALLED",
                  serviceId: nextTicket.serviceId,
                },
                derivedStatus: "CALLING",
                derivedStatusLabel: "Llamando",
              }
            : p
        )
      );

      setInfoMsg(`Llamado ${nextTicket.number}`);
      await refreshQueuesAndOperators();
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.toLowerCase().includes("no hay tickets")) setInfoMsg("No hay turnos en espera para este servicio");
      else setErrorMsg(msg || "Error llamando al siguiente ticket");
      await loadOperatorsNow();
    } finally {
      setLoadingOperatorId(null);
    }
  };

  const handleStartAttention = async (ticketId: number) => {
    setErrorMsg(null); setInfoMsg(null);
    try {
      const id = Number(ticketId);
      if (!Number.isInteger(id) || id <= 0) throw new Error("ticketId inválido");
      const serverStatus = await fetchTicketStatus(id);
      if (serverStatus !== Status.CALLED) {
        await loadOperatorsNow();
        await refreshQueuesAndOperators();
        setErrorMsg("No se puede iniciar: el ticket no está en CALLED.");
        return;
      }

      setOperatorsWithStats((prev: any[]) =>
        (prev ?? []).map((p: any) =>
          p?.currentTicket?.id === id
            ? {
                ...p,
                currentTicket: { ...p.currentTicket, status: "IN_PROGRESS" },
                derivedStatus: "BUSY",
                derivedStatusLabel: "Atendiendo",
              }
            : p
        )
      );

      await updateTicketStatus(id, Status.IN_PROGRESS);
      setInfoMsg("Atención iniciada");
      await refreshQueuesAndOperators();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Error iniciando atención");
      await loadOperatorsNow();
    }
  };

  const handleCompleteTicket = async (ticketId: number) => {
    setErrorMsg(null); setInfoMsg(null);
    try {
      const id = Number(ticketId);
      if (!Number.isInteger(id) || id <= 0) throw new Error("ticketId inválido");
      const serverStatus = await fetchTicketStatus(id);
      if (serverStatus !== Status.IN_PROGRESS) {
        await loadOperatorsNow();
        await refreshQueuesAndOperators();
        setErrorMsg("No se puede completar: el ticket no está en IN_PROGRESS.");
        return;
      }

      setOperatorsWithStats((prev: any[]) =>
        (prev ?? []).map((p: any) =>
          p?.currentTicket?.id === id
            ? { ...p, currentTicket: null, derivedStatus: "AVAILABLE", derivedStatusLabel: "Disponible" }
            : p
        )
      );

      await updateTicketStatus(id, Status.COMPLETED);
      setInfoMsg("Atención finalizada");
      await refreshQueuesAndOperators();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Error finalizando atención");
      await loadOperatorsNow();
    }
  };

  const handleMarkAbsent = async (ticketId: number) => {
    setErrorMsg(null); setInfoMsg(null);
    try {
      const id = Number(ticketId);
      if (!Number.isInteger(id) || id <= 0) throw new Error("ticketId inválido");
      const serverStatus = await fetchTicketStatus(id);
      if (serverStatus !== Status.CALLED) {
        await loadOperatorsNow();
        await refreshQueuesAndOperators();
        setErrorMsg("Solo se puede marcar AUSENTE desde CALLED.");
        return;
      }

      setOperatorsWithStats((prev: any[]) =>
        (prev ?? []).map((p: any) =>
          p?.currentTicket?.id === id
            ? { ...p, currentTicket: null, derivedStatus: "AVAILABLE", derivedStatusLabel: "Disponible" }
            : p
        )
      );

      await updateTicketStatus(id, Status.ABSENT);
      await refreshQueuesAndOperators();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Error marcando ausente");
      await loadOperatorsNow();
    }
  };

  const handleReintegrate = async (ticketId: number) => {
    setErrorMsg(null); setInfoMsg(null);
    try {
      const id = Number(ticketId);
      if (!Number.isInteger(id) || id <= 0) throw new Error("ticketId inválido");
      const serverStatus = await fetchTicketStatus(id);
      if (serverStatus !== Status.ABSENT) {
        await loadOperatorsNow();
        await refreshQueuesAndOperators();
        setErrorMsg("Solo se puede reintegrar desde ABSENT.");
        return;
      }

      setOperatorsWithStats((prev: any[]) =>
        (prev ?? []).map((p: any) =>
          p?.currentTicket?.id === id
            ? { ...p, currentTicket: null, derivedStatus: "AVAILABLE", derivedStatusLabel: "Disponible" }
            : p
        )
      );

      await updateTicketStatus(id, Status.WAITING);
      await refreshQueuesAndOperators();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Error reintegrando ticket");
      await loadOperatorsNow();
    }
  };

  // =========================
  // Render
  // =========================
  const filteredQueues = queueStatus.queues;

  const filteredNextTickets = queueStatus.nextTickets;

  const filteredCurrentTicket = queueStatus.currentTicket ?? null;

  const filteredMetrics = queueStatus.todayMetrics;

  const serviceTrend: "up" | "down" | "neutral" =
    typeof filteredMetrics?.serviceLevel === "number"
      ? filteredMetrics.serviceLevel >= 90
        ? "up"
        : "down"
      : "neutral";

  const totalInQueueDisplay =
    typeof filteredMetrics?.totalInQueue === "number"
      ? String(filteredMetrics.totalInQueue)
      : "—";
  const averageWaitDisplay =
    typeof filteredMetrics?.averageWaitTime === "number"
      ? `${filteredMetrics.averageWaitTime} min`
      : "—";
  const attendedDisplay =
    typeof filteredMetrics?.attendedToday === "number"
      ? String(filteredMetrics.attendedToday)
      : "—";
  const serviceLevelDisplay =
    typeof filteredMetrics?.serviceLevel === "number"
      ? `${filteredMetrics.serviceLevel}%`
      : "—";
  const serviceTrendValue =
    typeof filteredMetrics?.serviceLevel === "number"
      ? `${filteredMetrics.serviceLevel}%`
      : undefined;
  const attendedTrend: "up" | "down" | "neutral" =
    typeof filteredMetrics?.attendedToday === "number" ? "up" : "neutral";
  const attendedTrendValue =
    typeof filteredMetrics?.attendedToday === "number" ? "+" : undefined;

  const filteredOperators = operatorsToRender;

  const absentTicketsAll = queueStatus.absentTickets ?? [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const toDate = (value: Date | string | null | undefined): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const filteredAttentionAlerts = attentionAlerts.filter((alert) => {
    const reference = toDate(alert.startedAt) ?? toDate(alert.completedAt);
    if (!reference) return false;
    return reference >= startOfToday && reference < startOfTomorrow;
  });

  const filteredAlertsByTicketId = new Map(
    filteredAttentionAlerts.map((alert) => [alert.ticketId, alert]),
  );

  const alertsCount = filteredAttentionAlerts.length;

  const absentTickets = absentTicketsAll.filter((ticket) => {
    const reference =
      toDate(ticket.absentAt) ?? toDate(ticket.calledAt) ?? toDate(ticket.createdAt) ?? null;
    if (!reference) return false;
    return reference >= startOfToday && reference < startOfTomorrow;
  });

  const historicalAbsentCount = Math.max(absentTicketsAll.length - absentTickets.length, 0);

  return (
    <>
      <Sheet open={isAlertsPanelOpen} onOpenChange={setAlertsPanelOpen}>
        <SheetContent side="right" className="sm:max-w-md p-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle className="text-lg">Alertas de atención</SheetTitle>
            <SheetDescription>
              Turnos que superaron el tiempo máximo de atención.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {alertsCount === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No hay alertas de atención activas en este momento.
              </p>
            ) : (
              <ul className="space-y-3 py-4">
                {filteredAttentionAlerts.map((alert) => (
                  <li key={alert.ticketId} className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{alert.serviceName}</p>
                        <p className="text-xs text-muted-foreground">Ticket asignado</p>
                      </div>
                      <Badge variant="secondary" className="text-xs font-semibold uppercase tracking-wide">
                        {alert.ticketNumber}
                      </Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-wide">Tiempo transcurrido</dt>
                        <dd className="text-foreground">{formatDuration(alert.elapsedSeconds)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide">Tiempo máximo</dt>
                        <dd className="text-foreground">{formatDuration(alert.maxAttentionTime)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <SheetFooter className="border-t border-border">
            <Button
              variant="outline"
              onClick={() => {
                void refreshAttentionAlerts();
              }}
              className="justify-start"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualizar alertas
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DashboardHeader>
        <DashboardTopControls
          mountedTheme={mountedTheme}
          isDarkTheme={isDark}
          onThemeToggle={toggleTheme}
          onRefresh={refreshNow}
          alertsCount={alertsCount}
          onAlertsClick={() => setAlertsPanelOpen(true)}
        />
      </DashboardHeader>

      {/* Mensajes */}
      {errorMsg && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 text-destructive px-3 py-2 text-sm">
          {errorMsg}
        </div>
      )}
      {infoMsg && (
        <div className="rounded-md border border-secondary/40 bg-secondary/15 text-foreground px-3 py-2 text-sm">
          {infoMsg}
        </div>
      )}

      {/* Métricas principales */}
      <div className="mt-8 space-y-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <MetricCard
            title="Total en Cola"
            value={totalInQueueDisplay}
            subtitle="Esperando atención"
            trend="neutral"
            icon={<Users className="w-5 h-5" />}
          />

          <MetricCard
            title="Tiempo Promedio"
            value={averageWaitDisplay}
            subtitle="Tiempo de espera"
            trend="neutral"
            icon={<Clock className="w-5 h-5" />}
          />

          <MetricCard
            title="Atendidos Hoy"
            value={attendedDisplay}
            subtitle="Tickets completados"
            trend={attendedTrend}
            trendValue={attendedTrendValue}
            icon={<UserCheck className="w-5 h-5" />}
          />

          <MetricCard
            title="Nivel de Servicio"
            value={serviceLevelDisplay}
            subtitle="Meta: 90%"
            trend={serviceTrend}
            trendValue={serviceTrendValue}
            icon={<TrendIcon className="w-5 h-5" />}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <QueueStatusCard queues={filteredQueues} />
          <OperatorsCard
            operators={filteredOperators}
            attentionAlerts={filteredAttentionAlerts}
            alertsByTicketId={filteredAlertsByTicketId}
            loadingOperatorId={loadingOperatorId}
            onCallNext={handleCallNext}
            onStartAttention={handleStartAttention}
            onMarkAbsent={handleMarkAbsent}
            onCompleteTicket={handleCompleteTicket}
            formatDuration={formatDuration}
          />
        </div>

        <AbsentTicketsCard
          tickets={absentTickets}
          historicalCount={historicalAbsentCount}
          onReintegrate={handleReintegrate}
        />

        <CurrentTicketCard ticket={filteredCurrentTicket} />

        <SystemAlertsCard />
      </div>
    </>
  );
}
