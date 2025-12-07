"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { apiClient, ApiError, type AuditLogListParams } from "@/lib/api-client"
import type { AuditLogListMeta, AuditLogRecord } from "@/lib/types"
import { isApiMode } from "@/lib/api-mode"

type UseAuditLogsOptions = {
  auto?: boolean
  initialParams?: AuditLogListParams
}

type FetchOptions = {
  signal?: AbortSignal
}

export function useAuditLogs({ auto = true, initialParams = {} }: UseAuditLogsOptions = {}) {
  const [records, setRecords] = useState<AuditLogRecord[]>([])
  const [meta, setMeta] = useState<AuditLogListMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paramsRef = useRef<AuditLogListParams>({ ...initialParams })
  const apiEnabled = useMemo(() => isApiMode(), [])

  const fetchLogs = useCallback(
    async (override: AuditLogListParams = {}, options: FetchOptions = {}) => {
      if (!apiEnabled) {
        setRecords([])
        setMeta(null)
        return null
      }

      const nextParams = { ...paramsRef.current, ...override }
      paramsRef.current = nextParams

      try {
        setLoading(true)
        setError(null)
        const response = await apiClient.getAuditLogs(nextParams, { signal: options.signal })
        setRecords(response.data)
        setMeta(response.meta)
        return response
      } catch (err) {
        if ((err as any)?.name === "AbortError") {
          return null
        }
        const message =
          err instanceof ApiError
            ? err.message
            : "No se pudieron obtener los registros de auditoría."
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [apiEnabled],
  )

  useEffect(() => {
    paramsRef.current = { ...initialParams }
    if (!auto) return
    const controller = new AbortController()
    fetchLogs(initialParams, { signal: controller.signal }).catch(() => undefined)
    return () => controller.abort()
  }, [auto, fetchLogs, initialParams])

  const setParams = useCallback((next: AuditLogListParams) => {
    paramsRef.current = { ...paramsRef.current, ...next }
  }, [])

  return {
    apiEnabled,
    records,
    meta,
    loading,
    error,
    params: paramsRef.current,
    setParams,
    fetch: fetchLogs,
  }
}
