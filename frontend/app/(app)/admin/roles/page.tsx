"use client";

import { useEffect, useMemo, useState } from "react";

import { PermissionGuard } from "@/components/permission-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PermissionMatrix } from "@/components/admin/roles/permission-matrix";
import { RoleSummaryCard } from "@/components/admin/roles/role-summary-card";
import { useRoles } from "@/hooks/use-roles";
import { useToast } from "@/hooks/use-toast";
import type { Permission } from "@/lib/types";
import type { RoleWithPermissions } from "@/lib/api-client";
import { Loader2, Pencil, Plus } from "lucide-react";

type DialogMode = "create" | "edit";

type RoleFormState = {
  slug: string;
  name: string;
  description: string;
  permissions: Permission[];
};

const EMPTY_FORM: RoleFormState = {
  slug: "",
  name: "",
  description: "",
  permissions: [],
};

function normalizeSlug(value: string): string {
  return value.trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").toUpperCase();
}

function normalizeDescription(value: string): string {
  return value.trim();
}

export default function RolesPage() {
  const { roles, permissionsCatalog, loading, error, createRole, updateRole, updateRolePermissions } = useRoles();
  const { toast } = useToast();

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("create");
  const [formState, setFormState] = useState<RoleFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);

  useEffect(() => {
    if (roles.length === 0) {
      setSelectedRoleId(null);
      return;
    }

    if (selectedRoleId == null || !roles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(roles[0]?.id ?? null);
    }
  }, [roles, selectedRoleId]);

  const selectedRole = useMemo<RoleWithPermissions | null>(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const handleOpenCreate = () => {
    setDialogMode("create");
    setFormState(EMPTY_FORM);
    setEditingRoleId(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (role: RoleWithPermissions) => {
    setDialogMode("edit");
    setEditingRoleId(role.id ?? null);
    if (role.id != null) {
      setSelectedRoleId(role.id);
    }
    setFormState({
      slug: role.slug ?? "",
      name: role.name ?? "",
      description: role.description ?? "",
      permissions: Array.isArray(role.permissions) ? [...role.permissions] : [],
    });
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSaving(false);
      setFormState(EMPTY_FORM);
      setEditingRoleId(null);
    }
  };

  const handleSubmit = async () => {
    const slug = normalizeSlug(formState.slug);
    const name = formState.name.trim();
    const description = normalizeDescription(formState.description);

    if (!slug || !name) {
      toast({
        variant: "destructive",
        title: "Campos incompletos",
        description: "El identificador y el nombre del rol son obligatorios.",
      });
      return;
    }

    setSaving(true);
    try {
      if (dialogMode === "create") {
        const created = await createRole({
          slug,
          name,
          description: description ? description : null,
          permissions: formState.permissions,
        });
        toast({ title: "Rol creado", description: `Se creó el rol ${name}.` });
        setSelectedRoleId(created.id ?? null);
        setDialogOpen(false);
      } else if (dialogMode === "edit") {
        const targetRoleId = editingRoleId ?? selectedRole?.id ?? null;
        if (!targetRoleId) {
          throw new Error("No se pudo determinar el rol a actualizar");
        }
        await updateRole(targetRoleId, {
          slug,
          name,
          description: description ? description : null,
        });
        await updateRolePermissions(targetRoleId, formState.permissions);
        toast({ title: "Rol actualizado", description: `Se guardaron los cambios en ${name}.` });
        setSelectedRoleId(targetRoleId);
        setDialogOpen(false);
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: err?.message ?? "Reintentá en unos minutos.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PermissionGuard permission="manage_roles" showError>
      <div className="flex-1 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Roles y permisos</h1>
            <p className="text-sm text-muted-foreground">
              Creá, editá y asigná permisos a los roles de la organización.
            </p>
          </div>
          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo rol
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-5">
          <Card className="glass card-elev-2 lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span>Roles configurados</span>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </CardTitle>
              <CardDescription>Seleccioná un rol para ver su resumen rápido.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead className="hidden sm:table-cell">Permisos</TableHead>
                      <TableHead className="w-20 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => {
                      const isActive = role.id === selectedRoleId;
                      const permissionsCount = role.permissions?.length ?? 0;
                      return (
                        <TableRow
                          key={`${role.id ?? role.slug}`}
                          className={`cursor-pointer transition-colors hover:bg-muted/40 ${
                            isActive ? "bg-muted/40" : ""
                          }`}
                          onClick={() => setSelectedRoleId(role.id ?? null)}
                        >
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{role.name ?? role.slug}</p>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">{role.slug}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="text-xs font-normal">
                              {permissionsCount} permiso{permissionsCount === 1 ? "" : "s"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenEdit(role);
                              }}
                              aria-label={`Editar ${role.name ?? role.slug}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {!loading && roles.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                          No hay roles disponibles todavía.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-4">
            <RoleSummaryCard role={selectedRole} />
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className="max-w-3xl sm:max-w-4xl lg:max-w-5xl">
            <DialogHeader>
              <DialogTitle>{dialogMode === "create" ? "Nuevo rol" : "Editar rol"}</DialogTitle>
              <DialogDescription>
                Definí los datos básicos del rol y elegí qué permisos tendrá asignados.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="role-slug" className="text-sm font-medium text-foreground">
                    Identificador
                  </label>
                  <Input
                    id="role-slug"
                    value={formState.slug}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        slug: event.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="ADMIN"
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="role-name" className="text-sm font-medium text-foreground">
                    Nombre visible
                  </label>
                  <Input
                    id="role-name"
                    value={formState.name}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Administrador"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="role-description" className="text-sm font-medium text-foreground">
                  Descripción
                </label>
                <Textarea
                  id="role-description"
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Describe brevemente el alcance de este rol"
                  disabled={saving}
                  rows={3}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Permisos asignados</span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {formState.permissions.length} seleccionado
                    {formState.permissions.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                <PermissionMatrix
                  permissions={permissionsCatalog}
                  value={formState.permissions}
                  onChange={(next) => setFormState((prev) => ({ ...prev, permissions: next }))}
                  disabled={saving}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => handleDialogClose(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}
