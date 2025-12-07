// src/components/system-alerts-card.tsx
"use client";

import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

type AlertType = "success" | "warning" | "info";

export interface SystemAlert {
  id: string;
  type: AlertType;
  message: string;
  timestamp?: string;
}

export function SystemAlertsCard({
  alerts = [
    { id: "1", type: "success" as const, message: "Nivel de servicio dentro de la meta", timestamp: "Hace 5 min" },
  ],
}: { alerts?: SystemAlert[] }) {
  const getAlertIcon = (type: AlertType) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-300" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-300" />;
      case "info":
        return <Info className="w-5 h-5 text-blue-600 dark:text-blue-300" />;
    }
  };

  const getAlertColor = (type: AlertType) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 border-green-500/20 dark:bg-green-500/20 dark:border-green-500/30";
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/20 dark:bg-yellow-500/20 dark:border-yellow-500/30";
      case "info":
        return "bg-blue-500/10 border-blue-500/20 dark:bg-blue-500/20 dark:border-blue-500/30";
    }
  };

  return (
    <Card
      className="group relative p-6 border-2 border-border/60 dark:border-border/40 shadow-xl hover:shadow-2xl dark:shadow-2xl transition-all duration-500 overflow-hidden"
      style={{ background: "var(--card)", backdropFilter: "blur(12px)" }}
    >
      {/* overlay hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "var(--gradient-2)" }}
      >
        <div className="absolute inset-0 bg-card/85 dark:bg-card/80" />
      </div>

      <div className="relative z-10">
        {/* header */}
        <div className="flex items-center space-x-4 mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
            style={{ background: "var(--gradient-1)" }}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-card-foreground">Alertas del Sistema</h3>
            <p className="text-sm text-muted-foreground mt-1">Estado operativo y notificaciones ATLITUDE</p>
          </div>
        </div>

        {/* body */}
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="text-center py-12">
              <div
                className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--gradient-3)" }}
              >
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <p className="text-muted-foreground font-medium">Sistema operando perfectamente</p>
              <p className="text-sm text-muted-foreground/70 mt-1">No hay alertas activas</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-5 rounded-2xl border ${getAlertColor(
                  alert.type
                )} flex items-start space-x-4 backdrop-blur-sm`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10">
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-card-foreground mb-1">{alert.message}</p>
                  {alert.timestamp && <p className="text-sm text-muted-foreground">{alert.timestamp}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
