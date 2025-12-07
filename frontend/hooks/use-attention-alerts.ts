"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient, type AttentionAlert } from "@/lib/api-client";
import { audioService } from "@/lib/audio-service";

type Options = {
  pollIntervalMs?: number;
  autoStart?: boolean;
  onNewAlert?: (alert: AttentionAlert) => void;
};

type UseAttentionAlertsResult = {
  alerts: AttentionAlert[];
  alertsByTicketId: Map<number, AttentionAlert>;
  refresh: () => Promise<void>;
};

export function useAttentionAlerts(options: Options = {}): UseAttentionAlertsResult {
  const { pollIntervalMs = 5000, autoStart = true, onNewAlert } = options;
  const [alerts, setAlerts] = useState<AttentionAlert[]>([]);
  const seenRef = useRef<Map<number, boolean>>(new Map());
  const fetchInFlight = useRef(false);

  const fetchAlerts = useCallback(async () => {
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    try {
      const next = await apiClient.getAttentionAlerts();
      setAlerts(next);

      const previous = seenRef.current;
      const nextSeen = new Map<number, boolean>();
      const newlyExceeded: AttentionAlert[] = [];

      for (const alert of next) {
        if (!previous.has(alert.ticketId)) {
          newlyExceeded.push(alert);
        }
        nextSeen.set(alert.ticketId, true);
      }

      seenRef.current = nextSeen;

      if (newlyExceeded.length > 0) {
        void audioService.playAttentionAlert().catch((error) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[useAttentionAlerts] audio alert failed", error);
          }
        });
        if (onNewAlert) {
          newlyExceeded.forEach((alert) => onNewAlert(alert));
        }
      }
    } catch (error) {
      console.error("[useAttentionAlerts] error fetching alerts", error);
    } finally {
      fetchInFlight.current = false;
    }
  }, [onNewAlert]);

  useEffect(() => {
    if (!autoStart) return;
    void fetchAlerts();
    const id = setInterval(() => {
      void fetchAlerts();
    }, pollIntervalMs);
    return () => clearInterval(id);
  }, [autoStart, fetchAlerts, pollIntervalMs]);

  const alertsByTicketId = useMemo(() => {
    const map = new Map<number, AttentionAlert>();
    for (const alert of alerts) {
      map.set(alert.ticketId, alert);
    }
    return map;
  }, [alerts]);

  const refresh = useCallback(async () => {
    await fetchAlerts();
  }, [fetchAlerts]);

  return { alerts, alertsByTicketId, refresh };
}
