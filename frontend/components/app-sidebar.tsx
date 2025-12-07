"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarBrandHeader,
} from "@/components/ui/sidebar";

import { ApiStatusIndicator } from "./api-status-indicator";
import { useAuth } from "@/contexts/auth-context";
import { hasPermission } from "@/lib/auth-utils";
import type { Permission } from "@/lib/types";
import {
  Monitor,
  Smartphone,
  Tv,
  Settings,
  BarChart3,
  QrCode,
  Home,
  Users,
  BookOpen,
  ShieldCheck,
  Headset,
  KeyRound,
  LogOut,
} from "lucide-react";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission | null;
};
type NavGroup = { title: string; items: NavItem[] };

const data: { navMain: NavGroup[] } = {
  navMain: [
    {
      title: "Principal",
      items: [
        { title: "Inicio", url: "/", icon: Home, permission: "view_dashboard" },
        { title: "Dashboard Operativo", url: "/dashboard", icon: Monitor, permission: "view_dashboard" },
        { title: "Documentación", url: "/docs", icon: BookOpen, permission: "view_dashboard" },
      ],
    },
    {
      title: "Atención al Cliente",
      items: [
        { title: "Mi Puesto", url: "/operator", icon: Headset, permission: "call_tickets" },
        { title: "Terminal Autoservicio", url: "/terminal", icon: QrCode, permission: "call_tickets" },
        { title: "Cartelería Digital", url: "/display", icon: Tv, permission: null },
        { title: "App Móvil", url: "/mobile", icon: Smartphone, permission: null },
      ],
    },
    {
      title: "Gestión",
      items: [
        { title: "Clientes", url: "/clients", icon: Users, permission: "manage_clients" },
        { title: "Reportes y Analytics", url: "/reports", icon: BarChart3, permission: "view_reports" },
        { title: "Roles y Permisos", url: "/admin/roles", icon: KeyRound, permission: "manage_roles" },
        { title: "Administración", url: "/admin", icon: Settings, permission: "manage_settings" },
        { title: "Auditoría", url: "/audit", icon: ShieldCheck, permission: "view_system_logs" },
      ],
    },
  ],
};

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, logout } = useAuth();
  const role = state.user?.role;
  const isOperatorRole = role === "OPERATOR";

  const canSee = React.useCallback(
    (perm: NavItem["permission"]) => {
      if (!perm) return true;
      return hasPermission(state.permissions, perm);
    },
    [state.permissions],
  );

  return (
    <Sidebar variant="inset" collapsible="offcanvas" {...props}>
      {/* Header con branding + estado API */}
      <SidebarBrandHeader title="DrizaTx" />
      <div className="px-5 pb-2">
        <ApiStatusIndicator />
      </div>
      <SidebarSeparator className="bg-white/15" />

      <SidebarContent>
        {isOperatorRole
          ? null
          : data.navMain.map((group) => {
              const visible = group.items.filter((item) => {
                if (item.url === "/mobile" && role !== "SUPERADMIN") {
                  return false;
                }

                return canSee(item.permission);
              });
              if (visible.length === 0) return null;

              return (
                <SidebarGroup key={group.title}>
                  <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="px-2">
                      {visible.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.url || (pathname?.startsWith(item.url + "/") ?? false);
                        const isOperatorItem = item.url === "/operator";

                        if (isOperatorItem) {
                          return (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton
                                type="button"
                                isActive={isActive}
                                size="lg"
                                onClick={() => {
                                  if (isOperatorRole) {
                                    router.push("/operator");
                                  } else {
                                    router.replace("/");
                                  }
                                }}
                                aria-disabled={!isOperatorRole}
                                data-disabled={isOperatorRole ? undefined : true}
                                className={!isOperatorRole ? "cursor-not-allowed opacity-60" : undefined}
                              >
                                <Icon className="h-4 w-4" />
                                <span>
                                  {item.title}
                                  {!isOperatorRole ? " · Solo operadores" : ""}
                                </span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        }
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild isActive={isActive} size="lg">
                              <Link href={item.url}>
                                <Icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
      </SidebarContent>

      {/* Footer: botón “A” que cierra sesión */}
      <SidebarFooter className="pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              onClick={() => {
                logout();
                router.replace("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {state.user && (
            <SidebarMenuItem>
              <div className="px-2 text-xs text-muted-foreground truncate">
                {state.user.name} {state.user.role ? `· ${state.user.role}` : ""}
              </div>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
