"use client"

import { useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Upload, Search, Download, History } from "lucide-react"
import { useClients } from "@/hooks/use-clients"
import type { Client, ClientHistory } from "@/lib/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const toArray = <T,>(x: any): T[] =>
  Array.isArray(x) ? x : (x?.items ?? x?.content ?? x?.results ?? [])

const statusLabels: Record<string, string> = {
  WAITING: "En espera",
  CALLED: "Llamado",
  IN_PROGRESS: "En atención",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  ABSENT: "Ausente",
}

const formatDateTime = (value: string | Date | null | undefined) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export default function ClientsPage() {
  const {
    clients,
    createClient,
    updateClient,
    deleteClient,
    bulkImport,
    getHistory,
    loading,
    error,
    refetch,
  } = useClients()
  const { toast } = useToast()

  const [query, setQuery] = useState("")
  const [form, setForm] = useState({ dni: "", name: "", email: "", phone: "", vip: false })
  const [editingId, setEditingId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [historyData, setHistoryData] = useState<ClientHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  const allClients = useMemo(() => toArray<Client>(clients), [clients])

  const filtered = useMemo(() => {
    const base = allClients
    const q = query.trim().toLowerCase()
    if (!q) return base
    return base.filter(c =>
      [c.dni, c.name, c.email, c.phone].some(v =>
        (v ?? "").toString().toLowerCase().includes(q)
      )
    )
  }, [allClients, query])

  const handleSubmit = async () => {
    if (!form.dni || !form.name) {
      toast({
        title: "Datos incompletos",
        description: "Completá DNI y nombre para continuar",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)

      if (editingId) {
        await updateClient(editingId, { ...form })
        toast({ title: "Cliente actualizado" })
        setEditingId(null)
      } else {
        await createClient(form as any)
        toast({ title: "Cliente creado" })
      }

      setForm({ dni: "", name: "", email: "", phone: "", vip: false })
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo guardar el cliente"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (c: Client) => {
    setEditingId(c.id)
    setForm({
      dni: c.dni,
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      vip: !!c.vip,
    })
  }

  const handleCSVImport = async (file: File) => {
    setImporting(true)

    try {
      const text = await file.text()
      // Encabezados esperados: dni,name,email,phone,vip
      const lines = text.split(/\r?\n/).filter(Boolean)
      const [header, ...rows] = lines
      const cols = header.split(",").map((c) => c.trim().toLowerCase())

      const dniIdx = cols.indexOf("dni")
      const nameIdx = cols.indexOf("name")
      const emailIdx = cols.indexOf("email")
      const phoneIdx = cols.indexOf("phone")
      const vipIdx = cols.indexOf("vip")

      if (dniIdx === -1 || nameIdx === -1) {
        throw new Error("El CSV debe incluir las columnas dni y name")
      }

      const parsed = rows
        .map((r) => {
          const parts = r.split(",")
          return {
            dni: (parts[dniIdx] || "").trim(),
            name: (parts[nameIdx] || "").trim(),
            email: emailIdx !== -1 ? (parts[emailIdx] || "").trim() : "",
            phone: phoneIdx !== -1 ? (parts[phoneIdx] || "").trim() : "",
            vip: vipIdx !== -1
              ? ["true", "1", "si", "sí"].includes(((parts[vipIdx] || "").trim().toLowerCase()))
              : false,
          }
        })
        .filter((r) => r.dni && r.name)

      if (parsed.length === 0) {
        throw new Error("No se encontraron filas válidas en el CSV")
      }

      await bulkImport(parsed)
      toast({ title: "Importación completada", description: `${parsed.length} clientes procesados` })
    } catch (err) {
      const description = err instanceof Error ? err.message : "Error importando clientes"
      toast({
        title: "No se pudo importar",
        description,
        variant: "destructive",
      })
    } finally {
      if (fileRef.current) fileRef.current.value = ""
      setImporting(false)
    }
  }

  const handleExportSample = () => {
    const headers = "dni,name,email,phone,vip\n"
    const sample = [
      "30123456,Juan Gomez,juan@example.com,+5491112345678,false",
      "28987654,Lucia Fernandez,lucia@example.com,+5491198765432,true",
    ].join("\n")
    const blob = new Blob([headers + sample], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "clientes-ejemplo.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleViewHistory = async (client: Client) => {
    if (!client?.id) return

    setSelectedClient(client)
    setHistoryData(null)
    setHistoryOpen(true)
    setHistoryLoading(true)

    try {
      const history = await getHistory(client.id)
      setHistoryData(history)
    } catch (err) {
      console.error("Error loading client history", err)
      const description = err instanceof Error ? err.message : "Intentalo nuevamente"
      toast({
        title: "No se pudo cargar el historial",
        description,
        variant: "destructive",
      })
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleDialogChange = (open: boolean) => {
    setHistoryOpen(open)
    if (!open) {
      setHistoryData(null)
      setSelectedClient(null)
      setHistoryLoading(false)
    }
  }

  const totalClients = allClients.length
  const totalVip = useMemo(() => allClients.filter((client) => client.vip).length, [allClients])
  const withoutEmail = useMemo(() => allClients.filter((client) => !client.email).length, [allClients])

  return (
    <div className="flex-1 space-y-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">Clientes</h1>
            <p className="text-sm text-muted-foreground mt-1">Carga y administración de clientes</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleExportSample}
              className="hover:bg-accent hover:text-accent-foreground"
              disabled={saving || importing}
            >
              <Download className="h-4 w-4 mr-2" />
              CSV ejemplo
            </Button>

            <label
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-transparent focus-lux ${
                importing ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/60 cursor-pointer"
              }`}
              aria-disabled={importing}
            >
              <Upload className="h-4 w-4" />
              {importing ? "Importando..." : "Importar CSV"}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                hidden
                onChange={(e) => e.target.files?.[0] && handleCSVImport(e.target.files[0])}
                disabled={importing}
              />
            </label>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card className="glass card-elev-1 border-dashed">
            <CardHeader className="pb-2">
              <CardDescription>Total de clientes</CardDescription>
              <CardTitle className="text-3xl">{totalClients}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass card-elev-1 border-dashed">
            <CardHeader className="pb-2">
              <CardDescription>Clientes VIP</CardDescription>
              <CardTitle className="text-3xl">{totalVip}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass card-elev-1 border-dashed">
            <CardHeader className="pb-2">
              <CardDescription>Sin correo registrado</CardDescription>
              <CardTitle className="text-3xl">{withoutEmail}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass card-elev-1 border-dashed">
            <CardHeader className="pb-2">
              <CardDescription>Resultados filtrados</CardDescription>
              <CardTitle className="text-3xl">{filtered.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <Card className="lg:col-span-1 glass card-elev-2">
            <CardHeader>
              <CardTitle>{editingId ? "Editar Cliente" : "Nuevo Cliente"}</CardTitle>
              <CardDescription>Completá los datos y guardá</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="dni">DNI</Label>
                <Input
                  id="dni"
                  value={form.dni}
                  onChange={(e) => setForm((prev) => ({ ...prev, dni: e.target.value.replace(/\D/g, "") }))}
                  placeholder="Ej: 30123456"
                />
              </div>
              <div>
                <Label htmlFor="name">Nombre y Apellido</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Juan Pérez"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="correo@dominio.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+54911..."
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="vip">Cliente VIP</Label>
                <Switch
                  id="vip"
                  checked={form.vip}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, vip: checked }))}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSubmit} className="btn-premium" disabled={saving}>
                  {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
                </Button>
                {editingId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingId(null)
                      setForm({ dni: "", name: "", email: "", phone: "", vip: false })
                    }}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Listado */}
          <Card className="lg:col-span-2 glass card-elev-2">
            <CardHeader>
              <CardTitle>Listado de Clientes</CardTitle>
              <CardDescription>Buscar y administrar clientes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por DNI, nombre, email o teléfono"
                    className="pl-9"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                {error ? (
                  <div className="border border-destructive/50 rounded-md p-6 text-sm text-destructive space-y-3">
                    <p>{error}</p>
                    <Button size="sm" variant="outline" onClick={refetch}>
                      Reintentar
                    </Button>
                  </div>
                ) : (
                  <Table className="border rounded-md">
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>DNI</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>VIP</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10">
                            <Spinner label="Cargando clientes..." />
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {filtered.map((c) => (
                            <TableRow key={c.id} className="hover:bg-muted/30 transition">
                              <TableCell className="font-mono">{c.dni}</TableCell>
                              <TableCell>{c.name}</TableCell>
                              <TableCell>{c.email || "-"}</TableCell>
                              <TableCell>{c.phone || "-"}</TableCell>
                              <TableCell>
                                <Badge variant={c.vip ? "default" : "secondary"}>{c.vip ? "VIP" : "Normal"}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="inline-flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewHistory(c)}
                                    disabled={(historyLoading && selectedClient?.id === c.id) || !c.id}
                                    className="gap-1.5"
                                  >
                                    <History className="h-4 w-4" />
                                    Historial
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => handleEdit(c)}>
                                    Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      if (!confirm("¿Eliminar cliente?")) return
                                      try {
                                        await deleteClient(c.id)
                                        toast({ title: "Cliente eliminado" })
                                      } catch (err) {
                                        const message =
                                          err instanceof Error ? err.message : "No se pudo eliminar el cliente"
                                        toast({
                                          title: "Error",
                                          description: message,
                                          variant: "destructive",
                                        })
                                      }
                                    }}
                                  >
                                    Eliminar
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}

                          {filtered.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                No se encontraron clientes
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={historyOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedClient ? `Historial de ${selectedClient.name}` : "Historial del cliente"}
            </DialogTitle>
            <DialogDescription>
              {selectedClient
                ? `DNI ${selectedClient.dni}`
                : "Seleccioná un cliente para ver sus últimas visitas"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {historyLoading ? (
              <Spinner className="py-10" label="Cargando historial..." />
            ) : historyData ? (
              <div className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total de visitas</p>
                    <p className="text-lg font-semibold text-foreground">{historyData.totalVisits}</p>
                    <p className="text-[11px] text-muted-foreground">Últimas {historyData.history.length} mostradas</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Última visita</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatDateTime(historyData.lastVisitAt) ?? "Sin registros"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Ticket {historyData.lastTicketNumber ?? "-"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Último servicio</p>
                    <p className="text-lg font-semibold text-foreground">
                      {historyData.lastService?.name ?? "Sin registros"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Atendido por</p>
                    <p className="text-lg font-semibold text-foreground">
                      {historyData.lastOperator?.name ?? "Sin asignar"}
                    </p>
                  </div>
                </div>

                {historyData.history.length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Se muestran hasta las últimas {historyData.history.length} visitas recientes.
                    </div>
                    <ScrollArea className="max-h-80 pr-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ticket</TableHead>
                            <TableHead>Fecha de visita</TableHead>
                            <TableHead>Servicio</TableHead>
                            <TableHead>Atendido por</TableHead>
                            <TableHead>Estado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyData.history.map((item) => {
                            const visitMoment =
                              formatDateTime(item.completedAt ?? item.startedAt ?? item.calledAt ?? item.createdAt) ??
                              "Sin registro"
                            const createdMoment = formatDateTime(item.createdAt)

                            return (
                              <TableRow key={item.ticketId}>
                                <TableCell className="font-mono">{item.ticketNumber}</TableCell>
                                <TableCell>
                                  <div className="font-medium text-foreground">{visitMoment}</div>
                                  {createdMoment && (
                                    <p className="text-xs text-muted-foreground">Emitido: {createdMoment}</p>
                                  )}
                                </TableCell>
                                <TableCell>{item.serviceName ?? "Sin servicio"}</TableCell>
                                <TableCell>{item.operatorName ?? "Sin asignar"}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {statusLabels[item.status.toString()] ?? item.status}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-10 text-center text-sm text-muted-foreground">
                    Aún no hay visitas registradas para este cliente.
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Seleccioná un cliente para ver su historial.
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cerrar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
