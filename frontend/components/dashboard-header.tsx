// frontend/components/dashboard-header.tsx
"use client"

import type { ReactNode } from "react"

import { UserMenu } from "@/components/user-menu"

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
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-bold mb-1"
              style={{
                background: "var(--gradient-3)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Dashboard Operativo
            </h1>
            <p className="text-sm text-muted-foreground">
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
