"use client"

import Link from "next/link"
import { useState, useEffect, useMemo, useCallback, useRef, type ChangeEvent } from "react"
import { DialogFooter } from "@/components/ui/dialog"
import { AuthGuard } from "@/components/auth-guard"
import { PermissionGuard } from "@/components/permission-guard"
import { useAuth } from "@/contexts/auth-context"
import { useServices } from "@/hooks/use-services"
import { useOperators, __USE_OPERATORS_VERSION } from "@/hooks/use-operators"
import { useQueue } from "@/contexts/queue-context"
import { useCustomMessages } from "@/hooks/use-custom-messages"
import { useSystemSettings } from "@/hooks/use-system-settings"
import { useToast } from "@/hooks/use-toast"
import type { CustomMessage, Permission } from "@/lib/types"
import { Role } from "@/lib/types"
import { hasPermission } from "@/lib/auth-utils"
import { SERVICE_ICON_OPTIONS, getServiceIcon } from "@/lib/service-icons"
import {
  apiClient,
  ApiError,
  type BackupStatus,
  type BackupDirectoryListing,
} from "@/lib/api-client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import {
  Plus,
  Save,
  AlertTriangle,
  Trash2,
  Edit,
  MessageSquare,
  MonitorSmartphone,
  Palette,
  Bell,
  ShieldCheck,
  Workflow,
  Loader2,
  RefreshCw,
  Link as LinkIcon,
  Mail,
  Folder,
  FolderOpen,
  FolderPlus,
  Clock,
  FileDown,
  LocateFixed,
  MapPin,
  ArrowLeft,
  ChevronRight,
  Database,
  Terminal,
  Printer,
} from "lucide-react"

// NUEVO: modal de cambio de contraseña
import ChangePasswordDialog from "@/components/operators/ChangePasswordDialog"

const SHOW_DEBUG_UI =
  (process.env.NEXT_PUBLIC_DEBUG_UI === "1") || process.env.NODE_ENV !== "production";

type SettingsFormState = {
  maxWaitTime: string
  autoCallNext: boolean
  soundEnabled: boolean
  displayTimeout: string
  mobileEnabled: boolean
  qrEnabled: boolean
  notificationsEnabled: boolean
  showWaitTimes: boolean
  kioskRequireDni: boolean
  kioskAllowSms: boolean
  kioskShowQueueStats: boolean
  kioskPrintingEnabled: boolean
  kioskWelcomeMessage: string
  kioskLocationName: string
  terminalPrintWebhookUrl: string
  terminalPrintWebhookToken: string
  signageTheme: string
  signageShowNews: boolean
  signageShowWeather: boolean
  signageShowWaitingList: boolean
  signageShowFlowSummary: boolean
  signageShowKeyIndicators: boolean
  signageCurrencySource: string
  signageIndicatorsRefreshMinutes: string
  alertsEscalationMinutes: string
  analyticsEmail: string
  webhookUrl: string
  backupEnabled: boolean
  backupDirectory: string
  backupMysqldumpPath: string
  backupTime: string
  brandDisplayName: string
  brandPrimaryColor: string
  brandSecondaryColor: string
  brandLogoUrl: string
  displayTitle: string
  displaySlogan: string
  signageWeatherLocation: string
  signageWeatherLatitude: string
  signageWeatherLongitude: string
}

const DEFAULT_SETTINGS_FORM: SettingsFormState = {
  maxWaitTime: "15",
  autoCallNext: false,
  soundEnabled: true,
  displayTimeout: "30",
  mobileEnabled: true,
  qrEnabled: true,
  notificationsEnabled: true,
  showWaitTimes: true,
  kioskRequireDni: false,
  kioskAllowSms: true,
  kioskShowQueueStats: true,
  kioskPrintingEnabled: false,
  kioskWelcomeMessage: "Bienvenido a DrizaTX. Sacá tu turno en segundos",
  kioskLocationName: "",
  terminalPrintWebhookUrl: "",
  terminalPrintWebhookToken: "",
  signageTheme: "corporate",
  signageShowNews: false,
  signageShowWeather: true,
  signageShowWaitingList: true,
  signageShowFlowSummary: true,
  signageShowKeyIndicators: true,
  signageCurrencySource: "oficial",
  signageIndicatorsRefreshMinutes: "5",
  alertsEscalationMinutes: "15",
  analyticsEmail: "reportes@drizatx.com",
  webhookUrl: "",
  backupEnabled: true,
  backupDirectory: "storage/backups",
  backupMysqldumpPath: "",
  backupTime: "02:00",
  brandDisplayName: "DrizaTx",
  brandPrimaryColor: "#0f172a",
  brandSecondaryColor: "#22d3ee",
  brandLogoUrl: "",
  displayTitle: "Centro de Atención al Cliente",
  displaySlogan: "Sistema de Gestión de Colas DrizaTx",
  signageWeatherLocation: "Buenos Aires, AR",
  signageWeatherLatitude: "-34.6037",
  signageWeatherLongitude: "-58.3816",
}

const SETTINGS_KEY_OVERRIDES: Partial<Record<keyof SettingsFormState, string>> = {
  backupEnabled: "backup.enabled",
  backupDirectory: "backup.directory",
  backupMysqldumpPath: "backup.mysqldumpPath",
  backupTime: "backup.time",
  terminalPrintWebhookUrl: "terminal.printWebhookUrl",
  terminalPrintWebhookToken: "terminal.printWebhookToken",
}

const NUMBER_FIELDS: Array<keyof SettingsFormState> = [
  "maxWaitTime",
  "displayTimeout",
  "signageIndicatorsRefreshMinutes",
  "alertsEscalationMinutes",
]

const BOOLEAN_FIELDS: Array<keyof SettingsFormState> = [
  "autoCallNext",
  "soundEnabled",
  "mobileEnabled",
  "qrEnabled",
  "notificationsEnabled",
  "showWaitTimes",
  "kioskRequireDni",
  "kioskAllowSms",
  "kioskShowQueueStats",
  "kioskPrintingEnabled",
  "signageShowNews",
  "signageShowWeather",
  "signageShowWaitingList",
  "signageShowFlowSummary",
  "signageShowKeyIndicators",
  "backupEnabled",
]

const SETTINGS_METADATA: Record<keyof SettingsFormState, { description: string | null }> = {
  maxWaitTime: { description: "Tiempo máximo de espera en minutos" },
  autoCallNext: { description: "Llamado automático del siguiente turno" },
  soundEnabled: { description: "Sonido habilitado para llamados" },
  displayTimeout: { description: "Tiempo de rotación de pantallas en segundos" },
  mobileEnabled: { description: "App móvil habilitada" },
  qrEnabled: { description: "Códigos QR habilitados" },
  notificationsEnabled: { description: "Notificaciones habilitadas" },
  showWaitTimes: { description: "Mostrar tiempos estimados de espera en pantallas y apps" },
  kioskRequireDni: { description: "Solicitar DNI obligatorio en terminales de autoservicio" },
  kioskAllowSms: { description: "Permitir registro de celular para notificaciones SMS" },
  kioskShowQueueStats: { description: "Mostrar métricas de espera en la terminal" },
  kioskPrintingEnabled: {
    description: "Habilitar impresión silenciosa directamente desde el navegador del kiosco",
  },
  kioskWelcomeMessage: { description: "Mensaje principal en la terminal de autoservicio" },
  kioskLocationName: { description: "Nombre de la sede que se imprime en el ticket" },
  terminalPrintWebhookUrl: { description: "Webhook para imprimir tickets desde la terminal" },
  terminalPrintWebhookToken: { description: "Token para autenticar el webhook de impresión" },
  signageTheme: { description: "Tema visual por defecto para pantallas y cartelería" },
  signageShowNews: { description: "Mostrar información para visitantes en las pantallas" },
  signageShowWeather: { description: "Mostrar pronóstico meteorológico en las pantallas" },
  signageShowWaitingList: { description: "Mostrar lista de espera de tickets en cartelería" },
  signageShowFlowSummary: { description: "Mostrar resumen de flujo en las pantallas de cartelería" },
  signageShowKeyIndicators: { description: "Mostrar indicadores clave en el panel lateral de cartelería" },
  signageCurrencySource: { description: "Fuente de cotizaciones para cartelería digital" },
  signageIndicatorsRefreshMinutes: {
    description: "Minutos entre actualizaciones de indicadores y cotizaciones",
  },
  alertsEscalationMinutes: { description: "Minutos para escalar una alerta de atención prolongada" },
  analyticsEmail: { description: "Casilla que recibe reportes automáticos" },
  webhookUrl: { description: "Webhook para integraciones externas" },
  backupEnabled: { description: "Habilitar respaldos automáticos diarios" },
  backupDirectory: { description: "Directorio en el servidor donde se guardan los respaldos" },
  backupMysqldumpPath: { description: "Ruta completa del ejecutable mysqldump en el servidor" },
  backupTime: { description: "Horario (HH:mm) para ejecutar el respaldo automático" },
  brandDisplayName: { description: "Nombre visible en las pantallas y aplicaciones" },
  brandPrimaryColor: { description: "Color primario para aplicaciones y pantallas" },
  brandSecondaryColor: { description: "Color secundario para elementos destacados" },
  brandLogoUrl: { description: "URL del logotipo institucional" },
  displayTitle: { description: "Título principal que se muestra en la cabecera de cartelería" },
  displaySlogan: { description: "Texto que se muestra en la cabecera de pantallas" },
  signageWeatherLocation: { description: "Ciudad o ubicación que se mostrará en el widget de clima" },
  signageWeatherLatitude: { description: "Latitud en grados decimales para obtener el clima" },
  signageWeatherLongitude: { description: "Longitud en grados decimales para obtener el clima" },
}

const sanitizeNumberString = (value: string, fallback: string) => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10)
  if (Number.isFinite(parsed) && parsed >= 0) return String(parsed)
  const fallbackParsed = Number.parseInt(String(fallback ?? "").trim(), 10)
  return Number.isFinite(fallbackParsed) && fallbackParsed >= 0 ? String(fallbackParsed) : "0"
}

type FileWithDirectoryInfo = File & {
  path?: string
  webkitRelativePath?: string
}

const getDirectoryPathFromFile = (file: FileWithDirectoryInfo): string | null => {
  const absolutePath = typeof file.path === "string" && file.path.trim().length > 0 ? file.path : null
  const relativePath =
    typeof file.webkitRelativePath === "string" && file.webkitRelativePath.trim().length > 0
      ? file.webkitRelativePath
      : null

  if (absolutePath) {
    const separator = absolutePath.includes("\\") && !absolutePath.includes("/") ? "\\" : "/"
    const normalizedAbsolute = absolutePath.replace(/[\\/]+/g, separator)

    if (relativePath) {
      const normalizedRelative = relativePath.replace(/[\\/]+/g, separator)
      if (normalizedRelative.length > 0 && normalizedAbsolute.endsWith(normalizedRelative)) {
        const base = normalizedAbsolute.slice(0, normalizedAbsolute.length - normalizedRelative.length)
        return base.replace(new RegExp(`${separator}+$`), "") || separator
      }
    }

    const lastSeparatorIndex = normalizedAbsolute.lastIndexOf(separator)
    if (lastSeparatorIndex >= 0) {
      return normalizedAbsolute.slice(0, lastSeparatorIndex)
    }

    return normalizedAbsolute
  }

  if (relativePath) {
    const normalizedRelative = relativePath.replace(/[\\/]+/g, "/")
    const segments = normalizedRelative.split("/").filter(Boolean)
    segments.pop()
    if (segments.length === 0) return null
    return segments.join("/")
  }

  return null
}

export default function AdminPage() {
  const { state: authState } = useAuth()

  const { services, createService, updateService, deleteService } = useServices({ requireAuth: true })
  const { operators, createOperator, updateOperator, deleteOperator, loading, error, refetch } = useOperators()

  const { state, isApiMode: queueApiMode } = useQueue()
  const { createMessage, deleteMessage, getActiveMessages, refetch: refetchMessages } = useCustomMessages()

  // Flag de admin para la UI (enum o string)
  const currentUserId = authState.user?.id ?? null
  const normalizedCurrentRole = (authState.user?.role ?? "").toString().toUpperCase()
  const isAdmin = normalizedCurrentRole === Role.ADMIN || normalizedCurrentRole === Role.SUPERADMIN
  const isSuperAdminUser = normalizedCurrentRole === Role.SUPERADMIN

  // ===== DEBUG: fetch crudo =====
  useEffect(() => {
    if (!SHOW_DEBUG_UI) return; // ⬅️ evita ejecutar en prod
    const BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
    const url = `${BASE}/api/operators`;
    fetch(url)
      .then((r) => r.text())
      .then((t) => {
        try {
          console.log("[AdminPage] operadores crudos:", JSON.parse(t));
        } catch {
          console.log("[AdminPage] operadores crudos (texto):", t);
        }
      })
      .catch((e) => console.error("[AdminPage] error fetch crudo /operators", e));
  }, []);

  const nativeDirectoryInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const input = nativeDirectoryInputRef.current
    if (!input) return
    input.setAttribute("webkitdirectory", "true")
    input.setAttribute("directory", "true")
    input.setAttribute("mozdirectory", "true")
    input.setAttribute("msdirectory", "true")
  }, [])

  // Estados para modales
  const [serviceModalOpen, setServiceModalOpen] = useState(false)
  const [operatorModalOpen, setOperatorModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<any>(null)
  const [editingOperator, setEditingOperator] = useState<any>(null)
  const [operatorRestrictionMessage, setOperatorRestrictionMessage] = useState<string | null>(null)

  const editingIsSuperAdmin = (editingOperator?.role ?? "").toString().toUpperCase() === Role.SUPERADMIN
  const editingIsSelf = editingOperator?.id != null && editingOperator.id === currentUserId

  const [serviceForm, setServiceForm] = useState({
    name: "",
    prefix: "",
    priority: "1",
    estimatedTime: "10",
    maxAttentionTime: "",
    active: true,
    icon: "none",
  })

  const SelectedServiceIcon = getServiceIcon(serviceForm.icon !== "none" ? serviceForm.icon : null)
  const DefaultServiceIcon = getServiceIcon(null)

  const [operatorForm, setOperatorForm] = useState({
    name: "",
    email: "",
    position: "",
    role: Role.OPERATOR,
    active: true,
    username: "",
    password: "",
  })

  const { toast } = useToast()

  const adminTabDefinitions = useMemo(
    () =>
      [
        { value: "services", label: "Servicios", permission: "manage_services" as Permission },
        { value: "operators", label: "Operadores", permission: "manage_operators" as Permission },
        { value: "displays", label: "Pantallas", permission: "manage_settings" as Permission },
        { value: "messages", label: "Mensajes", permission: "manage_settings" as Permission },
        { value: "settings", label: "Configuración", permission: "manage_settings" as Permission },
      ] as const,
    [],
  )

  const accessibleAdminTabs = useMemo(
    () => adminTabDefinitions.filter((tab) => hasPermission(authState.permissions, tab.permission)),
    [adminTabDefinitions, authState.permissions],
  )

  const [activeAdminTab, setActiveAdminTab] = useState<string>(
    accessibleAdminTabs[0]?.value ?? adminTabDefinitions[0].value,
  )

  useEffect(() => {
    if (accessibleAdminTabs.length === 0) return
    if (!accessibleAdminTabs.some((tab) => tab.value === activeAdminTab)) {
      setActiveAdminTab(accessibleAdminTabs[0].value)
    }
  }, [accessibleAdminTabs, activeAdminTab])

  const showOperatorValidationError = useCallback(
    (message: string) => {
      toast({
        title: "Revisa los datos del operador",
        description: message,
        variant: "destructive",
      })
    },
    [toast],
  )

  const showOperatorOperationError = useCallback(
    (message: string) => {
      toast({
        title: "Error al guardar el operador",
        description: message,
        variant: "destructive",
      })
    },
    [toast],
  )

  const showOperatorOperationSuccess = useCallback(
    (title: string, description?: string) => {
      toast({
        title,
        description,
      })
    },
    [toast],
  )

  // selección de servicios del operador
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([])
  const [operatorBeingDeletedId, setOperatorBeingDeletedId] = useState<number | null>(null)

  const DEFAULT_PROMOTION_DURATION = 30
  const MAX_PROMOTION_MEDIA_BYTES = 10 * 1024 * 1024
  const [customMessages, setCustomMessages] = useState<CustomMessage[]>([])
  const [newMessage, setNewMessage] = useState({
    title: "",
    content: "",
    type: "info" as CustomMessage["type"],
    priority: 1,
    startDate: "",
    endDate: "",
    mediaUrl: null as string | null,
    mediaType: null as string | null,
    displayDurationSeconds: DEFAULT_PROMOTION_DURATION,
    activeDays: [] as string[],
  })
  const [messageMediaError, setMessageMediaError] = useState<string | null>(null)
  const [messageMediaName, setMessageMediaName] = useState<string | null>(null)
  const dayOptions = useMemo(
    () => [
      { value: "mon", label: "Lunes" },
      { value: "tue", label: "Martes" },
      { value: "wed", label: "Miércoles" },
      { value: "thu", label: "Jueves" },
      { value: "fri", label: "Viernes" },
      { value: "sat", label: "Sábado" },
      { value: "sun", label: "Domingo" },
    ],
    [],
  )
  const [creatingMessage, setCreatingMessage] = useState(false)
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null)
  const [loadingBackupStatus, setLoadingBackupStatus] = useState(false)
  const [backupStatusError, setBackupStatusError] = useState<string | null>(null)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [detectingLocation, setDetectingLocation] = useState(false)
  const [directoryExplorerOpen, setDirectoryExplorerOpen] = useState(false)
  const [directoryExplorerLoading, setDirectoryExplorerLoading] = useState(false)
  const [directoryExplorerError, setDirectoryExplorerError] = useState<string | null>(null)
  const [directoryExplorerListing, setDirectoryExplorerListing] =
    useState<BackupDirectoryListing | null>(null)
  const [directoryExplorerPathInput, setDirectoryExplorerPathInput] = useState("")
  const [creatingExplorerDirectory, setCreatingExplorerDirectory] = useState(false)
  const [newDirectoryName, setNewDirectoryName] = useState("")

  const {
    settings,
    loading: settingsLoading,
    error: settingsError,
    bulkUpsert,
    refresh: refreshSettings,
  } = useSystemSettings()

  const notifyOperatorValidationError = useCallback(
    (message: string) => {
      toast({
        title: "Revisa los datos del operador",
        description: message,
        variant: "destructive",
      })
    },
    [toast],
  )

  const notifyOperatorOperationError = useCallback(
    (message: string) => {
      toast({
        title: "Error al guardar el operador",
        description: message,
        variant: "destructive",
      })
    },
    [toast],
  )

  const notifyOperatorOperationSuccess = useCallback(
    (title: string, description?: string) => {
      toast({
        title,
        description,
      })
    },
    [toast],
  )

  const refreshCustomMessages = useCallback(async () => {
    await refetchMessages()
    setCustomMessages(getActiveMessages())
  }, [getActiveMessages, refetchMessages])

  const [settingsForm, setSettingsForm] = useState<SettingsFormState>(DEFAULT_SETTINGS_FORM)
  const [dirtySettings, setDirtySettings] = useState<Set<keyof SettingsFormState>>(new Set())
  const [savingSettings, setSavingSettings] = useState(false)

  const refreshBackupStatus = useCallback(async () => {
    if (!queueApiMode) {
      setBackupStatus(null)
      setBackupStatusError(null)
      setLoadingBackupStatus(false)
      return
    }

    try {
      setLoadingBackupStatus(true)
      setBackupStatusError(null)
      const status = await apiClient.getBackupStatus()
      setBackupStatus(status)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "No se pudo obtener el estado de los respaldos"
      setBackupStatusError(message)
    } finally {
      setLoadingBackupStatus(false)
    }
  }, [queueApiMode])

  const hasDirtySettings = dirtySettings.size > 0
  const disableSettingsForm = savingSettings || (settingsLoading && settings.length === 0)
  const previewCurrentTime = useMemo(() => new Date(), [])

  const signageThemePreview = useMemo(() => {
    const primary = (settingsForm.brandPrimaryColor || DEFAULT_SETTINGS_FORM.brandPrimaryColor).trim() ||
      DEFAULT_SETTINGS_FORM.brandPrimaryColor
    const secondary = (settingsForm.brandSecondaryColor || DEFAULT_SETTINGS_FORM.brandSecondaryColor).trim() ||
      DEFAULT_SETTINGS_FORM.brandSecondaryColor

    if (settingsForm.signageTheme === "contrast") {
      return {
        background: `linear-gradient(135deg, ${primary}, ${secondary})`,
        cardBackground: "rgba(255,255,255,0.12)",
        textColor: "#f8fafc",
        mutedText: "rgba(226,232,240,0.85)",
        accentColor: secondary,
        accentText: primary,
      }
    }

    if (settingsForm.signageTheme === "minimal") {
      return {
        background: "#ffffff",
        cardBackground: "#f8fafc",
        textColor: "#0f172a",
        mutedText: "#475569",
        accentColor: secondary,
        accentText: "#0f172a",
      }
    }

    return {
      background: `linear-gradient(135deg, ${primary}1a, ${secondary}20)`,
      cardBackground: "rgba(255,255,255,0.92)",
      textColor: "#0f172a",
      mutedText: "#475569",
      accentColor: secondary,
      accentText: "#0f172a",
    }
  }, [
    settingsForm.brandPrimaryColor,
    settingsForm.brandSecondaryColor,
    settingsForm.signageTheme,
  ])

  const indicatorsRefreshMinutes = useMemo(() => {
    const raw = String(
      settingsForm.signageIndicatorsRefreshMinutes ||
        DEFAULT_SETTINGS_FORM.signageIndicatorsRefreshMinutes,
    ).trim()
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
    const fallback = Number.parseInt(DEFAULT_SETTINGS_FORM.signageIndicatorsRefreshMinutes, 10)
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 5
  }, [settingsForm.signageIndicatorsRefreshMinutes])

  const previewBrandName =
    (settingsForm.brandDisplayName || DEFAULT_SETTINGS_FORM.brandDisplayName).trim() ||
    DEFAULT_SETTINGS_FORM.brandDisplayName
  const previewInitials = useMemo(
    () =>
      previewBrandName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((segment) => segment.charAt(0).toUpperCase())
        .join("") || "DT",
    [previewBrandName],
  )

  const lastSettingsUpdate = useMemo(() => {
    if (!settings || settings.length === 0) return null
    return settings.reduce<Date | null>((latest, item) => {
      const value = item.updatedAt instanceof Date ? item.updatedAt : new Date(item.updatedAt)
      if (!latest) return value
      return value > latest ? value : latest
    }, null)
  }, [settings])

  const formatDateTime = useCallback((value: string | null | undefined) => {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
  }, [])

  const formatBytes = useCallback((size?: number | null) => {
    if (size === null || size === undefined || Number.isNaN(size)) return "—"
    if (size < 1024) return `${size} B`
    const kb = size / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    const mb = kb / 1024
    if (mb < 1024) return `${mb.toFixed(1)} MB`
    const gb = mb / 1024
    return `${gb.toFixed(2)} GB`
  }, [])

  const lastBackupLocation = useMemo(() => {
    const configured = settingsForm.backupDirectory?.trim()
    if (!queueApiMode) {
      return configured || DEFAULT_SETTINGS_FORM.backupDirectory
    }
    return (
      backupStatus?.lastDirectory?.trim() ||
      backupStatus?.resolvedDirectory ||
      configured ||
      DEFAULT_SETTINGS_FORM.backupDirectory
    )
  }, [backupStatus, queueApiMode, settingsForm.backupDirectory])

  const buildChildDirectoryPath = useCallback((parent: string, child: string) => {
    const sanitizedChild = child.replace(/[\\/]+/g, "").trim()
    if (!sanitizedChild) return parent

    const base = parent?.trim() ?? ""
    if (!base) return sanitizedChild

    const usesBackslash = base.includes("\\") && !base.includes("/")
    const separator = usesBackslash ? "\\" : "/"
    const needsSeparator = !base.endsWith("/") && !base.endsWith("\\")

    return `${needsSeparator ? `${base}${separator}` : base}${sanitizedChild}`
  }, [])

  const loadDirectoryListing = useCallback(
    async (target?: string | null) => {
      const trimmedTarget = target?.trim()
      setDirectoryExplorerLoading(true)
      setDirectoryExplorerError(null)
      if (trimmedTarget) {
        setDirectoryExplorerPathInput(trimmedTarget)
      }

      try {
        const listing = await apiClient.listBackupDirectories(trimmedTarget || undefined)
        setDirectoryExplorerListing(listing)
        setDirectoryExplorerPathInput(listing.path)
      } catch (error) {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "No se pudo explorar el directorio seleccionado."
        setDirectoryExplorerError(message)
      } finally {
        setDirectoryExplorerLoading(false)
      }
    },
    [],
  )

  const handleDirectoryExplorerOpenChange = useCallback((open: boolean) => {
    setDirectoryExplorerOpen(open)
    if (!open) {
      setDirectoryExplorerListing(null)
      setDirectoryExplorerError(null)
      setDirectoryExplorerPathInput("")
      setNewDirectoryName("")
      setCreatingExplorerDirectory(false)
      setDirectoryExplorerLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!directoryExplorerOpen) return
    const initialTarget = settingsForm.backupDirectory.trim()
    void loadDirectoryListing(initialTarget || undefined)
  }, [directoryExplorerOpen, loadDirectoryListing, settingsForm.backupDirectory])

  const handleNavigateToDirectory = useCallback(
    (nextPath: string) => {
      if (!nextPath) return
      void loadDirectoryListing(nextPath)
    },
    [loadDirectoryListing],
  )

  const handleDirectoryPathSubmit = useCallback(
    async (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault()
      const target = directoryExplorerPathInput.trim()
      await loadDirectoryListing(target || directoryExplorerListing?.path)
    },
    [directoryExplorerPathInput, loadDirectoryListing, directoryExplorerListing],
  )

  const handleGoToParentDirectory = useCallback(() => {
    if (!directoryExplorerListing?.parent) return
    void loadDirectoryListing(directoryExplorerListing.parent)
  }, [directoryExplorerListing, loadDirectoryListing])

  const updateSettingField = <K extends keyof SettingsFormState>(
    key: K,
    value: SettingsFormState[K],
  ) => {
    setSettingsForm((prev) => {
      if (prev[key] === value) return prev
      return { ...prev, [key]: value }
    })
    setDirtySettings((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  const handleSelectCurrentDirectory = useCallback(() => {
    if (!directoryExplorerListing) return
    updateSettingField("backupDirectory", directoryExplorerListing.path)
    toast({
      title: "Carpeta seleccionada",
      description: `Guardaremos los respaldos automáticos en "${directoryExplorerListing.path}".`,
    })
    handleDirectoryExplorerOpenChange(false)
  }, [
    directoryExplorerListing,
    handleDirectoryExplorerOpenChange,
    toast,
    updateSettingField,
  ])

  const handleCreateDirectory = useCallback(async () => {
    if (!directoryExplorerListing) return
    const name = newDirectoryName.trim()
    if (!name) {
      toast({
        title: "Nombre requerido",
        description: "Escribe un nombre para la nueva carpeta.",
        variant: "destructive",
      })
      return
    }

    const safeName = name.replace(/[\\/:*?"<>|]/g, "").trim()
    if (!safeName) {
      toast({
        title: "Nombre inválido",
        description: "La carpeta no puede contener caracteres especiales.",
        variant: "destructive",
      })
      return
    }

    const candidatePath = buildChildDirectoryPath(directoryExplorerListing.path, safeName)
    setCreatingExplorerDirectory(true)
    setDirectoryExplorerError(null)

    try {
      await apiClient.createBackupDirectory(candidatePath)
      toast({
        title: "Carpeta creada",
        description: `Creamos "${safeName}" dentro de la ubicación seleccionada.`,
      })
      setNewDirectoryName("")
      await loadDirectoryListing(candidatePath)
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "No se pudo crear la carpeta."
      setDirectoryExplorerError(message)
      toast({
        title: "No se pudo crear la carpeta",
        description: message,
        variant: "destructive",
      })
    } finally {
      setCreatingExplorerDirectory(false)
    }
  }, [
    apiClient,
    buildChildDirectoryPath,
    directoryExplorerListing,
    loadDirectoryListing,
    newDirectoryName,
    toast,
  ])

  const handleNativeDirectoryInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { files } = event.target
      if (!files || files.length === 0) {
        event.target.value = ""
        return
      }

      const [firstFile] = Array.from(files) as FileWithDirectoryInfo[]
      const directoryPath = getDirectoryPathFromFile(firstFile)

      event.target.value = ""

      if (directoryPath) {
        updateSettingField("backupDirectory", directoryPath)
        toast({
          title: "Carpeta seleccionada",
          description: `Guardaremos los respaldos en "${directoryPath}".`,
        })
        return
      }

      toast({
        title: "No se pudo detectar la ruta",
        description:
          "No pudimos obtener la ruta completa de la carpeta seleccionada. Usaremos el explorador manual.",
        variant: "destructive",
      })
      handleDirectoryExplorerOpenChange(true)
    },
    [handleDirectoryExplorerOpenChange, toast, updateSettingField],
  )

  const triggerNativeDirectorySelection = useCallback(() => {
    const input = nativeDirectoryInputRef.current
    if (!input) return false
    input.value = ""
    input.click()
    return true
  }, [])

  const handleRequestBackupDirectory = useCallback(() => {
    const triggered = triggerNativeDirectorySelection()
    if (!triggered) {
      handleDirectoryExplorerOpenChange(true)
    }
  }, [handleDirectoryExplorerOpenChange, triggerNativeDirectorySelection])

  const handleUseCurrentLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast({
        title: "Ubicación no disponible",
        description: "Tu navegador no tiene soporte para geolocalización.",
        variant: "destructive",
      })
      return
    }

    setDetectingLocation(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDetectingLocation(false)
        const lat = position.coords.latitude
        const lon = position.coords.longitude
        const latString = lat.toFixed(4)
        const lonString = lon.toFixed(4)
        updateSettingField("signageWeatherLatitude", latString)
        updateSettingField("signageWeatherLongitude", lonString)
        updateSettingField(
          "signageWeatherLocation",
          `Ubicación actual (${lat.toFixed(2)}, ${lon.toFixed(2)})`,
        )
        toast({
          title: "Ubicación detectada",
          description: "Actualizamos las coordenadas para el widget de clima.",
        })
      },
      (error) => {
        setDetectingLocation(false)
        let description = "No se pudo obtener tu ubicación."
        if (error.code === error.PERMISSION_DENIED) {
          description = "Necesitamos permiso para acceder a tu ubicación."
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          description = "La señal de ubicación no está disponible en este momento."
        } else if (error.code === error.TIMEOUT) {
          description = "La solicitud de ubicación tardó demasiado."
        }
        toast({
          title: "No se pudo detectar la ubicación",
          description,
          variant: "destructive",
        })
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [toast, updateSettingField])

  const handleResetBranding = () => {
    const keys: Array<keyof SettingsFormState> = [
      "brandDisplayName",
      "brandPrimaryColor",
      "brandSecondaryColor",
      "brandLogoUrl",
      "signageTheme",
      "displayTitle",
      "displaySlogan",
      "signageWeatherLocation",
      "signageWeatherLatitude",
      "signageWeatherLongitude",
    ]
    setSettingsForm((prev) => {
      const next = { ...prev }
      keys.forEach((key) => {
        next[key] = DEFAULT_SETTINGS_FORM[key]
      })
      return next
    })
    setDirtySettings((prev) => {
      const next = new Set(prev)
      keys.forEach((key) => next.add(key))
      return next
    })
  }

  const handleResetKiosk = () => {
    const keys: Array<keyof SettingsFormState> = [
      "kioskRequireDni",
      "kioskAllowSms",
      "kioskShowQueueStats",
      "kioskPrintingEnabled",
      "kioskWelcomeMessage",
      "kioskLocationName",
      "terminalPrintWebhookUrl",
      "terminalPrintWebhookToken",
    ]
    setSettingsForm((prev) => {
      const next = { ...prev }
      keys.forEach((key) => {
        next[key] = DEFAULT_SETTINGS_FORM[key]
      })
      return next
    })
    setDirtySettings((prev) => {
      const next = new Set(prev)
      keys.forEach((key) => next.add(key))
      return next
    })
  }

  const handleCreateBackup = async () => {
    if (creatingBackup) return
    setCreatingBackup(true)
    try {
      if (queueApiMode) {
        const payload = settingsForm.backupDirectory.trim()
          ? { directory: settingsForm.backupDirectory.trim() }
          : undefined

        const result = await apiClient.triggerBackup(payload)
        const downloadPath = result.downloadPath ?? `/api/backups/files/${encodeURIComponent(result.fileName)}`
        const blob = await apiClient.download(downloadPath)
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = result.fileName || `backup-drizatx-${new Date().toISOString().split("T")[0]}.tar.gz`
        anchor.click()
        URL.revokeObjectURL(url)

        try {
          await refreshSettings()
        } catch (err) {
          console.warn("[AdminPage] No se pudo actualizar la configuración tras el respaldo", err)
        }
        await refreshBackupStatus()

        toast({
          title: "Respaldo generado",
          description: `Iniciamos la descarga del archivo. También quedó disponible en ${result.directory}.`,
        })
      } else {
        const data = JSON.stringify(state, null, 2)
        const blob = new Blob([data], { type: "application/json" })
        const fileName = `backup-drizatx-${new Date().toISOString().split("T")[0]}.json`

        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = fileName
        anchor.click()
        URL.revokeObjectURL(url)
        toast({
          title: "Respaldo generado",
          description: "El navegador descargará el archivo para que elijas dónde guardarlo.",
        })
        await refreshBackupStatus()
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "No se pudo generar el respaldo"
      toast({
        title: "Error al generar respaldo",
        description: message,
        variant: "destructive",
      })
    } finally {
      setCreatingBackup(false)
    }
  }

  useEffect(() => {
    setSettingsForm((prev) => {
      const next = { ...prev }
      let changed = false
      const settingsMap = new Map(settings.map((item) => [item.key, item.value]))

      ;(Object.keys(DEFAULT_SETTINGS_FORM) as Array<keyof SettingsFormState>).forEach((key) => {
        if (dirtySettings.has(key)) return
        const fallback = DEFAULT_SETTINGS_FORM[key]
        const resolvedKey = SETTINGS_KEY_OVERRIDES[key] ?? key
        let rawValue = settingsMap.get(resolvedKey)
        if (rawValue === undefined && resolvedKey !== key) {
          rawValue = settingsMap.get(key)
        }

        if (BOOLEAN_FIELDS.includes(key)) {
          const normalized = String(rawValue ?? fallback)
            .trim()
            .toLowerCase()
          const computed = ["true", "1", "yes", "si", "sí", "on"].includes(normalized)
          if (next[key] !== computed) {
            ;(next as any)[key] = computed
            changed = true
          }
          return
        }

        if (NUMBER_FIELDS.includes(key)) {
          const computed = sanitizeNumberString(String(rawValue ?? fallback), fallback as string)
          if (next[key] !== computed) {
            ;(next as any)[key] = computed
            changed = true
          }
          return
        }

        const computed =
          rawValue === undefined || rawValue === null ? fallback : String(rawValue)
        if (next[key] !== computed) {
          ;(next as any)[key] = computed
          changed = true
        }
      })

      return changed ? next : prev
    })
  }, [settings, dirtySettings])

  const handleDiscardSettings = () => {
    if (!hasDirtySettings) return
    setDirtySettings(new Set())
    toast({
      title: "Cambios descartados",
      description: "Restauramos los valores sincronizados desde el servidor.",
    })
  }

  const handleSaveSettings = async () => {
    if (!hasDirtySettings) return
    setSavingSettings(true)
    try {
      const entries = Array.from(dirtySettings).map((key) => {
        let serialized: string
        if (BOOLEAN_FIELDS.includes(key)) {
          serialized = (settingsForm[key] as boolean) ? "true" : "false"
        } else if (NUMBER_FIELDS.includes(key)) {
          serialized = sanitizeNumberString(String(settingsForm[key]), DEFAULT_SETTINGS_FORM[key] as string)
        } else {
          serialized = String(settingsForm[key] ?? "")
        }

        const description = SETTINGS_METADATA[key]?.description ?? null
        const resolvedKey = SETTINGS_KEY_OVERRIDES[key] ?? key

        return {
          key: String(resolvedKey),
          value: serialized,
          description,
        }
      })

      await bulkUpsert(entries)
      setDirtySettings(new Set())
      try {
        await refreshSettings()
        await refreshBackupStatus()
      } catch (refreshError) {
        console.warn("[AdminPage] No se pudo sincronizar la configuración luego de guardar", refreshError)
      }
      toast({ title: "Configuración guardada", description: "Los cambios se aplicaron correctamente." })
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar la configuración"
      toast({
        title: "Error al guardar",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSavingSettings(false)
    }
  }

  // ====== Servicios ======
  const resetServiceForm = () => {
    setServiceForm({
      name: "",
      prefix: "",
      priority: "1",
      estimatedTime: "10",
      maxAttentionTime: "",
      active: true,
      icon: "none",
    })
    setEditingService(null)
  }

  const handleEditService = (service: any) => {
    setEditingService(service)
    setServiceForm({
      name: service.name ?? "",
      prefix: service.prefix ?? "",
      priority: String(service.priority ?? "1"),
      estimatedTime: String(service.estimatedTime ?? "10"),
      maxAttentionTime: service.maxAttentionTime ? String(service.maxAttentionTime) : "",
      active: !!service.active,
      icon: service.icon ? String(service.icon).trim().toLowerCase() : "none",
    })
    setServiceModalOpen(true)
  }

  const handleCreateService = async () => {
    const name = serviceForm.name.trim()
    const prefix = serviceForm.prefix.trim().toUpperCase()
    if (!name || !prefix) return
    const p = Number.parseInt(serviceForm.priority, 10)
    const t = Number.parseInt(serviceForm.estimatedTime, 10)
    const rawMax = serviceForm.maxAttentionTime.trim()
    const parsedMax = Number.parseInt(rawMax, 10)
    const priority = Number.isFinite(p) ? Math.min(6, Math.max(1, p)) : 1
    const estimatedTime = Number.isFinite(t) ? Math.max(1, t) : 10
    const icon = serviceForm.icon && serviceForm.icon !== "none" ? serviceForm.icon.toLowerCase() : null
    const maxAttentionTime =
      rawMax === ""
        ? null
        : Number.isFinite(parsedMax) && parsedMax > 0
          ? parsedMax
          : null
    try {
      await createService({
        name,
        prefix,
        priority,
        estimatedTime,
        maxAttentionTime: maxAttentionTime ?? undefined,
        active: !!serviceForm.active,
        icon,
      })
      resetServiceForm()
      setServiceModalOpen(false)
      toast({
        title: "Servicio creado",
        description: `El servicio "${name}" se creó correctamente.`,
      })
    } catch (error) {
      const description =
        error instanceof Error && error.message?.trim()
          ? error.message
          : "No se pudo crear el servicio. Inténtalo nuevamente."
      toast({
        title: "Error al crear servicio",
        description,
        variant: "destructive",
      })
    }
  }

  const handleUpdateService = async () => {
    if (!editingService) return
    const name = serviceForm.name.trim()
    const prefix = serviceForm.prefix.trim().toUpperCase()
    if (!name || !prefix) return
    const p = Number.parseInt(serviceForm.priority, 10)
    const t = Number.parseInt(serviceForm.estimatedTime, 10)
    const rawMax = serviceForm.maxAttentionTime.trim()
    const parsedMax = Number.parseInt(rawMax, 10)
    const priority = Number.isFinite(p) ? Math.min(6, Math.max(1, p)) : 1
    const estimatedTime = Number.isFinite(t) ? Math.max(1, t) : 10
    const icon = serviceForm.icon && serviceForm.icon !== "none" ? serviceForm.icon.toLowerCase() : null
    const maxAttentionTime =
      rawMax === ""
        ? null
        : Number.isFinite(parsedMax) && parsedMax > 0
          ? parsedMax
          : null
    try {
      await updateService(editingService.id, {
        name,
        prefix,
        priority,
        estimatedTime,
        maxAttentionTime,
        active: !!serviceForm.active,
        icon,
      })
      resetServiceForm()
      setServiceModalOpen(false)
      toast({
        title: "Servicio actualizado",
        description: `Los cambios para "${name}" se guardaron correctamente.`,
      })
    } catch (error) {
      const description =
        error instanceof Error && error.message?.trim()
          ? error.message
          : "No se pudo actualizar el servicio. Inténtalo nuevamente."
      toast({
        title: "Error al actualizar servicio",
        description,
        variant: "destructive",
      })
    }
  }

  const handleDeleteService = async (id: number) => {
    const rawRole = authState.user?.role
    const normalizedRole = typeof rawRole === "string" ? rawRole.toUpperCase() : rawRole
    if (normalizedRole !== Role.ADMIN && normalizedRole !== Role.SUPERADMIN) {
      toast({
        title: "Acción no permitida",
        description: "No tenés permisos para eliminar servicios.",
        variant: "destructive",
      })
      return
    }
    try {
      await deleteService(id)
      toast({
        title: "Servicio eliminado",
        description: "El servicio se eliminó correctamente.",
      })
    } catch (error) {
      const description =
        error instanceof Error && error.message?.trim()
          ? error.message
          : "No se pudo eliminar el servicio. Inténtalo nuevamente."
      toast({
        title: "Error al eliminar servicio",
        description,
        variant: "destructive",
      })
    }
  }

  // ====== Operadores ======
  const resetOperatorForm = () => {
    setOperatorForm({
      name: "",
      email: "",
      position: "",
      role: Role.OPERATOR,
      active: true,
      username: "",
      password: "",
    })
    setSelectedServiceIds([])
    setEditingOperator(null)
    setOperatorRestrictionMessage(null)
  }

  const toggleServiceForOperator = (id: number) => {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleCreateOperator = async () => {
    const { name, email, position, role, active, username, password } = operatorForm
    if (!name?.trim()) {
      showOperatorValidationError("El nombre es requerido")
      return
    }
    if (!email?.trim()) {
      showOperatorValidationError("El email es requerido")
      return
    }
    if (!username?.trim() || username.trim().length < 3) {
      showOperatorValidationError("El usuario debe tener al menos 3 caracteres")
      return
    }
    if (!password?.trim() || password.trim().length < 4) {
      showOperatorValidationError("La contraseña debe tener al menos 4 caracteres")
      return
    }

    const payload: any = {
      name: name.trim(),
      email: email.trim(),
      position: position?.trim() || "",
      role: (role as any) ?? "OPERATOR",
      active: !!active,
      username: username.trim(),
      password: password.trim(), // SOLO en creación
      serviceIds: selectedServiceIds,
    }

    try {
      await createOperator(payload as any)
      resetOperatorForm()
      setOperatorModalOpen(false)
      refetch()
      notifyOperatorOperationSuccess("Operador creado", `${payload.name} ya puede utilizar el sistema.`)
    } catch (e: any) {
      console.error("[handleCreateOperator] Error", e)
      const message =
        e?.response?.data?.message || e?.message || "No se pudo crear el operador. Revisá consola/Network."
      notifyOperatorOperationError(message)
    }
  }

  const handleEditOperator = async (operator: any) => {
    const targetRole = (operator?.role ?? "").toString().toUpperCase()
    if (targetRole === Role.SUPERADMIN && operator?.id !== currentUserId) {
      const description = "No puedes editar una cuenta SuperAdmin que no sea la tuya."
      setOperatorRestrictionMessage(description)
      toast({
        title: "Acción no permitida",
        description,
        variant: "destructive",
      })
      return
    }
    setOperatorRestrictionMessage(null)
    setEditingOperator(operator)
    setOperatorForm({
      name: operator.name,
      email: operator.email,
      position: operator.position || "",
      role: operator.role,
      active: operator.active,
      username: operator.username || "",
      password: "", // ya no se edita aquí
    })

    try {
      const data = await apiClient.getOperatorServices(operator.id)
      const ids: number[] = Array.isArray(data?.services) ? data.services.map((s: any) => Number(s.id)) : []
      setSelectedServiceIds(ids)
    } catch (error) {
      console.error("[handleEditOperator] No se pudieron cargar los servicios del operador", error)
      setSelectedServiceIds([])
    }
    setOperatorModalOpen(true)
  }

  const handleUpdateOperator = async () => {
    if (!editingOperator) return
    const { name, email, position, role, active, username } = operatorForm

    if (!name?.trim()) {
      notifyOperatorValidationError("El nombre es requerido")
      return
    }
    if (!email?.trim()) {
      notifyOperatorValidationError("El email es requerido")
      return
    }
    if (!username?.trim() || username.trim().length < 3) {
      notifyOperatorValidationError("El usuario debe tener al menos 3 caracteres")
      return
    }

    const payload: any = {
      name: name?.trim(),
      email: email?.trim(),
      position: position?.trim() || "",
      role: (role as any) ?? "OPERATOR",
      active: !!active,
      username: username?.trim(),
      serviceIds: selectedServiceIds,
      // IMPORTANTE: NO enviar password en update. El cambio es por endpoint dedicado (ADMIN).
    }

    try {
      await updateOperator(editingOperator.id, payload)
      resetOperatorForm()
      setOperatorModalOpen(false)
      refetch()
      notifyOperatorOperationSuccess("Operador actualizado", `${payload.name} se actualizó correctamente.`)
    } catch (e: any) {
      console.error("[handleUpdateOperator] Error", e)
      const message = e?.response?.data?.message || e?.message || "No se pudo actualizar el operador"
      notifyOperatorOperationError(message)
    }
  }

  const handleDeleteOperator = async (operator: any) => {
    const operatorId = Number(operator?.id)
    if (!Number.isFinite(operatorId)) {
      notifyOperatorOperationError("No se pudo identificar al operador para eliminarlo.")
      return
    }

    const operatorRole = (operator?.role ?? "").toString().toUpperCase()
    const isSelf = currentUserId != null && operatorId === currentUserId
    const isSuperAdmin = operatorRole === Role.SUPERADMIN

    if (isSelf) {
      notifyOperatorOperationError("No podés eliminar tu propia cuenta.")
      return
    }

    if (isSuperAdmin) {
      notifyOperatorOperationError("No podés eliminar una cuenta Super Admin.")
      return
    }

    try {
      setOperatorBeingDeletedId(operatorId)
      await deleteOperator(operatorId)
      await refetch()
      notifyOperatorOperationSuccess(
        "Operador eliminado",
        `${operator?.name ?? "El operador"} fue eliminado correctamente.`,
      )
    } catch (error: any) {
      console.error("[handleDeleteOperator] Error", error)
      const message = error?.response?.data?.message || error?.message || "No se pudo eliminar el operador"
      notifyOperatorOperationError(message)
    } finally {
      setOperatorBeingDeletedId(null)
    }
  }

  // ====== Mensajes ======
  const handleCreateMessage = async () => {
    setCreatingMessage(true)
    try {
      const safePriority = Math.min(6, Math.max(1, Number.isFinite(newMessage.priority) ? newMessage.priority : 1))
      const normalizedDuration = Number.isFinite(Number(newMessage.displayDurationSeconds))
        ? Math.max(5, Number(newMessage.displayDurationSeconds))
        : null
      const normalizedDays = (newMessage.activeDays || []).filter(Boolean)
      const created = await createMessage({
        title: newMessage.title,
        content: newMessage.content,
        type: newMessage.type,
        active: true,
        priority: safePriority,
        startDate: newMessage.startDate ? new Date(newMessage.startDate) : null,
        endDate: newMessage.endDate ? new Date(newMessage.endDate) : null,
        mediaUrl: newMessage.mediaUrl ?? null,
        mediaType: newMessage.mediaType ?? null,
        displayDurationSeconds: normalizedDuration,
        activeDays: normalizedDays.length ? normalizedDays : null,
      })
      await refreshCustomMessages()
      setNewMessage({
        title: "",
        content: "",
        type: "info",
        priority: 1,
        startDate: "",
        endDate: "",
        mediaUrl: null,
        mediaType: null,
        displayDurationSeconds: DEFAULT_PROMOTION_DURATION,
        activeDays: [],
      })
      setMessageMediaName(null)
      setMessageMediaError(null)
      toast({
        title: "Mensaje creado con éxito",
        description: created.title ? `"${created.title}" ya está visible para los visitantes.` : undefined,
      })
    } catch (error) {
      const description =
        error instanceof Error && error.message?.trim()
          ? error.message
          : "No se pudo crear el mensaje. Inténtalo nuevamente."
      toast({
        title: "Error al crear mensaje",
        description,
        variant: "destructive",
      })
    } finally {
      setCreatingMessage(false)
    }
  }

  useEffect(() => {
    setCustomMessages(getActiveMessages())
  }, [getActiveMessages])

  const formatMessageDate = useCallback((value?: string | Date | null) => {
    if (!value) return null
    const parsed = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed.toLocaleDateString()
  }, [])

  const toggleActiveDay = useCallback((value: string) => {
    setNewMessage((prev) => {
      const current = new Set(prev.activeDays ?? [])
      if (current.has(value)) {
        current.delete(value)
      } else {
        current.add(value)
      }
      return { ...prev, activeDays: Array.from(current) }
    })
  }, [])

  const readFileAsDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"))
      reader.readAsDataURL(file)
    })
  }, [])

  const validateVideoDuration = useCallback((file: File) => {
    return new Promise<void>((resolve, reject) => {
      const video = document.createElement("video")
      video.preload = "metadata"
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src)
        if (video.duration > 60) {
          reject(new Error("El video debe durar 1 minuto o menos"))
          return
        }
        resolve()
      }
      video.onerror = () => reject(new Error("No se pudo validar la duración del video"))
      video.src = URL.createObjectURL(file)
    })
  }, [])

  const clearPromotionMedia = useCallback(() => {
    setNewMessage((prev) => ({ ...prev, mediaUrl: null, mediaType: null }))
    setMessageMediaName(null)
    setMessageMediaError(null)
  }, [])

  const handlePromotionMediaUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      setMessageMediaError(null)
      if (!file) return

      const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "image/gif", "video/mp4"]
      if (!allowedTypes.includes(file.type)) {
        setMessageMediaError("Formato no soportado. Usa GIF, JPG, PNG o video MP4")
        event.target.value = ""
        return
      }

      if (file.size > MAX_PROMOTION_MEDIA_BYTES) {
        setMessageMediaError("El archivo supera el límite de 10 MB")
        event.target.value = ""
        return
      }

      if (file.type === "video/mp4") {
        try {
          await validateVideoDuration(file)
        } catch (error: any) {
          setMessageMediaError(error?.message ?? "El video excede el tiempo permitido")
          event.target.value = ""
          return
        }
      }

      try {
        const dataUrl = await readFileAsDataUrl(file)
        setNewMessage((prev) => ({ ...prev, mediaUrl: dataUrl, mediaType: file.type }))
        setMessageMediaName(file.name)
      } catch (error: any) {
        setMessageMediaError(error?.message ?? "No se pudo procesar el archivo")
      } finally {
        event.target.value = ""
      }
    },
    [readFileAsDataUrl, validateVideoDuration],
  )

  useEffect(() => {
    if (!operatorRestrictionMessage) return
    const timeout = window.setTimeout(() => setOperatorRestrictionMessage(null), 6000)
    return () => window.clearTimeout(timeout)
  }, [operatorRestrictionMessage])

  useEffect(() => {
    void refreshBackupStatus()
  }, [refreshBackupStatus])

  return (
    <div className="flex-1 space-y-6">
      <AuthGuard>
        <input
          ref={nativeDirectoryInputRef}
          type="file"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          multiple
          onChange={handleNativeDirectoryInputChange}
        />
        <Dialog open={directoryExplorerOpen} onOpenChange={handleDirectoryExplorerOpenChange}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Seleccioná la carpeta de respaldos</DialogTitle>
              <DialogDescription>
                Navega por las carpetas del servidor para elegir dónde se guardarán los respaldos automáticos.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm font-mono break-all">
                {directoryExplorerListing?.path || directoryExplorerPathInput || "—"}
              </div>

              <form
                onSubmit={(event) => void handleDirectoryPathSubmit(event)}
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
              >
                <Input
                  value={directoryExplorerPathInput}
                  onChange={(event) => setDirectoryExplorerPathInput(event.target.value)}
                  placeholder="Escribe una ruta absoluta (por ejemplo C:\\Respaldo)"
                  className="flex-1"
                  autoFocus
                />
                <div className="flex gap-2 sm:flex-shrink-0">
                  <Button type="submit" disabled={directoryExplorerLoading}>
                    {directoryExplorerLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Ir
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoToParentDirectory}
                    disabled={!directoryExplorerListing?.parent || directoryExplorerLoading}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Subir
                  </Button>
                </div>
              </form>

              {directoryExplorerError && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{directoryExplorerError}</AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border">
                {directoryExplorerLoading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <div className="max-h-64 divide-y overflow-y-auto">
                    {directoryExplorerListing?.entries?.length ? (
                      directoryExplorerListing.entries.map((entry) => (
                        <button
                          key={entry.path}
                          type="button"
                          onClick={() => handleNavigateToDirectory(entry.path)}
                          className="flex w-full flex-col gap-1 px-3 py-2 text-left transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-primary" />
                            <span className="font-medium">{entry.name}</span>
                            <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                          </span>
                          <span className="text-xs text-muted-foreground break-all">{entry.path}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-6 text-sm text-muted-foreground">
                        Esta carpeta no contiene subcarpetas. Puedes crear una nueva con el formulario inferior.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="new-backup-directory">Crear una nueva carpeta aquí</Label>
                  <Input
                    id="new-backup-directory"
                    value={newDirectoryName}
                    onChange={(event) => setNewDirectoryName(event.target.value)}
                    placeholder="Nombre de la nueva carpeta"
                    disabled={directoryExplorerLoading}
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => void handleCreateDirectory()}
                  disabled={
                    creatingExplorerDirectory || directoryExplorerLoading || !directoryExplorerListing
                  }
                  className="flex items-center gap-2"
                >
                  {creatingExplorerDirectory ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderPlus className="h-4 w-4" />
                  )}
                  Crear carpeta
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                onClick={handleSelectCurrentDirectory}
                disabled={!directoryExplorerListing || directoryExplorerLoading}
              >
                Seleccionar esta carpeta
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="max-w-7xl mx-auto">
         {SHOW_DEBUG_UI && (
  <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-2 mb-2 glass">
    hook: {__USE_OPERATORS_VERSION} · operadores: {operators.length} · loading: {String(loading)} · error: {error ?? "—"}
    <Button
      variant="outline"
      size="sm"
      className="ml-2 hover:bg-accent hover:text-accent-foreground"
      onClick={() => refetch()}
    >
      Refrescar
    </Button>
  </div>
)}

          {/* Encabezado */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Panel de Administración
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Configuración del sistema y gestión de usuarios</p>
            </div>
            <div className="flex gap-2">
              <PermissionGuard permission="manage_settings">
                <Button
                  className="btn-premium"
                  onClick={handleSaveSettings}
                  disabled={!hasDirtySettings || savingSettings}
                >
                  {savingSettings ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {savingSettings ? "Guardando..." : hasDirtySettings ? "Guardar Cambios" : "Sin cambios"}
                </Button>
              </PermissionGuard>
            </div>
          </div>

          <Tabs value={activeAdminTab} onValueChange={setActiveAdminTab} className="space-y-6">
            <TabsList className="grid grid-cols-5 w-full max-w-2xl bg-card/50 backdrop-blur-sm border border-border rounded-xl">
              {accessibleAdminTabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {accessibleAdminTabs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                No tenés permisos para acceder a las secciones administrativas.
              </div>
            ) : null}

            {/* ======= TAB: Servicios ======= */}
            <PermissionGuard permission="manage_services">
              <TabsContent value="services" className="space-y-6">
                <Card className="group relative p-6 border-2 border-border/60 dark:border-border/40 shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden glass card-elev-2"
                      style={{ background: "var(--card)" }}>
                  {/* overlay sutil */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                       style={{ background: "var(--gradient-3)" }}>
                    <div className="absolute inset-0 bg-card/85 dark:bg-card/80" />
                  </div>

                  <CardHeader className="relative z-10">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Gestión de Servicios</CardTitle>
                        <CardDescription>Configura los tipos de atención disponibles</CardDescription>
                      </div>

                      <Dialog open={serviceModalOpen} onOpenChange={setServiceModalOpen}>
                        <DialogTrigger asChild>
                          <Button onClick={resetServiceForm} className="bg-gradient-to-r from-accent to-primary hover:from-accent/90 hover:to-primary/90 text-white shadow-lg">
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Servicio
                          </Button>
                        </DialogTrigger>

                        <DialogContent className="glass card-elev-3">
                          <DialogHeader>
                            <DialogTitle>{editingService ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
                            <DialogDescription>
                              {editingService ? "Modifica los datos del servicio" : "Completa los datos del nuevo servicio"}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="name" className="text-right">Nombre</Label>
                              <Input id="name" value={serviceForm.name} onChange={(e) => setServiceForm((p) => ({ ...p, name: e.target.value }))} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="prefix" className="text-right">Prefijo</Label>
                              <Input id="prefix" value={serviceForm.prefix} onChange={(e) => setServiceForm((p) => ({ ...p, prefix: e.target.value.toUpperCase() }))} className="col-span-3" maxLength={10} />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="icon" className="text-right">Icono</Label>
                              <Select value={serviceForm.icon} onValueChange={(value) => setServiceForm((p) => ({ ...p, icon: value }))}>
                                <SelectTrigger className="col-span-3 justify-between">
                                  <div className="flex items-center gap-2">
                                    <SelectedServiceIcon className="h-4 w-4 text-primary" />
                                    <SelectValue placeholder="Sin icono" />
                                  </div>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    <span className="flex items-center gap-2">
                                      <DefaultServiceIcon className="h-4 w-4" />
                                      <span>Sin icono</span>
                                    </span>
                                  </SelectItem>
                                  {SERVICE_ICON_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      <span className="flex items-center gap-2">
                                        <option.icon className="h-4 w-4" />
                                        <span>{option.label}</span>
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="priority" className="text-right">Prioridad</Label>
                              <Input
                                id="priority"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={6}
                                value={serviceForm.priority}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === "") return setServiceForm((p) => ({ ...p, priority: "" as any }))
                                  const n = Number.parseInt(v, 10)
                                  const next = Number.isFinite(n) ? Math.min(6, Math.max(1, n)) : ""
                                  setServiceForm((p) => ({ ...p, priority: String(next) }))
                                }}
                                className="col-span-3"
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="estimatedTime" className="text-right">Tiempo Est. (min)</Label>
                              <Input
                                id="estimatedTime"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={serviceForm.estimatedTime}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === "") return setServiceForm((p) => ({ ...p, estimatedTime: "" as any }))
                                  const n = Number.parseInt(v, 10)
                                  const next = Number.isFinite(n) ? Math.max(1, n) : ""
                                  setServiceForm((p) => ({ ...p, estimatedTime: String(next) }))
                                }}
                                className="col-span-3"
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="maxAttentionTime" className="text-right">Tiempo Máx. (min)</Label>
                              <Input
                                id="maxAttentionTime"
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={serviceForm.maxAttentionTime}
                                onChange={(e) => {
                                  const v = e.target.value
                                  if (v === "") return setServiceForm((p) => ({ ...p, maxAttentionTime: "" }))
                                  const n = Number.parseInt(v, 10)
                                  const next = Number.isFinite(n) && n > 0 ? String(n) : ""
                                  setServiceForm((p) => ({ ...p, maxAttentionTime: next }))
                                }}
                                placeholder="Sin límite"
                                className="col-span-3"
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="active" className="text-right">Activo</Label>
                              <Switch id="active" checked={serviceForm.active} onCheckedChange={(checked) => setServiceForm((p) => ({ ...p, active: checked }))} className="data-[state=checked]:bg-primary" />
                            </div>
                          </div>

                          <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setServiceModalOpen(false)}>Cancelar</Button>
                            <Button
                              type="button"
                              className="btn-premium"
                              onClick={async () => {
                                try {
                                  editingService ? await handleUpdateService() : await handleCreateService()
                                } catch (e) {
                                  console.error("[UI] Error en crear/actualizar:", e)
                                  const message =
                                    e instanceof Error && e.message?.trim()
                                      ? e.message
                                      : String((e as any)?.message ?? "Ocurrió un error inesperado")
                                  toast({
                                    title: "Error al guardar servicio",
                                    description: message,
                                    variant: "destructive",
                                  })
                                }
                              }}
                            >
                              {editingService ? "Actualizar" : "Crear"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>

                  <CardContent className="relative z-10">
                    <div className="space-y-4">
                      {services.map((service) => {
                        const ServiceIconComponent = getServiceIcon(service.icon)
                        return (
                          <div
                            key={service.id}
                            className="p-6 rounded-xl border border-border/30 bg-card/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] flex items-center justify-between"
                          >
                            <div className="flex items-center gap-6">
                              <Switch
                                checked={!!service.active}
                                onCheckedChange={(checked) => updateService(service.id, { active: checked })}
                                className="data-[state=checked]:bg-primary"
                              />
                              <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                  <ServiceIconComponent className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                  <h3 className="text-lg font-semibold text-card-foreground">{service.name}</h3>
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                    <span>
                                      Prefijo: <span className="text-primary font-medium">{service.prefix}</span>
                                    </span>
                                    <span className="text-border">|</span>
                                    <span>
                                      Prioridad: <span className="text-primary font-medium">{service.priority}</span>
                                    </span>
                                    <span className="text-border">|</span>
                                    <span>
                                      Tiempo: <span className="text-primary font-medium">{service.estimatedTime}</span> min
                                    </span>
                                    <span className="text-border">|</span>
                                    <span>
                                      Máx: <span className="text-primary font-medium">{service.maxAttentionTime ?? "—"}</span> {service.maxAttentionTime ? "min" : ""}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={service.active ? "default" : "secondary"}
                              className={service.active ? "bg-gradient-to-r from-primary to-accent text-white" : "bg-muted text-muted-foreground"}
                            >
                              {service.active ? "Activo" : "Inactivo"}
                            </Badge>

                            <Button size="sm" variant="ghost" className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary" onClick={() => handleEditService(service)}>
                              <Edit className="w-4 h-4" />
                            </Button>

                            <Button size="sm" variant="ghost" className="h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteService(service.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </PermissionGuard>

            {/* ======= TAB: Operadores ======= */}
            <PermissionGuard permission="manage_operators">
              <TabsContent value="operators" className="space-y-6">
                <Card className="group relative p-6 border-2 border-border/60 dark:border-border/40 shadow-xl hover:shadow-2xl transition-all duration-500 overflow-hidden glass card-elev-2"
                      style={{ background: "var(--card)" }}>
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                       style={{ background: "var(--gradient-1)" }}>
                    <div className="absolute inset-0 bg-card/85 dark:bg-card/80" />
                  </div>

                  <CardHeader className="relative z-10">
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Gestión de Operadores</CardTitle>
                        <CardDescription>Administra usuarios y permisos del sistema</CardDescription>
                      </div>
                      <Dialog open={operatorModalOpen} onOpenChange={setOperatorModalOpen}>
                        <DialogTrigger asChild>
                          <Button onClick={resetOperatorForm} className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white shadow-lg">
                            <Plus className="h-4 w-4 mr-2" />
                            Nuevo Operador
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="glass card-elev-3">
                          <DialogHeader>
                            <DialogTitle>{editingOperator ? "Editar Operador" : "Nuevo Operador"}</DialogTitle>
                            <DialogDescription>
                              {editingOperator ? "Modifica los datos del operador" : "Completa los datos del nuevo operador"}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="operatorName" className="text-right">Nombre</Label>
                              <Input id="operatorName" value={operatorForm.name} onChange={(e) => setOperatorForm((p) => ({ ...p, name: e.target.value }))} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="email" className="text-right">Email</Label>
                              <Input id="email" type="email" value={operatorForm.email} onChange={(e) => setOperatorForm((p) => ({ ...p, email: e.target.value }))} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="username" className="text-right">Usuario</Label>
                              <Input id="username" value={operatorForm.username} onChange={(e) => setOperatorForm((p) => ({ ...p, username: e.target.value }))} className="col-span-3" />
                            </div>

                            {/* CONTRASEÑA: SOLO en creación */}
                            {!editingOperator && (
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="password" className="text-right">Contraseña</Label>
                                <Input id="password" type="password" value={operatorForm.password} onChange={(e) => setOperatorForm((p) => ({ ...p, password: e.target.value }))} className="col-span-3" />
                              </div>
                            )}

                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="position" className="text-right">Posición</Label>
                              <Input id="position" value={operatorForm.position} onChange={(e) => setOperatorForm((p) => ({ ...p, position: e.target.value }))} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="role" className="text-right">Rol</Label>
                              <Select value={operatorForm.role} onValueChange={(value) => setOperatorForm((p) => ({ ...p, role: value as Role }))}>
                                <SelectTrigger className="col-span-3">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={Role.OPERATOR}>Operador</SelectItem>
                                  <SelectItem value={Role.SUPERVISOR}>Supervisor</SelectItem>
                                  <SelectItem value={Role.ADMIN}>Administrador</SelectItem>
                                  <SelectItem value={Role.SUPERADMIN} disabled={!isSuperAdminUser}>
                                    Super Admin
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="operatorActive" className="text-right">Activo</Label>
                              <Switch
                                id="operatorActive"
                                checked={operatorForm.active}
                                onCheckedChange={(checked) => setOperatorForm((p) => ({ ...p, active: checked }))}
                                disabled={editingIsSuperAdmin && !editingIsSelf}
                                className="data-[state=checked]:bg-primary"
                              />
                            </div>

                            {/* Servicios habilitados para el operador */}
                            <div className="grid grid-cols-4 items-start gap-4">
                              <Label className="text-right pt-2">Servicios</Label>
                              <div className="col-span-3 space-y-2">
                                <div className="text-xs text-muted-foreground">Seleccioná los servicios que podrá atender este operador.</div>
                                {services.filter((s) => s.active).length === 0 ? (
                                  <div className="text-sm text-muted-foreground">No hay servicios activos.</div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {services
                                      .filter((s) => s.active)
                                      .map((svc) => (
                                        <label key={svc.id} className="flex items-center gap-2 border border-border rounded-md px-3 py-2 bg-card/50 hover:bg-muted/40 transition">
                                          <input
                                            type="checkbox"
                                            checked={selectedServiceIds.includes(svc.id)}
                                            onChange={() => toggleServiceForOperator(svc.id)}
                                          />
                                          <span className="text-sm">
                                            {svc.name} <span className="text-xs text-muted-foreground">({svc.prefix})</span>
                                          </span>
                                        </label>
                                      ))}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground">
                                  Seleccionados: <strong>{selectedServiceIds.length}</strong>
                                </div>
                              </div>
                            </div>

                            {/* Botón de cambio de password dentro del modal de edición */}
                            {editingOperator && isAdmin && (
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Contraseña</Label>
                                <div className="col-span-3">
                                  <ChangePasswordDialog
                                    operatorId={editingOperator.id}
                                    onChanged={() => refetch()}
                                    disabled={editingIsSuperAdmin && !editingIsSelf}
                                  />
                                  <p className="text-xs text-muted-foreground mt-2">
                                    La contraseña se cambia en un flujo separado y solo está disponible para Administradores.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          <DialogFooter>
                            <Button variant="outline" onClick={() => setOperatorModalOpen(false)}>Cancelar</Button>
                            <Button className="btn-premium" onClick={editingOperator ? handleUpdateOperator : handleCreateOperator}>
                              {editingOperator ? "Actualizar" : "Crear"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>

                  <CardContent className="relative z-10 space-y-4">
                    {operatorRestrictionMessage ? (
                      <Alert variant="destructive">
                        <AlertTitle>Acción no permitida</AlertTitle>
                        <AlertDescription>{operatorRestrictionMessage}</AlertDescription>
                      </Alert>
                    ) : null}
                    {loading && <div className="text-sm text-muted-foreground">Cargando operadores…</div>}
                    {!loading && error && (
                      <div className="text-sm text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {error}
                        <Button size="sm" variant="outline" className="ml-2 hover:bg-accent hover:text-accent-foreground" onClick={() => refetch()}>
                          Reintentar
                        </Button>
                      </div>
                    )}
                    {!loading && !error && operators.length === 0 && (
                      <div className="text-sm text-muted-foreground">No hay operadores para mostrar.</div>
                    )}

                    <div className="space-y-4">
                      {operators.map((operator) => {
                        const operatorRole = (operator.role ?? "").toString().toUpperCase()
                        const operatorIsSuperAdmin = operatorRole === Role.SUPERADMIN
                        const isSelf = currentUserId != null && operator.id === currentUserId
                        const canMutateOperator = !operatorIsSuperAdmin || isSelf
                        const canDeleteOperator = canMutateOperator && !isSelf

                        return (
                          <div
                            key={operator.id}
                            className="flex items-center justify-between p-4 border border-border rounded-lg bg-card/60 hover:bg-muted/40 transition"
                          >
                            <div className="flex items-center gap-4">
                              {canMutateOperator ? (
                                <Switch
                                  checked={operator.active}
                                  onCheckedChange={(checked) => {
                                    updateOperator(operator.id, { active: checked })
                                  }}
                                  className="data-[state=checked]:bg-primary"
                                />
                              ) : (
                                <ShieldCheck className="h-5 w-5 text-muted-foreground" aria-hidden />
                              )}
                              <div>
                                <h3 className="font-medium text-foreground">{operator.name}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {operator.email} {operator.position ? ` | ${operator.position}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  operatorRole === Role.SUPERADMIN
                                    ? "destructive"
                                    : operatorRole === Role.ADMIN || operatorRole === Role.SUPERVISOR
                                      ? "default"
                                      : "secondary"
                                }
                              >
                                {operatorRole === Role.SUPERADMIN
                                  ? "Super Admin"
                                  : operatorRole === Role.ADMIN
                                    ? "Admin"
                                    : operatorRole === Role.SUPERVISOR
                                      ? "Supervisor"
                                      : "Operador"}
                              </Badge>
                              <Badge variant={operator.active ? "default" : "secondary"}>
                                {operator.active ? "Activo" : "Inactivo"}
                              </Badge>

                              {/* Botón editar */}
                              {canMutateOperator && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleEditOperator(operator)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}

                              {/* Cambiar contraseña (solo ADMIN) */}
                              {isAdmin && canMutateOperator && (
                                <ChangePasswordDialog
                                  operatorId={operator.id}
                                  onChanged={() => refetch()}
                                />
                              )}

                              {canDeleteOperator && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive"
                                      disabled={operatorBeingDeletedId === operator.id}
                                    >
                                      {operatorBeingDeletedId === operator.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent className="glass card-elev-3">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Eliminar operador</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción eliminará la cuenta de <strong>{operator.name}</strong> y quitará sus
                                        asignaciones de servicio. No podrás revertirla.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => void handleDeleteOperator(operator)}
                                        disabled={operatorBeingDeletedId === operator.id}
                                      >
                                        {operatorBeingDeletedId === operator.id ? (
                                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </PermissionGuard>

            {/* ======= TAB: Displays ======= */}
            <PermissionGuard permission="manage_settings">
              <TabsContent value="displays" className="space-y-6">
                <Card className="glass card-elev-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MonitorSmartphone className="h-5 w-5" />
                      Configuración de Pantallas
                    </CardTitle>
                    <CardDescription>Gestiona la cartelería digital y displays</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="display-timeout">Tiempo de rotación (segundos)</Label>
                          <Input
                            id="display-timeout"
                            type="number"
                            inputMode="numeric"
                            min={5}
                            value={settingsForm.displayTimeout}
                            onChange={(e) => {
                              const sanitized = e.target.value.replace(/[^0-9]/g, "")
                              updateSettingField("displayTimeout", sanitized)
                            }}
                            disabled={disableSettingsForm}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="display-show-wait">Mostrar tiempos de espera</Label>
                          <Switch
                            id="display-show-wait"
                            checked={settingsForm.showWaitTimes}
                            onCheckedChange={(checked) => updateSettingField("showWaitTimes", checked)}
                            className="data-[state=checked]:bg-primary"
                            disabled={disableSettingsForm}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <Label htmlFor="display-news">Habilitar mensajes/promociones en Display</Label>
                            <p className="text-xs text-muted-foreground">
                              Controla la sección pública con banners, GIFs o videos.
                            </p>
                          </div>
                          <Switch
                            id="display-news"
                            checked={settingsForm.signageShowNews}
                            onCheckedChange={(checked) => updateSettingField("signageShowNews", checked)}
                            className="data-[state=checked]:bg-primary"
                            disabled={disableSettingsForm}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label htmlFor="display-weather">Mostrar clima</Label>
                          <Switch
                            id="display-weather"
                            checked={settingsForm.signageShowWeather}
                            onCheckedChange={(checked) => updateSettingField("signageShowWeather", checked)}
                            className="data-[state=checked]:bg-primary"
                            disabled={disableSettingsForm}
                          />
                        </div>

                        <div>
                          <Label htmlFor="display-currency">Fuente de cotizaciones</Label>
                          <Select
                            value={settingsForm.signageCurrencySource}
                            onValueChange={(value) => updateSettingField("signageCurrencySource", value)}
                            disabled={disableSettingsForm}
                          >
                            <SelectTrigger id="display-currency">
                              <SelectValue placeholder="Seleccionar fuente" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="oficial">Dólar oficial (BCRA)</SelectItem>
                              <SelectItem value="blue">Dólar blue</SelectItem>
                              <SelectItem value="crypto">Promedio cripto</SelectItem>
                            </SelectContent>
                          </Select>
                          <div className="mt-3">
                            <Label htmlFor="display-indicators-refresh">Intervalo de actualización (minutos)</Label>
                            <Input
                              id="display-indicators-refresh"
                              type="number"
                              inputMode="numeric"
                              min={1}
                              value={settingsForm.signageIndicatorsRefreshMinutes}
                              onChange={(e) => {
                                const sanitized = e.target.value.replace(/[^0-9]/g, "")
                                updateSettingField("signageIndicatorsRefreshMinutes", sanitized)
                              }}
                              disabled={disableSettingsForm}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Las cotizaciones se consultan en vivo desde DolarAPI.com cada
                            {" "}
                            {indicatorsRefreshMinutes === 1
                              ? "minuto"
                              : `${indicatorsRefreshMinutes} minutos`}.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <Label>Vista previa en vivo</Label>
                          <div
                            className="mt-3 rounded-2xl border border-border shadow-inner overflow-hidden transition-all"
                            style={{
                              background: signageThemePreview.background,
                              color: signageThemePreview.textColor,
                            }}
                          >
                            <div className="p-4 sm:p-6 space-y-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg"
                                  style={{
                                    background: signageThemePreview.accentColor,
                                    color: signageThemePreview.accentText,
                                  }}
                                >
                                  {previewInitials}
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-lg font-semibold leading-tight">
                                    {previewBrandName}
                                  </span>
                                  <span
                                    className="text-sm"
                                    style={{ color: signageThemePreview.mutedText }}
                                  >
                                    {settingsForm.displayTitle || DEFAULT_SETTINGS_FORM.displayTitle}
                                  </span>
                                </div>
                              </div>
                              <p
                                className="text-sm leading-relaxed"
                                style={{ color: signageThemePreview.mutedText }}
                              >
                                {settingsForm.displaySlogan || DEFAULT_SETTINGS_FORM.displaySlogan}
                              </p>
                              <div
                                className="rounded-xl border border-white/20 p-3 space-y-2 shadow-sm"
                                style={{
                                  background: signageThemePreview.cardBackground,
                                  color: signageThemePreview.textColor,
                                }}
                              >
                                <div className="flex items-center justify-between text-sm font-medium">
                                  <span>
                                    {settingsForm.signageWeatherLocation ||
                                      DEFAULT_SETTINGS_FORM.signageWeatherLocation}
                                  </span>
                                  <span>{previewCurrentTime.toLocaleTimeString()}</span>
                                </div>
                                <div
                                  className="flex items-center justify-between text-xs uppercase tracking-wide"
                                  style={{ color: signageThemePreview.mutedText }}
                                >
                                  <span>Rotación {settingsForm.displayTimeout || DEFAULT_SETTINGS_FORM.displayTimeout}s</span>
                                  <span>Tema: {settingsForm.signageTheme}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          La vista previa refleja la identidad visual y la configuración activa de las pantallas.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </PermissionGuard>

            {/* ======= TAB: Mensajes ======= */}
            <PermissionGuard permission="manage_settings">
              <TabsContent value="messages" className="space-y-6">
                <Card className="glass card-elev-2">
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Mensajes Personalizados</CardTitle>
                        <CardDescription>Gestiona promociones, avisos y anuncios para la cartelería</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Formulario para crear mensaje */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Crear Nuevo Mensaje</h3>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="message-title">Título</Label>
                          <Input
                            id="message-title"
                              value={newMessage.title}
                              onChange={(e) => setNewMessage({ ...newMessage, title: e.target.value })}
                              placeholder="Título del mensaje"
                            />
                          </div>
                          <div>
                            <Label htmlFor="message-content">Contenido</Label>
                            <textarea
                              id="message-content"
                              className="w-full p-2 border border-border rounded-md bg-background"
                              rows={3}
                              value={newMessage.content}
                              onChange={(e) => setNewMessage({ ...newMessage, content: e.target.value })}
                              placeholder="Contenido del mensaje"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="message-type">Tipo</Label>
                              <select
                                id="message-type"
                                className="w-full p-2 border border-border rounded-md bg-background"
                                value={newMessage.type}
                                onChange={(e) =>
                                  setNewMessage({ ...newMessage, type: e.target.value as CustomMessage["type"] })
                                }
                              >
                                <option value="info">Información</option>
                                <option value="warning">Advertencia</option>
                                <option value="promotion">Promoción</option>
                                <option value="announcement">Anuncio</option>
                              </select>
                            </div>
                            <div>
                              <Label htmlFor="message-priority">Prioridad (1–6)</Label>
                                <Input
                                  id="message-priority"
                                  type="number"
                                  min="1"
                                  max="6"
                                value={newMessage.priority}
                                onChange={(e) =>
                                  setNewMessage({
                                    ...newMessage,
                                    priority: Math.min(6, Number.parseInt(e.target.value) || 1),
                                  })
                                }
                              />
                              <p className="mt-1 text-xs text-muted-foreground">
                                Define la prioridad del mensaje, donde 1 es la más baja y 5 la más alta.
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="message-start">Fecha de inicio (opcional)</Label>
                              <Input
                                id="message-start"
                                type="datetime-local"
                                value={newMessage.startDate}
                                onChange={(e) => setNewMessage({ ...newMessage, startDate: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor="message-end">Fecha de finalización (opcional)</Label>
                              <Input
                                id="message-end"
                                type="datetime-local"
                                value={newMessage.endDate}
                                onChange={(e) => setNewMessage({ ...newMessage, endDate: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label htmlFor="message-duration">Duración en pantalla (segundos)</Label>
                              <Input
                                id="message-duration"
                                type="number"
                                min={5}
                                max={300}
                                value={newMessage.displayDurationSeconds ?? ""}
                                onChange={(e) => {
                                  const sanitized = e.target.value.replace(/[^0-9]/g, "")
                                  setNewMessage({
                                    ...newMessage,
                                    displayDurationSeconds:
                                      sanitized === "" ? DEFAULT_PROMOTION_DURATION : Number(sanitized),
                                  })
                                }}
                              />
                              <p className="mt-1 text-xs text-muted-foreground">
                                Las promociones rotan durante este tiempo antes de pasar a la siguiente.
                              </p>
                            </div>
                            <div>
                              <Label>Días de publicación</Label>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {dayOptions.map((day) => {
                                  const active = newMessage.activeDays?.includes(day.value)
                                  return (
                                    <button
                                      key={day.value}
                                      type="button"
                                      onClick={() => toggleActiveDay(day.value)}
                                      className={`rounded-full border px-3 py-1 text-xs transition hover:border-primary hover:text-primary ${active ? "border-primary bg-primary/10" : "border-border"}`}
                                    >
                                      {day.label}
                                    </button>
                                  )
                                })}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Si no seleccionas días, la promoción se mostrará toda la semana.
                              </p>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="message-media">Archivo multimedia</Label>
                            <Input
                              id="message-media"
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/gif,video/mp4"
                              onChange={handlePromotionMediaUpload}
                            />
                            {messageMediaError && (
                              <p className="mt-1 text-xs text-destructive">{messageMediaError}</p>
                            )}
                            {newMessage.mediaUrl ? (
                              <div className="mt-2 flex items-center justify-between rounded-md border border-border bg-muted/40 p-2">
                                <div className="text-xs">
                                  <p className="font-semibold">{messageMediaName ?? "Archivo listo"}</p>
                                  <p className="text-muted-foreground">{newMessage.mediaType ?? "Formato detectado"}</p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={clearPromotionMedia}>
                                  Quitar
                                </Button>
                              </div>
                            ) : (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Formatos: GIF, JPG, PNG o MP4 (máximo 1 minuto).
                              </p>
                            )}
                          </div>
                          <Button
                            onClick={handleCreateMessage}
                            className="w-full btn-premium"
                            disabled={creatingMessage}
                          >
                            {creatingMessage ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4 mr-2" />
                            )}
                            {creatingMessage ? "Creando..." : "Crear Mensaje"}
                          </Button>
                        </div>
                      </div>

                      {/* Lista de mensajes activos */}
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Mensajes Activos</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                          {customMessages.map((message) => (
                            <div
                              key={message.id}
                            className={[
                              "p-4 border rounded-lg",
                              message.type === "promotion"
                                ? "border-accent bg-accent/15"
                                : message.type === "warning"
                                  ? "border-primary bg-primary/10"
                                  : message.type === "announcement"
                                  ? "border-secondary bg-secondary/15"
                                  : "border-border bg-muted/50",
                              ].join(" ")}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium">{message.title}</h4>
                                <div className="flex gap-1">
                                  <span className="chip px-2 py-0.5 rounded text-xs capitalize">{message.type}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => deleteMessage(message.id)}
                                    className="h-6 w-6 p-0"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{message.content}</p>
                              <div className="mb-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                <Badge variant="outline" className="border-dashed">
                                  Prioridad {message.priority}
                                </Badge>
                                <Badge variant="outline" className="border-dashed">
                                  {message.displayDurationSeconds ?? DEFAULT_PROMOTION_DURATION}s en pantalla
                                </Badge>
                                <Badge variant="outline" className="border-dashed">
                                  {message.activeDays?.length
                                    ? `Días: ${message.activeDays.join(", ")}`
                                    : "Todos los días"}
                                </Badge>
                                {message.mediaType && (
                                  <Badge variant="outline" className="border-dashed capitalize">
                                    {message.mediaType}
                                  </Badge>
                                )}
                              </div>
                              {(message.startDate || message.endDate) && (
                                <p className="text-xs text-muted-foreground mb-1">
                                  Vigencia: {formatMessageDate(message.startDate) ?? "Sin inicio"} –
                                  {" "}
                                  {formatMessageDate(message.endDate) ?? "sin fin"}
                                </p>
                              )}
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Creado: {formatMessageDate(message.createdAt) ?? ""}</span>
                                <span className="capitalize">{message.type}</span>
                              </div>
                            </div>
                          ))}
                          {customMessages.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                              <p>No hay mensajes activos</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </PermissionGuard>

            {/* ======= TAB: Configuración ======= */}
            <PermissionGuard permission="manage_settings">
              <TabsContent value="settings" className="space-y-6">
                {settingsError && (
                  <Alert variant="destructive" className="glass border-destructive/40 bg-destructive/10">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{settingsError}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/60 px-4 py-3 glass">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {settingsLoading
                        ? "Cargando configuración…"
                        : lastSettingsUpdate
                          ? `Última sincronización: ${lastSettingsUpdate.toLocaleString()}`
                          : "Sincronizá para obtener la configuración inicial."}
                    </p>
                    {hasDirtySettings && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                        <AlertTriangle className="h-3 w-3" />
                        Hay cambios pendientes sin guardar.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refreshSettings()}
                      disabled={settingsLoading || savingSettings}
                      className="hover:bg-accent hover:text-accent-foreground"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Sincronizar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDiscardSettings}
                      disabled={!hasDirtySettings || savingSettings}
                    >
                      Revertir cambios
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="glass card-elev-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Workflow className="h-5 w-5" />
                        Flujos de atención
                      </CardTitle>
                      <CardDescription>Parámetros principales para la operación diaria.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="max-wait">Tiempo máximo de espera (minutos)</Label>
                        <Input
                          id="max-wait"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={settingsForm.maxWaitTime}
                          onChange={(e) => {
                            const sanitized = e.target.value.replace(/[^0-9]/g, "")
                            updateSettingField("maxWaitTime", sanitized)
                          }}
                          disabled={disableSettingsForm}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Define el umbral para generar alertas internas cuando la espera se prolonga.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="alerts-escalation">Escalar alertas después de (minutos)</Label>
                        <Input
                          id="alerts-escalation"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          value={settingsForm.alertsEscalationMinutes}
                          onChange={(e) => {
                            const sanitized = e.target.value.replace(/[^0-9]/g, "")
                            updateSettingField("alertsEscalationMinutes", sanitized)
                          }}
                          disabled={disableSettingsForm}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Pasado este tiempo notificaremos a supervisores y responsables.
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto-call">Llamado automático</Label>
                        <Switch
                          id="auto-call"
                          checked={settingsForm.autoCallNext}
                          onCheckedChange={(checked) => updateSettingField("autoCallNext", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="sound">Sonido habilitado</Label>
                        <Switch
                          id="sound"
                          checked={settingsForm.soundEnabled}
                          onCheckedChange={(checked) => updateSettingField("soundEnabled", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="show-wait-times-config">Mostrar tiempos de espera</Label>
                        <Switch
                          id="show-wait-times-config"
                          checked={settingsForm.showWaitTimes}
                          onCheckedChange={(checked) => updateSettingField("showWaitTimes", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="glass card-elev-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MonitorSmartphone className="h-5 w-5" />
                        Terminal de autoservicio
                      </CardTitle>
                      <CardDescription>Personaliza la experiencia del kiosco digital.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="kiosk-require-dni">Solicitar DNI obligatorio</Label>
                        <Switch
                          id="kiosk-require-dni"
                          checked={settingsForm.kioskRequireDni}
                          onCheckedChange={(checked) => updateSettingField("kioskRequireDni", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="kiosk-sms">Permitir SMS de estado</Label>
                        <Switch
                          id="kiosk-sms"
                          checked={settingsForm.kioskAllowSms}
                          onCheckedChange={(checked) => updateSettingField("kioskAllowSms", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="kiosk-stats">Mostrar métricas de espera</Label>
                        <Switch
                          id="kiosk-stats"
                          checked={settingsForm.kioskShowQueueStats}
                          onCheckedChange={(checked) => updateSettingField("kioskShowQueueStats", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="kiosk-printing">Impresión silenciosa en kiosco</Label>
                          <Switch
                            id="kiosk-printing"
                            checked={settingsForm.kioskPrintingEnabled}
                            onCheckedChange={(checked) => updateSettingField("kioskPrintingEnabled", checked)}
                            className="data-[state=checked]:bg-primary"
                            disabled={disableSettingsForm}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Activa la impresión directa del navegador (Chrome con --kiosk-printing) y evita depender del
                          webhook remoto.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="kiosk-message">Mensaje de bienvenida</Label>
                        <Textarea
                          id="kiosk-message"
                          rows={3}
                          value={settingsForm.kioskWelcomeMessage}
                          onChange={(e) => updateSettingField("kioskWelcomeMessage", e.target.value)}
                          disabled={disableSettingsForm}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Se muestra en la pantalla inicial del kiosco antes de seleccionar un servicio.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="kiosk-location">Nombre del lugar</Label>
                        <Input
                          id="kiosk-location"
                          value={settingsForm.kioskLocationName}
                          onChange={(e) => updateSettingField("kioskLocationName", e.target.value)}
                          disabled={disableSettingsForm}
                          placeholder="Ej. Sucursal Centro"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Este texto aparece en el ticket impreso para identificar la sede o mostrador.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="terminal-print-webhook-url">Webhook de impresión</Label>
                        <Input
                          id="terminal-print-webhook-url"
                          type="url"
                          placeholder="https://impresora.tuempresa.com/webhook"
                          value={settingsForm.terminalPrintWebhookUrl}
                          onChange={(e) => updateSettingField("terminalPrintWebhookUrl", e.target.value)}
                          disabled={disableSettingsForm}
                          autoComplete="off"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Se usará si no hay variables de entorno configuradas para el webhook de impresión.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="terminal-print-webhook-token">Token del webhook</Label>
                        <Input
                          id="terminal-print-webhook-token"
                          type="password"
                          placeholder="Opcional"
                          value={settingsForm.terminalPrintWebhookToken}
                          onChange={(e) => updateSettingField("terminalPrintWebhookToken", e.target.value)}
                          disabled={disableSettingsForm}
                          autoComplete="off"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Si se completa, se enviará como Authorization Bearer al webhook de impresión.
                        </p>
                      </div>
                      <Alert
                        variant="secondary"
                        className="glass border-secondary/40 bg-secondary/10"
                      >
                        <Printer className="h-4 w-4" />
                        <div className="space-y-2">
                          <AlertTitle>Cómo habilitar la impresión local</AlertTitle>
                          <AlertDescription>
                            <ol className="list-decimal space-y-1 pl-4 text-xs sm:text-sm">
                              <li>
                                Instalá un servicio ligero ("puente") en la PC donde está la impresora. Debe escuchar
                                solicitudes HTTP y enviar el payload recibido a la impresora local.
                              </li>
                              <li>
                                Exponé ese servicio hacia Internet de forma segura (puerto abierto, NAT o túnel) con IP
                                fija o DNS dinámico y filtros de firewall que acepten únicamente el tráfico de tu deploy
                                en Vercel.
                              </li>
                              <li>
                                Colocá aquí la URL pública del puente y, si corresponde, definí un token compartido para
                                validar el <code>Authorization: Bearer</code> antes de imprimir.
                              </li>
                              <li>
                                Cuando un operador llame al siguiente turno, enviaremos un POST al puente con los datos del
                                ticket para que se dispare la impresión local.
                              </li>
                            </ol>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              Asegurate de que el puente utilice HTTPS o un túnel seguro y que registre cada solicitud para
                              facilitar auditorías.
                            </p>
                          </AlertDescription>
                        </div>
                      </Alert>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetKiosk}
                        disabled={disableSettingsForm}
                        className="hover:bg-accent hover:text-accent-foreground"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Restaurar valores de fábrica
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="glass card-elev-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Cartelería y branding
                      </CardTitle>
                      <CardDescription>Controla la estética de las pantallas y comunicaciones.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label htmlFor="display-timeout-config">Rotación de pantallas (segundos)</Label>
                        <Input
                          id="display-timeout-config"
                          type="number"
                          inputMode="numeric"
                          min={5}
                          value={settingsForm.displayTimeout}
                          onChange={(e) => {
                            const sanitized = e.target.value.replace(/[^0-9]/g, "")
                            updateSettingField("displayTimeout", sanitized)
                          }}
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div>
                        <Label htmlFor="signage-theme">Tema de cartelería</Label>
                        <Select
                          value={settingsForm.signageTheme}
                          onValueChange={(value) => updateSettingField("signageTheme", value)}
                          disabled={disableSettingsForm}
                        >
                          <SelectTrigger id="signage-theme">
                            <SelectValue placeholder="Seleccionar tema" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="corporate">Corporativo</SelectItem>
                            <SelectItem value="minimal">Minimalista</SelectItem>
                            <SelectItem value="contrast">Alto contraste</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1">
                          <Label htmlFor="signage-news">Habilitar mensajes/promociones en Display</Label>
                          <p className="text-xs text-muted-foreground">
                            Define si la cartelería pública mostrará el carrusel de mensajes.
                          </p>
                        </div>
                        <Switch
                          id="signage-news"
                          checked={settingsForm.signageShowNews}
                          onCheckedChange={(checked) => updateSettingField("signageShowNews", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signage-weather">Mostrar clima</Label>
                        <Switch
                          id="signage-weather"
                          checked={settingsForm.signageShowWeather}
                          onCheckedChange={(checked) => updateSettingField("signageShowWeather", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signage-waiting-list">Mostrar lista de espera</Label>
                        <Switch
                          id="signage-waiting-list"
                          checked={settingsForm.signageShowWaitingList}
                          onCheckedChange={(checked) => updateSettingField("signageShowWaitingList", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signage-flow-summary">Mostrar flujo en tiempo real</Label>
                        <Switch
                          id="signage-flow-summary"
                          checked={settingsForm.signageShowFlowSummary}
                          onCheckedChange={(checked) => updateSettingField("signageShowFlowSummary", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signage-key-indicators">Mostrar indicadores clave</Label>
                        <Switch
                          id="signage-key-indicators"
                          checked={settingsForm.signageShowKeyIndicators}
                          onCheckedChange={(checked) => updateSettingField("signageShowKeyIndicators", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div>
                        <Label htmlFor="currency-source">Fuente de cotizaciones</Label>
                        <Select
                          value={settingsForm.signageCurrencySource}
                          onValueChange={(value) => updateSettingField("signageCurrencySource", value)}
                          disabled={disableSettingsForm}
                        >
                          <SelectTrigger id="currency-source">
                            <SelectValue placeholder="Seleccionar fuente" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="oficial">Dólar oficial (BCRA)</SelectItem>
                            <SelectItem value="blue">Dólar blue</SelectItem>
                            <SelectItem value="crypto">Promedio cripto</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="mt-3">
                          <Label htmlFor="signage-indicators-refresh">Intervalo de actualización (minutos)</Label>
                          <Input
                            id="signage-indicators-refresh"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={settingsForm.signageIndicatorsRefreshMinutes}
                            onChange={(e) => {
                              const sanitized = e.target.value.replace(/[^0-9]/g, "")
                              updateSettingField("signageIndicatorsRefreshMinutes", sanitized)
                            }}
                            disabled={disableSettingsForm}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Los valores provienen de DolarAPI.com (https://dolarapi.com/v1/dolares) y se actualizan cada
                          {" "}
                          {indicatorsRefreshMinutes === 1
                            ? "minuto"
                            : `${indicatorsRefreshMinutes} minutos`}.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="brand-display-name">Nombre visible de la marca</Label>
                        <Input
                          id="brand-display-name"
                          type="text"
                          placeholder="Ej. DrizaTx"
                          value={settingsForm.brandDisplayName}
                          onChange={(e) => updateSettingField("brandDisplayName", e.target.value)}
                          disabled={disableSettingsForm}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Se muestra junto al logo en los displays y terminales.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="brand-primary">Color primario</Label>
                          <Input
                            id="brand-primary"
                            type="color"
                            value={settingsForm.brandPrimaryColor}
                            onChange={(e) => updateSettingField("brandPrimaryColor", e.target.value)}
                            disabled={disableSettingsForm}
                            className="h-10 w-20 cursor-pointer"
                          />
                        </div>
                        <div>
                          <Label htmlFor="brand-secondary">Color secundario</Label>
                          <Input
                            id="brand-secondary"
                            type="color"
                            value={settingsForm.brandSecondaryColor}
                            onChange={(e) => updateSettingField("brandSecondaryColor", e.target.value)}
                            disabled={disableSettingsForm}
                            className="h-10 w-20 cursor-pointer"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="brand-logo">URL del logo</Label>
                        <Input
                          id="brand-logo"
                          type="url"
                          placeholder="https://..."
                          value={settingsForm.brandLogoUrl}
                          onChange={(e) => updateSettingField("brandLogoUrl", e.target.value)}
                          disabled={disableSettingsForm}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Se utiliza en pantallas, tickets y comunicaciones externas.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="display-title">Título para cartelería</Label>
                        <Input
                          id="display-title"
                          type="text"
                          placeholder="Nombre de la sala o sucursal"
                          value={settingsForm.displayTitle}
                          onChange={(e) => updateSettingField("displayTitle", e.target.value)}
                          disabled={disableSettingsForm}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Encabezado principal que aparece junto al logo en las pantallas de espera.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="display-slogan">Eslogan para pantallas</Label>
                        <Input
                          id="display-slogan"
                          type="text"
                          placeholder="Tu atención comienza aquí"
                          value={settingsForm.displaySlogan}
                          onChange={(e) => updateSettingField("displaySlogan", e.target.value)}
                          disabled={disableSettingsForm}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Se muestra debajo del nombre institucional en la cartelería de espera.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="sm:col-span-1">
                          <Label htmlFor="weather-location" className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            Ubicación para clima
                          </Label>
                          <Input
                            id="weather-location"
                            type="text"
                            placeholder="Ciudad, País"
                            value={settingsForm.signageWeatherLocation}
                            onChange={(e) => updateSettingField("signageWeatherLocation", e.target.value)}
                            disabled={disableSettingsForm}
                          />
                        </div>
                        <div>
                          <Label htmlFor="weather-lat">Latitud</Label>
                          <Input
                            id="weather-lat"
                            type="text"
                            inputMode="decimal"
                            placeholder="-34.6037"
                            value={settingsForm.signageWeatherLatitude}
                            onChange={(e) => updateSettingField("signageWeatherLatitude", e.target.value)}
                            disabled={disableSettingsForm}
                          />
                        </div>
                        <div>
                          <Label htmlFor="weather-lon">Longitud</Label>
                          <Input
                            id="weather-lon"
                            type="text"
                            inputMode="decimal"
                            placeholder="-58.3816"
                            value={settingsForm.signageWeatherLongitude}
                            onChange={(e) => updateSettingField("signageWeatherLongitude", e.target.value)}
                            disabled={disableSettingsForm}
                          />
                        </div>
                        <div className="flex flex-col gap-2 sm:col-span-3 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs text-muted-foreground">
                            Estas coordenadas se utilizan para mostrar el clima en vivo en la cartelería.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleUseCurrentLocation}
                            disabled={disableSettingsForm || detectingLocation}
                            className="flex items-center gap-2"
                          >
                            {detectingLocation ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <LocateFixed className="h-3.5 w-3.5" />
                            )}
                            {detectingLocation ? "Buscando..." : "Usar mi ubicación actual"}
                          </Button>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetBranding}
                        disabled={disableSettingsForm}
                        className="hover:bg-accent hover:text-accent-foreground"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Restaurar branding por defecto
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="glass card-elev-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Integraciones y notificaciones
                      </CardTitle>
                      <CardDescription>Define cómo se comunican los canales externos.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="notifications">Notificaciones habilitadas</Label>
                        <Switch
                          id="notifications"
                          checked={settingsForm.notificationsEnabled}
                          onCheckedChange={(checked) => updateSettingField("notificationsEnabled", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="mobile-app">App móvil habilitada</Label>
                        <Switch
                          id="mobile-app"
                          checked={settingsForm.mobileEnabled}
                          onCheckedChange={(checked) => updateSettingField("mobileEnabled", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="qr-codes">Códigos QR habilitados</Label>
                        <Switch
                          id="qr-codes"
                          checked={settingsForm.qrEnabled}
                          onCheckedChange={(checked) => updateSettingField("qrEnabled", checked)}
                          className="data-[state=checked]:bg-primary"
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div>
                        <Label htmlFor="analytics-email" className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          Correo para reportes
                        </Label>
                        <Input
                          id="analytics-email"
                          type="email"
                          placeholder="reportes@tuempresa.com"
                          value={settingsForm.analyticsEmail}
                          onChange={(e) => updateSettingField("analyticsEmail", e.target.value)}
                          disabled={disableSettingsForm}
                        />
                      </div>
                      <div>
                        <Label htmlFor="webhook-url" className="flex items-center gap-2">
                          <LinkIcon className="h-4 w-4 text-muted-foreground" />
                          Webhook de integraciones
                        </Label>
                        <Input
                          id="webhook-url"
                          type="url"
                          placeholder="https://api.tuempresa.com/hooks/drizatx"
                          value={settingsForm.webhookUrl}
                          onChange={(e) => updateSettingField("webhookUrl", e.target.value)}
                          disabled={disableSettingsForm}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Recibirá eventos de creación de tickets, cambios de estado y alertas.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card className="glass card-elev-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      Seguridad y respaldos
                    </CardTitle>
                    <CardDescription>Acciones administrativas adicionales.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="backup-directory" className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-muted-foreground" />
                          Carpeta de respaldos
                        </Label>
                        {queueApiMode ? (
                          <>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <Input
                                id="backup-directory"
                                placeholder={
                                  backupStatus?.resolvedDirectory ?? DEFAULT_SETTINGS_FORM.backupDirectory
                                }
                                value={settingsForm.backupDirectory}
                                onChange={(e) => updateSettingField("backupDirectory", e.target.value)}
                                disabled={disableSettingsForm}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleRequestBackupDirectory}
                                disabled={disableSettingsForm}
                                className="flex items-center gap-2"
                              >
                                <FolderOpen className="h-4 w-4" />
                                Explorar
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Guardaremos cada copia diaria en esta ruta del servidor.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground">
                              Cada respaldo manual se descargará directamente en tu navegador.
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Usa el diálogo de «Guardar como...» para elegir la carpeta local donde conservar el archivo.
                            </p>
                          </>
                        )}
                        {queueApiMode && backupStatus?.directoryExists === false && (
                          <p className="text-xs text-destructive">
                            La carpeta no existe todavía; la crearemos automáticamente en el próximo respaldo.
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="backup-time" className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          Horario diario
                        </Label>
                        <Input
                          id="backup-time"
                          type="time"
                          value={settingsForm.backupTime}
                          onChange={(e) => updateSettingField("backupTime", e.target.value)}
                          disabled={disableSettingsForm}
                        />
                        <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/10 px-3 py-2">
                          <div className="text-sm text-muted-foreground">
                            {settingsForm.backupEnabled
                              ? "Los respaldos automáticos se ejecutarán todos los días a la hora indicada."
                              : "Los respaldos automáticos están deshabilitados."}
                          </div>
                          <Switch
                            id="backup-enabled"
                            checked={settingsForm.backupEnabled}
                            onCheckedChange={(checked) => updateSettingField("backupEnabled", checked)}
                            disabled={disableSettingsForm}
                            className="data-[state=checked]:bg-primary"
                          />
                        </div>
                      </div>
                      {queueApiMode ? (
                        <div className="space-y-2 lg:col-span-1 md:col-span-2">
                          <Label htmlFor="backup-mysqldump-path" className="flex items-center gap-2">
                            <Terminal className="h-4 w-4 text-muted-foreground" />
                            Ruta de mysqldump
                          </Label>
                          <Input
                            id="backup-mysqldump-path"
                            placeholder="C:\\Program Files\\MySQL\\MySQL Server\\bin\\mysqldump.exe"
                            value={settingsForm.backupMysqldumpPath}
                            onChange={(e) => updateSettingField("backupMysqldumpPath", e.target.value)}
                            disabled={disableSettingsForm}
                          />
                          <p className="text-xs text-muted-foreground">
                            Si lo dejas vacío usaremos la variable de entorno configurada o intentaremos localizar
                            <code className="mx-1 rounded bg-muted/70 px-1">mysqldump</code> en el PATH.
                          </p>
                        </div>
                      ) : null}
                    </div>

                    {queueApiMode && backupStatusError && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{backupStatusError}</AlertDescription>
                      </Alert>
                    )}

                    {queueApiMode && !backupStatusError && backupStatus?.lastError && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Último error registrado: {backupStatus.lastError}. Revisa el directorio configurado o los permisos del
                          servidor.
                        </AlertDescription>
                      </Alert>
                    )}

                    {queueApiMode && !backupStatusError && backupStatus && (
                      <Alert variant={backupStatus.mysqldumpAvailable ? "default" : "destructive"}>
                        <Database className="h-4 w-4" />
                        <AlertDescription>
                          <span className="font-medium">mysqldump:</span>{" "}
                          Usaremos
                          <code className="mx-1 rounded bg-muted/70 px-1">
                            {backupStatus.mysqldumpResolvedCommand || "mysqldump"}
                          </code>
                          {backupStatus.mysqldumpAvailable
                            ? "y está disponible en el servidor."
                            : "pero no se encuentra accesible en el servidor."}
                          {" "}
                          {backupStatus.mysqldumpCommandSource === "setting"
                            ? "Valor definido desde los ajustes."
                            : backupStatus.mysqldumpCommandSource === "env"
                              ? "Detectado a través de variables de entorno."
                              : "Usamos la ruta por defecto del sistema."}
                          {backupStatus.mysqldumpConfiguredPath && (
                            <>
                              {" "}
                              (Configurado: {backupStatus.mysqldumpConfiguredPath})
                            </>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Último respaldo</div>
                        <div className="mt-1 text-sm font-medium">{formatDateTime(backupStatus?.lastGeneratedAt)}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          Archivo: {backupStatus?.lastFileName || "—"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Último automático</div>
                        <div className="mt-1 text-sm font-medium">{formatDateTime(backupStatus?.lastAutomaticAt)}</div>
                        <div className="text-xs text-muted-foreground">
                          Tamaño: {formatBytes(backupStatus?.lastSize ?? null)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-card/60 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Directorio activo</div>
                        <div className="mt-1 break-all text-sm font-medium">{lastBackupLocation}</div>
                        <div className="text-xs text-muted-foreground">
                          {loadingBackupStatus
                            ? "Verificando estado..."
                            : queueApiMode
                              ? backupStatus?.directoryExists
                                ? "Disponible en el servidor"
                                : "Se creará automáticamente"
                              : "Modo local (respaldo manual)"}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      {currentUserId != null ? (
                        <ChangePasswordDialog
                          operatorId={currentUserId}
                          onChanged={() => {
                            if (queueApiMode) {
                              void refetch()
                            }
                          }}
                          triggerVariant="outline"
                          triggerClassName="h-20 flex-col bg-transparent hover:bg-accent hover:text-accent-foreground"
                          triggerIcon={<ShieldCheck className="h-6 w-6 mb-2" />}
                        />
                      ) : (
                        <Button
                          variant="outline"
                          className="h-20 flex-col bg-transparent text-muted-foreground"
                          disabled
                        >
                          <ShieldCheck className="h-6 w-6 mb-2" />
                          No disponible
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        className="h-20 flex-col bg-transparent hover:bg-accent hover:text-accent-foreground"
                        onClick={handleCreateBackup}
                        disabled={creatingBackup}
                      >
                        {creatingBackup ? (
                          <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                        ) : (
                          <FileDown className="h-6 w-6 mb-2" />
                        )}
                        {creatingBackup ? "Generando respaldo..." : "Generar respaldo"}
                      </Button>

                      <PermissionGuard
                        permission="view_system_logs"
                        fallback={
                          <Button
                            variant="outline"
                            className="h-20 flex-col bg-transparent text-muted-foreground"
                            disabled
                          >
                            <AlertTriangle className="h-6 w-6 mb-2" />
                            Acceso restringido
                          </Button>
                        }
                      >
                        <Button
                          variant="outline"
                          className="h-20 flex-col bg-transparent hover:bg-accent hover:text-accent-foreground"
                          asChild
                        >
                          <Link className="flex h-full w-full flex-col items-center justify-center" href="/audit">
                            <AlertTriangle className="h-6 w-6 mb-2" />
                            Ver logs
                          </Link>
                        </Button>
                      </PermissionGuard>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </PermissionGuard>
          </Tabs>
        </div>
      </AuthGuard>
    </div>
  )
}
