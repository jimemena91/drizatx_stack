// frontend/components/dashboard-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Clock,
  BarChart3,
  Settings,
  Bell,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type NavItem = {
  name: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  href: string;
};

const navigation: NavItem[] = [
  { name: "Dashboard Operativo", icon: LayoutDashboard, href: "/dashboard" },
  { name: "Clientes", icon: Users, href: "/clients" },
  { name: "Terminal Autoservicio", icon: Clock, href: "/kiosk" },
  { name: "Reportes y Analytics", icon: BarChart3, href: "/reports" },
  { name: "Administración", icon: Settings, href: "/admin" },
];

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      // mantiene toda la lógica de colapso/offcanvas y variantes del ui/sidebar
      variant="inset"
      collapsible="offcanvas"
      className={cn(
        "relative overflow-hidden border border-sidebar-border/40 rounded-lg shadow-lg",
        // pintamos el fondo estilo figma desde la variable de tema
        "bg-[var(--sidebar)]"
      )}
    >
      {/* halos / blobs animados (estilo figma) */}
      <div className="absolute inset-0 opacity-25 pointer-events-none">
        <div className="absolute top-20 -left-20 w-40 h-40 rounded-full bg-white/15 blur-3xl animate-pulse" />
        <div
          className="absolute bottom-20 -right-20 w-60 h-60 rounded-full bg-white/10 blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />
      </div>

      {/* Header con branding */}
      <SidebarHeader className="relative px-5 pt-6 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center border border-white/30 shadow-lg">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white drop-shadow-sm">DrZaTx</h1>
            <p className="text-sm text-white/85">ATLITUDE Dashboard</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="bg-white/15" />

      {/* Navegación principal */}
      <SidebarContent className="relative">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="px-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                return (
                  <SidebarMenuItem key={item.href}>
                    <Link href={item.href} className="block">
                      <SidebarMenuButton
                        asChild
                        // variante grande y con card “glass” como figma
                        size="lg"
                        isActive={isActive}
                        className={cn(
                          "rounded-2xl px-4 py-4 h-auto border-0",
                          isActive
                            ? "bg-white/30 text-white shadow-lg border border-white/25 backdrop-blur-sm"
                            : "text-white/85 hover:bg-white/20 hover:text-white"
                        )}
                      >
                        <span className="flex items-center w-full">
                          <Icon className="w-5 h-5 mr-4 transition-transform duration-300 group-hover/menu-item:scale-110" />
                          <span className="flex-1 font-medium">{item.name}</span>
                          {isActive ? (
                            <ChevronRight className="w-4 h-4" />
                          ) : (
                            <div className="w-4 h-4 opacity-0 group-hover/menu-item:opacity-50 transition-opacity duration-300">
                              <ChevronRight className="w-4 h-4" />
                            </div>
                          )}
                        </span>
                      </SidebarMenuButton>
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Tarjeta de estado / alerta (figma) */}
        <div className="px-4 mt-6 pb-2">
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-5 border border-white/15 shadow-lg">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400/30 to-emerald-400/30 flex items-center justify-center shadow-sm">
                <Bell className="w-5 h-5 text-green-200" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-white mb-2 drop-shadow-sm">Estado del Sistema</h4>
                <p className="text-sm text-white/90 leading-relaxed">
                  Nivel de servicio dentro de la meta. Todos los servicios operando normalmente.
                </p>
                <div className="mt-3 flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-green-300 animate-pulse shadow-sm" />
                  <span className="text-xs text-green-200 font-medium">Operativo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarContent>

      <SidebarFooter className="pb-4" />
    </Sidebar>
  );
}

/**
 * Helper opcional: contenedor de contenido principal cuando se usa el Sidebar variant="inset".
 * (Reexport para que el page.tsx quede limpio)
 */
export const DashboardSidebarInset = SidebarInset;
