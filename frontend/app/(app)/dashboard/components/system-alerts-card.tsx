"use client";

import { AlertTriangle, CheckCircle } from "lucide-react";

import { Card } from "@/components/ui/card";

export function SystemAlertsCard() {
  return (
    <Card
      className="group relative p-6 border-2 border-border/60 dark:border-border/40 shadow-xl hover:shadow-2xl dark:shadow-2xl transition-all duration-500 overflow-hidden"
      style={{ background: "var(--card)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "var(--gradient-2)" }}
      >
        <div className="absolute inset-0 bg-card/85 dark:bg-card/80" />
      </div>

      <div className="relative z-10">
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

        <div className="space-y-4">
          <div className="p-5 rounded-2xl border bg-green-500/10 border-green-500/20 dark:bg-green-500/20 dark:border-green-500/30 flex items-start space-x-4 backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/10">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-300" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-card-foreground mb-1">Nivel de servicio dentro de la meta</p>
              <p className="text-sm text-muted-foreground">Hace 5 min</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
