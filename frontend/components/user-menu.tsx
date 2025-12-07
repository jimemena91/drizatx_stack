"use client"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { RoleBadge } from "@/components/role-badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LogOut, User, Settings, ChevronDown } from "lucide-react"
import { PermissionGuard } from "@/components/permission-guard"

export function UserMenu() {
  const { state, logout } = useAuth()
  const router = useRouter()

  if (!state.user) return null

  const isOperator = state.user.role === "OPERATOR"

  const handleLogout = () => {
    logout()
    router.replace("/login")
  }

  const initials =
    state.user.name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || state.user.email?.[0]?.toUpperCase() || "U"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative flex items-center gap-3 px-4 py-2 rounded-xl border border-border/60 dark:border-border/40 backdrop-blur-sm transition-all duration-300 hover:shadow-lg"
          style={{ background: "var(--card)" }}
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback
              className="text-xs text-white"
              style={{ background: "var(--gradient-2)" }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[10rem] truncate text-sm font-semibold text-card-foreground">
            {state.user.name}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-2">
            <p className="text-sm font-medium leading-none">{state.user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{state.user.email}</p>
            <RoleBadge role={state.user.role} size="sm" />
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <span>Perfil</span>
        </DropdownMenuItem>
        {!isOperator && (
          <PermissionGuard permission="manage_settings">
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuración</span>
            </DropdownMenuItem>
          </PermissionGuard>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            handleLogout()
          }}
          onClick={(event) => {
            event.preventDefault()
            handleLogout()
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Cerrar Sesión</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
