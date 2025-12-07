"use client";

import { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { Permission } from "@/lib/types";
import type { PermissionDefinition } from "@/lib/api-client";

type PermissionMatrixProps = {
  permissions: PermissionDefinition[];
  value: Permission[];
  onChange: (next: Permission[]) => void;
  disabled?: boolean;
};

type PermissionGroup = {
  key: string;
  label: string;
  order: number;
  permissions: PermissionDefinition[];
};

function groupPermissions(definitions: PermissionDefinition[]): PermissionGroup[] {
  const map = new Map<string, PermissionGroup>();

  for (const definition of definitions) {
    const key = (definition.module ?? "general").toLowerCase();
    const label = definition.moduleLabel ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const order = definition.order ?? 1000;

    if (!map.has(key)) {
      map.set(key, { key, label, order, permissions: [] });
    }

    map.get(key)!.permissions.push(definition);
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      permissions: group.permissions.sort((a, b) =>
        a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
      ),
    }))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
}

export function PermissionMatrix({ permissions, value, onChange, disabled = false }: PermissionMatrixProps) {
  const groups = useMemo(() => groupPermissions(permissions ?? []), [permissions]);

  const togglePermission = (slug: Permission, enabled: boolean) => {
    if (enabled) {
      const next = Array.from(new Set([...value, slug]));
      onChange(next);
    } else {
      onChange(value.filter((item) => item !== slug));
    }
  };

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
        No hay permisos configurados en el backend.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {groups.map((group) => (
        <Card key={group.key} className="border-border/60">
          <CardHeader className="py-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span>{group.label}</span>
              <Badge variant="secondary" className="font-normal text-xs">
                {group.permissions.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {group.permissions.map((permission) => {
              const checked = value.includes(permission.slug);
              return (
                <label
                  key={permission.slug}
                  className="flex h-full items-start gap-3 rounded-md border border-border/60 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => togglePermission(permission.slug, Boolean(next))}
                    disabled={disabled}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium leading-none text-foreground">{permission.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {permission.description || permission.slug}
                    </p>
                  </div>
                </label>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
