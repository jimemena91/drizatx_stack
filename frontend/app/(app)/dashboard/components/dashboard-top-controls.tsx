"use client";

import { Activity, AlertTriangle, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DashboardTopControlsProps = {
  mountedTheme: boolean;
  isDarkTheme: boolean;
  onThemeToggle: (checked: boolean) => void;
  onRefresh: () => void;
  onAlertsClick?: () => void;
  alertsCount?: number;
  className?: string;
};

export function DashboardTopControls({
  mountedTheme,
  isDarkTheme,
  onThemeToggle,
  onRefresh,
  onAlertsClick,
  alertsCount = 0,
  className,
}: DashboardTopControlsProps) {
  return (
    <div
      className={cn(
        "flex flex-col space-y-4 lg:flex-row lg:items-end lg:justify-between lg:space-y-0 lg:gap-6",
        className,
      )}
    >
      <div className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-input-background px-3 py-2 sm:w-auto">
        <Sun className="size-4 opacity-60" />
        {mountedTheme ? (
          <Switch
            aria-label="Cambiar tema"
            checked={isDarkTheme}
            onCheckedChange={onThemeToggle}
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-switch-background"
          />
        ) : (
          <div className="h-[1.15rem] w-8 rounded-full bg-muted" />
        )}
        <Moon className="size-4 opacity-60" />
      </div>

      <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:gap-2">
        <Button
          variant="outline"
          onClick={onRefresh}
          className="w-full hover:bg-accent hover:text-accent-foreground sm:w-auto"
        >
          <Activity className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
        <Button className="btn-premium relative w-full sm:w-auto" onClick={onAlertsClick}>
          <AlertTriangle className="mr-2 h-4 w-4" />
          Alertas
          <Badge variant="secondary" className="ml-2 px-2 py-0 text-xs font-semibold">
            {alertsCount}
          </Badge>
        </Button>
      </div>
    </div>
  );
}
