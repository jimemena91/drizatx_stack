"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAttentionAlertLog } from "@/hooks/use-attention-alert-log";
import { cn } from "@/lib/utils";
import { AttentionAlertsPanel } from "./attention-alerts-panel";

const HISTORY_REFRESH_MS = 15_000;

type AttentionAlertsButtonProps = {
  className?: string;
};

/**
 * Botón "Alertas" con el contador del día. Las alertas de tiempo de atención
 * excedido sólo se ven al abrir el panel: nunca como toasts ni banners.
 * El contador se renueva cada día comercial; el historial queda en el panel.
 */
export function AttentionAlertsButton({ className }: AttentionAlertsButtonProps) {
  const [open, setOpen] = useState(false);
  const { todayCount, history, loadingHistory, historyError, loadHistory } = useAttentionAlertLog();

  // Con el panel abierto se carga el historial y se mantiene al día.
  useEffect(() => {
    if (!open) return;
    void loadHistory();
    const id = setInterval(() => void loadHistory(), HISTORY_REFRESH_MS);
    return () => clearInterval(id);
  }, [open, loadHistory]);

  const label =
    todayCount > 0
      ? `Alertas: ${todayCount} ${todayCount === 1 ? "alerta" : "alertas"} hoy`
      : "Alertas: sin alertas hoy";

  return (
    <div className={cn("relative w-full sm:w-auto", className)}>
      <Button
        className="btn-premium w-full sm:w-auto"
        onClick={() => setOpen(true)}
        aria-label={label}
        data-testid="attention-alerts-button"
      >
        <AlertTriangle className="mr-2 h-4 w-4" />
        Alertas
      </Button>

      {todayCount > 0 && (
        <span
          aria-hidden="true"
          data-testid="attention-alerts-badge"
          className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold leading-none text-white ring-2 ring-background"
        >
          {todayCount > 99 ? "99+" : todayCount}
        </span>
      )}

      <AttentionAlertsPanel
        open={open}
        onOpenChange={setOpen}
        history={history}
        loading={loadingHistory}
        error={historyError}
        onRetry={() => void loadHistory()}
      />
    </div>
  );
}
