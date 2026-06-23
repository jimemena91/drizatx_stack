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
        <main className="min-h-screen w-full overflow-x-hidden bg-hero p-3 dark:bg-hero-dark sm:p-4 lg:p-6">
          <section className="glass card-elev-2 w-full rounded-xl p-3 sm:p-4 lg:p-6">
            {children}
          </section>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
