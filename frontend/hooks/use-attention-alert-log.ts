"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, type AttentionAlertHistory } from "@/lib/api-client";

type Options = {
  /** Cada cuánto se refresca el contador del ícono. */
  pollIntervalMs?: number;
  /** Cantidad de días de historial que se piden al abrir el panel. */
  historyDays?: number;
};

type UseAttentionAlertLogResult = {
  /** Alertas del día comercial actual (se renueva solo al cambiar el día). */
  todayCount: number;
  businessDate: string | null;
  history: AttentionAlertHistory | null;
  loadingHistory: boolean;
  historyError: string | null;
  refreshSummary: () => Promise<void>;
  loadHistory: () => Promise<void>;
};

/**
 * Contador del día + historial de alertas de tiempo de atención excedido.
 *
 * No muestra nada por sí mismo: sólo expone datos para el ícono y el panel.
 * El contador se consulta de forma liviana y se pausa con la pestaña oculta.
 */
export function useAttentionAlertLog(options: Options = {}): UseAttentionAlertLogResult {
  const { pollIntervalMs = 15_000, historyDays = 30 } = options;

  const [todayCount, setTodayCount] = useState(0);
  const [businessDate, setBusinessDate] = useState<string | null>(null);
  const [history, setHistory] = useState<AttentionAlertHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const summaryInFlight = useRef(false);
  const historyInFlight = useRef(false);

  const refreshSummary = useCallback(async () => {
    if (summaryInFlight.current) return;
    summaryInFlight.current = true;
    try {
      const summary = await apiClient.getAttentionAlertSummary();
      setTodayCount(summary.todayCount);
      setBusinessDate(summary.businessDate || null);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[useAttentionAlertLog] no se pudo leer el contador", error);
      }
    } finally {
      summaryInFlight.current = false;
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (historyInFlight.current) return;
    historyInFlight.current = true;
    setLoadingHistory(true);
    try {
      const data = await apiClient.getAttentionAlertHistory(historyDays);
      setHistory(data);
      setHistoryError(null);
      // El contador del ícono y el panel salen de la misma fuente.
      setTodayCount(data.todayCount);
      if (data.businessDate) setBusinessDate(data.businessDate);
    } catch (error) {
      setHistoryError(
        error instanceof Error && error.message
          ? error.message
          : "No se pudo cargar el historial de alertas.",
      );
    } finally {
      historyInFlight.current = false;
      setLoadingHistory(false);
    }
  }, [historyDays]);

  useEffect(() => {
    void refreshSummary();

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshSummary();
    };
    const id = setInterval(tick, pollIntervalMs);

    const onVisible = () => {
      if (!document.hidden) void refreshSummary();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollIntervalMs, refreshSummary]);

  return { todayCount, businessDate, history, loadingHistory, historyError, refreshSummary, loadHistory };
}
