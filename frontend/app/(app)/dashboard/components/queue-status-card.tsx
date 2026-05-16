"use client";

import Link from "next/link";
import { Users, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ServiceWithStats } from "@/lib/types";

type QueueStatusCardProps = {
  queues: ServiceWithStats[];
};

export function QueueStatusCard({ queues }: QueueStatusCardProps) {
  return (
    <Card
      className="group relative overflow-hidden border-2 border-border/60 p-4 shadow-xl transition-all duration-500 hover:shadow-2xl dark:border-border/40 dark:shadow-2xl sm:p-5 lg:p-6"
      style={{ background: "var(--card)", backdropFilter: "blur(12px)" }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "var(--gradient-3)" }}
      >
        <div className="absolute inset-0 bg-card/85 dark:bg-card/80" />
      </div>

      <div className="relative z-10">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mb-6">
          <div className="flex items-start gap-3 sm:items-center sm:space-x-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
              style={{ background: "var(--gradient-2)" }}
            >
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-card-foreground">Estado de las Colas</h3>
              <p className="text-sm text-muted-foreground mt-1">Monitoreo en tiempo real por tipo de servicio</p>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <Badge
              variant="secondary"
              className="border-0 font-semibold px-4 py-2 rounded-xl"
              style={{ background: "var(--secondary)", color: "var(--secondary-foreground)" }}
            >
              {queues.length} servicios
            </Badge>

            <Link href="/dashboard/queues">
              <Button variant="outline" className="w-full hover:bg-accent hover:text-accent-foreground sm:w-auto">
                Ver detalle
              </Button>
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          {queues.map((queue) => {
            const heavy = queue.waitingCount > 15;
            const chipClasses = heavy
              ? "bg-yellow-500/20 text-yellow-700 dark:bg-yellow-500/30 dark:text-yellow-200"
              : "bg-green-500/20 text-green-700 dark:bg-green-500/30 dark:text-green-200";
            return (
              <div
                key={queue.id}
                className="flex flex-col gap-3 rounded-2xl border border-border/30 p-3 backdrop-blur-sm transition-all duration-300 hover:shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-4"
                style={{ background: "var(--muted)" }}
              >
                <div className="flex flex-wrap items-center gap-2 sm:space-x-4">
                  <Badge
                    variant="secondary"
                    className={`${chipClasses} border-0 font-semibold px-4 py-2 rounded-xl`}
                  >
                    {queue.name}
                  </Badge>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="font-medium">{queue.averageTime} promedio</span>
                  </div>
                </div>
                <div
                  className="text-2xl font-bold sm:text-3xl"
                  style={{
                    background: "var(--gradient-4)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                  title={`${queue.waitingCount} esperando`}
                >
                  {queue.waitingCount}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
