"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RoleWithPermissions } from "@/lib/api-client";

type RoleSummaryCardProps = {
  role: RoleWithPermissions | null;
};

export function RoleSummaryCard({ role }: RoleSummaryCardProps) {
  if (!role) {
    return (
      <Card className="border-dashed border-border/60">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Seleccione un rol</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Elegí un rol de la lista para ver su detalle.
        </CardContent>
      </Card>
    );
  }

  const permissions = Array.from(new Set(role.permissions ?? [])).sort();

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Resumen del rol</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Nombre</p>
          <p className="mt-1 text-base font-semibold text-foreground">{role.name ?? role.slug}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Identificador</p>
          <code className="mt-1 inline-flex rounded bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
            {role.slug}
          </code>
        </div>

        {role.description && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Descripción</p>
            <p className="mt-1 text-foreground/90 leading-relaxed">{role.description}</p>
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Permisos</p>
          {permissions.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {permissions.map((permission) => (
                <Badge key={permission} variant="secondary" className="text-xs font-normal">
                  {permission}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-muted-foreground">Sin permisos asignados.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
