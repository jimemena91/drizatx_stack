"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useQueue } from "@/contexts/queue-context"
import type { SystemSetting } from "@/lib/types"
import { apiClient, ApiError } from "@/lib/api-client"

function normalizeSetting(raw: any): SystemSetting {
  return {
    id: Number(raw?.id ?? Date.now()),
    key: String(raw?.key ?? ""),
    value: String(raw?.value ?? ""),
    description: raw?.description ?? null,
    updatedAt: raw?.updatedAt ? new Date(raw.updatedAt) : new Date(),
  }
}

export type UseSystemSettingsOptions = {
  publicMode?: boolean
}

export function useSystemSettings(options: UseSystemSettingsOptions = {}) {
  const { state, dispatch, isApiMode } = useQueue()
  const { publicMode = false } = options
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())

  const setSavingState = useCallback((key: string, enabled: boolean) => {
    setSavingKeys((prev) => {
      const next = new Set(prev)
      if (enabled) {
        next.add(key)
      } else {
        next.delete(key)
      }
      return next
    })
  }, [])

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (isApiMode) {
        const data = publicMode
          ? await apiClient.getPublicSystemSettings()
          : await apiClient.getSystemSettings()
        const normalized = (data ?? []).map(normalizeSetting)
        setSettings(normalized)
        dispatch({ type: "SET_SETTINGS", payload: normalized })
      } else {
        setSettings((state.settings ?? []).map(normalizeSetting))
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Error al obtener la configuración"
      setError(message)
      console.error("[useSystemSettings] fetch error", err)
      if (!isApiMode) {
        setSettings((state.settings ?? []).map(normalizeSetting))
      }
    } finally {
      setLoading(false)
    }
  }, [dispatch, isApiMode, publicMode, state.settings])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  useEffect(() => {
    if (!isApiMode) {
      setSettings((state.settings ?? []).map(normalizeSetting))
    }
  }, [isApiMode, state.settings])

  const upsertSetting = useCallback(
    async (key: string, value: string, description?: string | null) => {
      setSavingState(key, true)
      try {
        let saved: SystemSetting

        if (isApiMode) {
          const payload = await apiClient.upsertSystemSetting(key, value, description)
          saved = normalizeSetting(payload)
        } else {
          const existing = state.settings.find((item) => item.key === key)
          saved = normalizeSetting({
            ...(existing ?? {}),
            id: existing?.id ?? Date.now(),
            key,
            value,
            description: description ?? existing?.description ?? null,
            updatedAt: new Date(),
          })
        }

        setSettings((prev) => {
          const exists = prev.some((item) => item.key === key)
          if (exists) {
            return prev.map((item) => (item.key === key ? saved : item))
          }
          return [...prev, saved]
        })

        dispatch({ type: "UPDATE_SETTING", payload: { key, value: saved.value } })

        return saved
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "No se pudo guardar la configuración"
        setError(message)
        console.error("[useSystemSettings] upsert error", err)
        throw err
      } finally {
        setSavingState(key, false)
      }
    },
    [dispatch, isApiMode, setSavingState, state.settings],
  )

  const bulkUpsert = useCallback(
    async (entries: Array<{ key: string; value: string; description?: string | null }>) => {
      const results: SystemSetting[] = []
      for (const entry of entries) {
        const saved = await upsertSetting(entry.key, entry.value, entry.description)
        results.push(saved)
      }
      return results
    },
    [upsertSetting],
  )

  const getSetting = useCallback(
    (key: string, defaultValue = "") => {
      const found = settings.find((item) => item.key === key)
      return found?.value ?? defaultValue
    },
    [settings],
  )

  const getBoolean = useCallback(
    (key: string, defaultValue = false) => {
      const value = getSetting(key, String(defaultValue))
      const normalized = value.trim().toLowerCase()
      if (["true", "1", "yes", "si", "sí", "on"].includes(normalized)) return true
      if (["false", "0", "no", "off"].includes(normalized)) return false
      return defaultValue
    },
    [getSetting],
  )

  const saving = useMemo(() => savingKeys.size > 0, [savingKeys])

  return {
    settings,
    loading,
    error,
    saving,
    savingKeys,
    refresh: fetchSettings,
    upsertSetting,
    bulkUpsert,
    getSetting,
    getBoolean,
  }
}
