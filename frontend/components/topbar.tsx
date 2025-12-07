// components/topbar.tsx
"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-white px-3">
      <SidebarTrigger />
      <span className="text-sm font-medium">DrizaTx</span>
    </header>
  )
}
