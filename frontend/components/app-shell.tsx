"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = pathname?.startsWith("/operator");

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        {/* Hero + glass con la nueva paleta */}
        <main className="min-h-screen bg-hero dark:bg-hero-dark p-4 sm:p-6">
          <section className="glass rounded-xl card-elev-2 p-4 sm:p-6">
            {children}
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
