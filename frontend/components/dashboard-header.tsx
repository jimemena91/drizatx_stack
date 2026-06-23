// frontend/components/dashboard-header.tsx
"use client"

import type { ReactNode } from "react"

import { UserMenu } from "@/components/user-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"

type DashboardHeaderProps = {
  children?: ReactNode
}

export function DashboardHeader({ children }: DashboardHeaderProps) {
  return (
    <div
      className="relative backdrop-blur-xl border-b-2 border-border/40 dark:border-border/30 px-6 py-4 overflow-hidden"
      style={{ background: "var(--background)" }}
    >
      {/* halo suave */}
      <div className="absolute inset-0 opacity-30 dark:opacity-40 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-96 h-24 rounded-full blur-3xl"
          style={{ background: "var(--gradient-1)" }}
        />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 sm:items-center">
          <div className="min-w-0">
            <div className="mb-2 md:hidden">
              <SidebarTrigger className="size-9 border border-border/50 bg-card/80 hover:bg-accent" />
            </div>
            <h1
              className="mb-1 text-2xl font-bold sm:text-3xl"
              style={{
                background: "var(--gradient-3)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Dashboard Operativo
            </h1>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Control de flujo en tiempo real con tecnología ATLITUDE
            </p>
          </div>

          {/* Menú de usuario */}
          <UserMenu />
        </div>

        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </div>
  )
}

export default DashboardHeader
