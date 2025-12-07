"use client";

import { useMemo, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";

export function OperatorShell({ children }: { children: ReactNode }) {
  const { state, logout } = useAuth();
  const router = useRouter();

  const operatorName = useMemo(() => {
    return state.user?.name?.trim() || state.user?.email || "Operador";
  }, [state.user?.email, state.user?.name]);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="min-h-svh w-full bg-hero dark:bg-hero-dark">
      <div className="flex min-h-svh w-full flex-col">
        <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-sm transition dark:border-slate-800/60 dark:bg-slate-950/70">
          <div className="mx-auto flex w-full max-w-screen-2xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
            <Logo variant="gradient" showText size="md" />
            <div className="flex items-center gap-4">
              <span className="hidden text-sm font-semibold text-slate-600 dark:text-slate-200 sm:inline">
                {operatorName}
              </span>
              <Button
                type="button"
                variant="secondary"
                className="gap-2"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Cerrar sesión</span>
                <span className="sm:hidden">Salir</span>
              </Button>
            </div>
          </div>
        </header>
        <main className="flex-1">
          <div className="mx-auto flex w-full max-w-screen-2xl flex-col px-4 py-6 sm:px-6 lg:px-8">
            <section className="glass card-elev-2 w-full rounded-2xl p-4 sm:p-6 lg:p-8">
              {children}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
