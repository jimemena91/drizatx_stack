"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  apiClient,
  ApiError,
  type PermissionDefinition,
  type RoleWithPermissions,
} from "@/lib/api-client";
import type { Permission } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";

export type CreateRolePayload = {
  slug: string;
  name: string;
  description?: string | null;
  permissions?: Permission[];
};

export type UpdateRolePayload = {
  slug?: string;
  name?: string;
  description?: string | null;
};

export function useRoles() {
  const [roles, setRoles] = useState<RoleWithPermissions[]>([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState<PermissionDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state } = useAuth();

  const canManageRoles = useMemo(
    () => state.isAuthenticated && state.permissions.includes("manage_roles"),
    [state.isAuthenticated, state.permissions],
  );

  const refetch = useCallback(async () => {
    if (!canManageRoles) {
      setRoles([]);
      setPermissionsCatalog([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [rolesData, permissionsData] = await Promise.all([
        apiClient.getRolesWithPermissions(),
        apiClient.getPermissionsCatalog(),
      ]);
      setRoles(rolesData);
      setPermissionsCatalog(permissionsData);
    } catch (err: any) {
      const message =
        err instanceof ApiError ? err.message : err?.message ?? "No se pudieron cargar los roles";
      setRoles([]);
      setPermissionsCatalog([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [canManageRoles]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refetch();
    }, 0);
    return () => clearTimeout(timer);
  }, [refetch, canManageRoles]);

  const createRole = useCallback(
    async (payload: CreateRolePayload) => {
      if (!canManageRoles) {
        throw new Error("No tiene permisos para gestionar roles.");
      }
      const created = await apiClient.createRole(payload);
      await refetch();
      return created;
    },
    [refetch, canManageRoles],
  );

  const updateRole = useCallback(
    async (id: number, payload: UpdateRolePayload) => {
      if (!canManageRoles) {
        throw new Error("No tiene permisos para gestionar roles.");
      }
      const updated = await apiClient.updateRole(id, payload);
      await refetch();
      return updated;
    },
    [refetch, canManageRoles],
  );

  const updateRolePermissions = useCallback(
    async (id: number, permissions: Permission[]) => {
      if (!canManageRoles) {
        throw new Error("No tiene permisos para gestionar roles.");
      }
      const updated = await apiClient.updateRolePermissions(id, permissions);
      await refetch();
      return updated;
    },
    [refetch, canManageRoles],
  );

  return {
    roles,
    permissionsCatalog,
    loading,
    error,
    refetch,
    createRole,
    updateRole,
    updateRolePermissions,
  };
}
