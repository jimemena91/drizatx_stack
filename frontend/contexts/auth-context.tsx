"use client"

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Role, type User, type AuthState, type LoginCredentials, type Permission } from "@/lib/types"
import { normalizeRole, normalizeRoles } from "@/lib/auth-utils"
import { isApiMode } from "@/lib/api-mode"
import { apiClient, ApiError, type RoleWithPermissions, normalizePermissionArray } from "@/lib/api-client"

// --- Flags de entorno
const DEMO_MODE = (process.env.NEXT_PUBLIC_DEMO_MODE ?? "") === "1"

// --- Público (no llamar API ni pedir permisos)
const PUBLIC_PREFIXES = ["/terminal", "/display", "/mobile"]
const isPublicPath = (p: string) => PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(x))

// --- Storage keys
const USER_STORAGE_KEY = "drizatx-auth-user"
const TOKEN_STORAGE_KEY = "drizatx-auth-token"
const PERMISSIONS_STORAGE_KEY = "drizatx-auth-permissions"

const demoRolePermissions: Record<Role, Permission[]> = {
  SUPERADMIN: [
    "view_dashboard",
    "manage_clients",
    "manage_services",
    "manage_operators",
    "manage_roles",
    "manage_settings",
    "call_tickets",
    "view_reports",
    "view_system_logs",
  ],
  ADMIN: [
    "view_dashboard",
    "manage_clients",
    "view_reports",
    "manage_settings",
    "manage_services",
    "manage_operators",
    "manage_roles",
    "call_tickets",
    "view_system_logs",
  ],
  SUPERVISOR: ["view_dashboard", "view_reports", "manage_clients", "call_tickets"],
  OPERATOR: ["view_dashboard", "call_tickets"],
}

// --- Usuarios demo
const defaultUsers: (User & { password: string })[] = [
  {
    id: 1,
    username: "superadmin",
    email: "superadmin@drizatx.com",
    password: "superadmin123",
    name: "Super Administrador",
    role: "SUPERADMIN" as Role,
    active: true,
    position: "Seguridad",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    username: "admin",
    email: "admin@drizatx.com",
    password: "admin123",
    name: "Administrador",
    role: "ADMIN" as Role,
    active: true,
    position: "Administración",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    username: "operador",
    email: "operador@drizatx.com",
    password: "operador123",
    name: "Juan Operador",
    role: "OPERATOR" as Role,
    active: true,
    position: "Puesto 1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 4,
    username: "supervisor",
    email: "supervisor@drizatx.com",
    password: "supervisor123",
    name: "María Supervisora",
    role: "SUPERVISOR" as Role,
    active: true,
    position: "Supervisión",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// --- Helpers cookies/localStorage
function setAuthCookie(isOn: boolean, role?: Role | string | null) {
  document.cookie = `drizatx-auth=${isOn ? "1" : ""}; Path=/; SameSite=Lax${isOn ? "" : "; Max-Age=0"}`
  const normalizedRole = normalizeRole(role ?? null)
  if (isOn && normalizedRole) {
    document.cookie = `drizatx-role=${normalizedRole}; Path=/; SameSite=Lax`
  } else {
    document.cookie = "drizatx-role=; Path=/; SameSite=Lax; Max-Age=0"
  }
}

function persistUser(user: User | null): User | null {
  if (user) {
    const permissions = normalizePermissionArray(user.permissions)
    const role = normalizeRole(user.role) ?? Role.OPERATOR
    const roles = normalizeRoles(user.roles, role)
    const normalizedUser: User = { ...user, role, roles, permissions }
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalizedUser))
    return normalizedUser
  }
  localStorage.removeItem(USER_STORAGE_KEY)
  return null
}
function readUserFromStorage(): User | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.createdAt && typeof parsed.createdAt === "string") parsed.createdAt = new Date(parsed.createdAt)
    if (parsed?.updatedAt && typeof parsed.updatedAt === "string") parsed.updatedAt = new Date(parsed.updatedAt)
    parsed.permissions = normalizePermissionArray(parsed?.permissions)
    const role = normalizeRole(parsed?.role) ?? Role.OPERATOR
    const roles = normalizeRoles(parsed?.roles, role)
    parsed.role = role
    parsed.roles = roles
    return parsed as User
  } catch {
    return null
  }
}

function persistToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token)
  else localStorage.removeItem(TOKEN_STORAGE_KEY)
}
function readTokenFromStorage(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

function persistPermissions(permissions: Permission[] | null) {
  try {
    const normalized = normalizePermissionArray(permissions)
    if (normalized.length > 0) {
      localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(normalized))
    } else {
      localStorage.removeItem(PERMISSIONS_STORAGE_KEY)
    }
  } catch (err) {
    console.warn("[AuthProvider] persistPermissions falló", err)
  }
}

function readPermissionsFromStorage(): Permission[] {
  try {
    const raw = localStorage.getItem(PERMISSIONS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return normalizePermissionArray(parsed)
  } catch {
    return []
  }
}

function roleListToMap(list: RoleWithPermissions[] | null | undefined): Record<string, Permission[]> {
  if (!Array.isArray(list)) return {}
  return list.reduce<Record<string, Permission[]>>((acc, role) => {
    if (!role?.slug) return acc
    acc[role.slug] = normalizePermissionArray(role.permissions)
    return acc
  }, {})
}

const ADMIN_CAPABILITIES: Permission[] = ["manage_roles", "manage_settings"]

function arePermissionSetsEqual(a: Permission[] | null | undefined, b: Permission[] | null | undefined) {
  if (a === b) return true
  const listA = Array.isArray(a) ? Array.from(new Set(a)) : []
  const listB = Array.isArray(b) ? Array.from(new Set(b)) : []
  if (listA.length !== listB.length) return false
  const sortedA = [...listA].sort()
  const sortedB = [...listB].sort()
  return sortedA.every((permission, index) => permission === sortedB[index])
}

function areRolePermissionMapsEqual(
  a: Record<string, Permission[]> | null | undefined,
  b: Record<string, Permission[]> | null | undefined,
) {
  if (a === b) return true
  const mapA = a ?? {}
  const mapB = b ?? {}
  const keysA = Object.keys(mapA).sort()
  const keysB = Object.keys(mapB).sort()
  if (keysA.length !== keysB.length) return false
  if (!keysA.every((key, index) => key === keysB[index])) return false
  return keysA.every((key) => arePermissionSetsEqual(mapA[key], mapB[key]))
}

function hasAdminCapability(permissions: Permission[] | null | undefined) {
  if (!permissions || permissions.length === 0) return false
  return ADMIN_CAPABILITIES.some((capability) => permissions.includes(capability))
}

// --- Estado y reducer
type Action =
  | {
      type: "LOAD_FROM_STORAGE"
      payload: {
        user: User | null
        token: string | null
        permissions: Permission[]
        rolePermissions?: Record<string, Permission[]>
      }
    }
  | {
      type: "LOGIN_SUCCESS"
      payload: {
        user: User
        token: string | null
        permissions: Permission[]
        rolePermissions?: Record<string, Permission[]>
      }
    }
  | { type: "LOGOUT" }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_PERMISSIONS"; payload: Permission[] }
  | { type: "SET_ROLE_PERMISSIONS"; payload: Record<string, Permission[]> }

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
  token: null,
  permissions: [],
  rolePermissions: {},
}

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case "LOAD_FROM_STORAGE":
      return {
        ...state,
        isAuthenticated: !!action.payload.user,
        user: action.payload.user
          ? { ...action.payload.user, permissions: action.payload.permissions ?? [] }
          : null,
        token: action.payload.token ?? null,
        permissions: action.payload.permissions ?? [],
        rolePermissions: action.payload.rolePermissions ?? state.rolePermissions,
        isLoading: false,
        error: null,
      }
    case "LOGIN_SUCCESS":
      return {
        ...state,
        isAuthenticated: true,
        user: { ...action.payload.user, permissions: action.payload.permissions ?? [] },
        token: action.payload.token ?? null,
        permissions: action.payload.permissions ?? [],
        rolePermissions: action.payload.rolePermissions ?? state.rolePermissions,
        isLoading: false,
        error: null,
      }
    case "LOGOUT":
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        token: null,
        permissions: [],
        rolePermissions: {},
        error: null,
      }
    case "SET_LOADING":
      return { ...state, isLoading: action.payload }
    case "SET_ERROR":
      return { ...state, error: action.payload }
    case "SET_PERMISSIONS":
      return {
        ...state,
        permissions: action.payload,
        user: state.user ? { ...state.user, permissions: action.payload } : state.user,
      }
    case "SET_ROLE_PERMISSIONS":
      return { ...state, rolePermissions: action.payload }
    default:
      return state
  }
}

// --- Contexto
type AuthContextType = {
  state: AuthState
  login: (credentials: LoginCredentials) => Promise<User | null>
  logout: () => void
  hasPermission: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const pathname = usePathname()
  const lastAppliedTokenRef = useRef<string | null>(null)

  const fetchAclFromApi = async (
    fallbackPermissions: Permission[] = [],
  ): Promise<{ permissions: Permission[]; rolePermissions: Record<string, Permission[]> }> => {
    const normalizedFallback = normalizePermissionArray(fallbackPermissions)

    // 👇 Bypass total en rutas públicas
    if (isPublicPath(pathname)) {
      return { permissions: normalizedFallback, rolePermissions: {} }
    }

    if (!isApiMode()) {
      return { permissions: normalizedFallback, rolePermissions: {} }
    }
    try {
      const permissionsList = await apiClient.getCurrentUserPermissions()
      const normalizedFromApi = normalizePermissionArray(permissionsList)
      const permissions = normalizedFromApi.length > 0 ? normalizedFromApi : normalizedFallback
      const apiHasAdminCapability = hasAdminCapability(normalizedFromApi)
      const fallbackHasAdminCapability =
        normalizedFromApi.length === 0 && hasAdminCapability(normalizedFallback)
      const shouldFetchRolePermissions = apiHasAdminCapability || fallbackHasAdminCapability

      let rolePermissionsMap: Record<string, Permission[]> = {}
      if (shouldFetchRolePermissions) {
        try {
          const roleList = await apiClient.getRolesWithPermissions()
          rolePermissionsMap = roleListToMap(roleList)
        } catch (roleError) {
          if (roleError instanceof ApiError && (roleError.status === 401 || roleError.status === 403)) {
            console.warn(
              `[AuthProvider] rolesWithPermissions sin autorización (${roleError.status}), omitiendo catálogo de roles.`,
            )
          } else {
            throw roleError
          }
        }
      }

      return { permissions, rolePermissions: rolePermissionsMap }
    } catch (err) {
      console.error("[AuthProvider] No se pudo obtener permisos desde la API", err)
      return { permissions: normalizedFallback, rolePermissions: {} }
    }
  }

  // Hidratar al inicio / cuando cambia la ruta
  useEffect(() => {
    const storedUser = readUserFromStorage()
    const storedToken = readTokenFromStorage()
    const storedPermissionsRaw = storedUser?.permissions ?? readPermissionsFromStorage()
    const storedPermissions = normalizePermissionArray(storedPermissionsRaw)
    const isLoginRoute = pathname === "/login"

    // Si estoy en público → no cargar sesión ni pedir ACL (el efecto de token lo dejará en null)
    if (isPublicPath(pathname)) {
      dispatch({
        type: "LOAD_FROM_STORAGE",
        payload: { user: null, token: null, permissions: [], rolePermissions: {} },
      })
      return
    }

    if (DEMO_MODE && !storedUser && !isLoginRoute) {
      const admin = defaultUsers.find((u) => u.role === "ADMIN")!
      const permissions = demoRolePermissions[admin.role] ?? []
      const user: User = {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        active: admin.active,
        position: admin.position,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
        permissions,
      }
      const normalizedUser = persistUser(user) ?? user
      persistToken(null)
      persistPermissions(permissions)
      setAuthCookie(true, normalizedUser.role)
      dispatch({
        type: "LOAD_FROM_STORAGE",
        payload: { user: normalizedUser, token: null, permissions, rolePermissions: demoRolePermissions },
      })
      return
    }

    if (storedUser) {
      persistPermissions(storedPermissions)
      const updatedUser = persistUser({ ...storedUser, permissions: storedPermissions }) ?? {
        ...storedUser,
        permissions: storedPermissions,
      }
      setAuthCookie(true, updatedUser.role)
      dispatch({
        type: "LOAD_FROM_STORAGE",
        payload: {
          user: updatedUser,
          token: storedToken ?? null,
          permissions: storedPermissions,
          rolePermissions: DEMO_MODE ? demoRolePermissions : undefined,
        },
      })
    } else {
      setAuthCookie(false)
      persistPermissions(null)
      dispatch({
        type: "LOAD_FROM_STORAGE",
        payload: { user: null, token: null, permissions: [], rolePermissions: {} },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Token → apiClient (aplicar SIEMPRE que cambie, incluso durante isLoading)
  useEffect(() => {
    const desiredToken = isPublicPath(pathname)
      ? null
      : (state.token ?? readTokenFromStorage() ?? lastAppliedTokenRef.current ?? null)

    if (lastAppliedTokenRef.current !== desiredToken) {
      lastAppliedTokenRef.current = desiredToken
      apiClient.setAuthToken(desiredToken)
      if (typeof window !== "undefined") {
        console.log(
          "[AuthProvider] apiClient.setAuthToken:",
          isPublicPath(pathname) ? "(null-public)" : desiredToken ? "(presente)" : "(null)",
        )
      }
    }
  }, [state.token, pathname])

  // Login
  const login = async (credentials: LoginCredentials): Promise<User | null> => {
    dispatch({ type: "SET_LOADING", payload: true })
    dispatch({ type: "SET_ERROR", payload: null })
    try {
      if (DEMO_MODE) {
        const username = "username" in credentials ? credentials.username : credentials.email.split("@")[0]
        const found = defaultUsers.find((u) => u.username === username && u.password === credentials.password)
        if (!found) return null
        const permissions = demoRolePermissions[found.role] ?? []
        const user: User = {
          id: found.id,
          username: found.username,
          email: found.email,
          name: found.name,
          role: found.role,
          active: found.active,
          position: found.position,
          createdAt: found.createdAt,
          updatedAt: found.updatedAt,
          permissions,
        }
        const normalizedUser = persistUser(user) ?? user
        persistToken(null)
        persistPermissions(permissions)
        setAuthCookie(true, normalizedUser.role)
        dispatch({
          type: "LOGIN_SUCCESS",
          payload: { user: normalizedUser, token: null, permissions, rolePermissions: demoRolePermissions },
        })
        return normalizedUser
      }

      if (isApiMode()) {
        const username = "username" in credentials ? credentials.username : credentials.email.split("@")[0]
        const { token, user } = await apiClient.loginWithUsername(username, credentials.password)

        // 👇 APLICAR TOKEN INMEDIATAMENTE para que el fetch de ACL vaya autenticado
        apiClient.setAuthToken(token)

        const role = normalizeRole(user?.role) ?? Role.OPERATOR
        const roles = normalizeRoles(user?.roles, role)
        const normalizedUser: User = {
          ...user,
          role,
          roles,
          createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
          updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
        }

        setAuthCookie(true, normalizedUser.role)

        const initialPermissions = normalizePermissionArray(user?.permissions)
        const { permissions, rolePermissions } = await fetchAclFromApi(initialPermissions)

        const normalizedWithPermissions: User = { ...normalizedUser, permissions }
        const persistedUser = persistUser(normalizedWithPermissions) ?? normalizedWithPermissions
        persistToken(token)
        persistPermissions(permissions)

        // Guardamos en estado; el efecto de token ya lo dejó aplicado y lo seguirá manteniendo
        dispatch({
          type: "LOGIN_SUCCESS",
          payload: { user: persistedUser, token, permissions, rolePermissions },
        })
        return persistedUser
      }

      return null
    } catch (err: any) {
      dispatch({ type: "SET_ERROR", payload: err?.message ?? "No se pudo iniciar sesión" })
      return null
    } finally {
      dispatch({ type: "SET_LOADING", payload: false })
    }
  }

  // Logout
  const logout = () => {
    persistUser(null)
    persistToken(null)
    persistPermissions(null)
    // El efecto de token va a aplicar null; no lo llamamos directo aquí
    setAuthCookie(false)
    dispatch({ type: "LOGOUT" })
  }

  // Sincronización de permisos (solo si autenticado y NO público)
  useEffect(() => {
    if (!state.isAuthenticated || isPublicPath(pathname)) {
      if (!DEMO_MODE) {
        dispatch({ type: "SET_ROLE_PERMISSIONS", payload: {} })
      }
      return
    }

    if (DEMO_MODE) {
      const role = state.user?.role ?? null
      const permissions = role ? demoRolePermissions[role] ?? [] : []
      persistPermissions(permissions)
      dispatch({ type: "SET_PERMISSIONS", payload: permissions })
      dispatch({ type: "SET_ROLE_PERMISSIONS", payload: demoRolePermissions })
      if (state.user) persistUser({ ...state.user, permissions })
      return
    }

    if (!isApiMode()) return
    let cancelled = false

    const synchronize = async () => {
      const { permissions, rolePermissions } = await fetchAclFromApi(state.permissions)
      if (cancelled) return
      const nextPermissions = normalizePermissionArray(permissions)
      const nextRolePermissions = rolePermissions ?? {}

      const hasPermissionsChanged = !arePermissionSetsEqual(state.permissions, nextPermissions)
      const hasRolePermissionsChanged = !areRolePermissionMapsEqual(state.rolePermissions, nextRolePermissions)

      if (!hasPermissionsChanged && !hasRolePermissionsChanged) return

      persistPermissions(nextPermissions)
      dispatch({ type: "SET_PERMISSIONS", payload: nextPermissions })
      dispatch({ type: "SET_ROLE_PERMISSIONS", payload: nextRolePermissions })
      if (state.user) persistUser({ ...state.user, permissions: nextPermissions })
    }

    void synchronize()
    return () => {
      cancelled = true
    }
  }, [state.isAuthenticated, state.user?.role, state.token, pathname])

  const hasPermission = (permission: Permission) => {
    if (!state.isAuthenticated) return false
    return state.permissions.includes(permission)
  }

  return <AuthContext.Provider value={{ state, login, logout, hasPermission }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
