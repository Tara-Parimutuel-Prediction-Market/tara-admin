import { useEffect, useState, useCallback, useMemo } from "react"

// Backend uses a global /api prefix — strip the trailing /admin from the env var
// then re-add /api so all requests go to /api/admin/...
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/admin").replace(
    /\/admin$/,
    ""
  ) + // strip trailing /admin added by env
  "/api" // add the NestJS global prefix

export function useAdminApi(token: string | null) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const apiFetch = useCallback(
    async (path: string, options: RequestInit = {}) => {
      if (!token) throw new Error("No admin token provided")
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_BASE}${path}`, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(
            errorData.message || `API Request Failed: ${response.status}`
          )
        }
        // 204 No Content or empty body — return null instead of crashing
        const contentType = response.headers.get("content-type") ?? ""
        const contentLength = response.headers.get("content-length")
        if (
          response.status === 204 ||
          contentLength === "0" ||
          !contentType.includes("application/json")
        ) {
          return null
        }
        return response.json().catch(() => null)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [token]
  )

  const api = useMemo(
    () => ({
      getMarkets: () => apiFetch("/admin/markets"),
      createMarket: (data: Record<string, unknown>) =>
        apiFetch("/admin/markets", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      updateMarket: (id: string, data: Record<string, unknown>) =>
        apiFetch(`/markets/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }),
      deleteMarket: (id: string) =>
        apiFetch(`/admin/markets/${id}`, { method: "DELETE" }),
      transitionMarket: (id: string, status: string) =>
        apiFetch(`/admin/markets/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
      proposeMarket: (id: string, proposedOutcomeId: string) =>
        apiFetch(`/admin/markets/${id}/propose`, {
          method: "POST",
          body: JSON.stringify({ proposedOutcomeId }),
        }),
      resolveMarket: (id: string, winningOutcomeId: string) =>
        apiFetch(`/admin/markets/${id}/resolve`, {
          method: "POST",
          body: JSON.stringify({ winningOutcomeId }),
        }),
      cancelMarket: (id: string) =>
        apiFetch(`/admin/markets/${id}/cancel`, { method: "POST" }),
      getMarketDisputes: (id: string) =>
        apiFetch(`/admin/markets/${id}/disputes`),
      getPool: (id: string) => apiFetch(`/admin/markets/${id}/pool`),
      getSettlements: () => apiFetch("/admin/settlements"),
      getPayments: () => apiFetch("/admin/payments"),
      getUsers: (params?: {
        search?: string
        role?: "all" | "admin" | "user"
        dkStatus?: "all" | "linked" | "unlinked"
        sortField?: "name" | "balance" | "streak" | "joined"
        sortDir?: "asc" | "desc"
        page?: number
        limit?: number
      }) => {
        const qs = new URLSearchParams()
        if (params?.search) qs.set("search", params.search)
        if (params?.role && params.role !== "all") qs.set("role", params.role)
        if (params?.dkStatus && params.dkStatus !== "all")
          qs.set("dkStatus", params.dkStatus)
        if (params?.sortField) qs.set("sortField", params.sortField)
        if (params?.sortDir) qs.set("sortDir", params.sortDir)
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/admin/users${suffix}`)
      },
      getAuditLogs: (params?: {
        page?: number
        limit?: number
        action?: string
        adminId?: string
        entityType?: string
        search?: string
        from?: string
        to?: string
      }) => {
        const qs = new URLSearchParams()
        if (params?.page) qs.set("page", String(params.page))
        if (params?.limit) qs.set("limit", String(params.limit))
        if (params?.action && params.action !== "all")
          qs.set("action", params.action)
        if (params?.adminId) qs.set("adminId", params.adminId)
        if (params?.entityType && params.entityType !== "all")
          qs.set("entityType", params.entityType)
        if (params?.search) qs.set("search", params.search)
        if (params?.from) qs.set("from", params.from)
        if (params?.to) qs.set("to", params.to)
        const suffix = qs.toString() ? `?${qs.toString()}` : ""
        return apiFetch(`/admin/audit-logs${suffix}`)
      },
      getAuditAdmins: () => apiFetch("/admin/audit-logs/admins"),
      getAuditLogsByAdmin: (adminId: string) =>
        apiFetch(`/admin/audit-logs/admin/${adminId}`),
      getAuditLogsByEntity: (entityId: string) =>
        apiFetch(`/admin/audit-logs/entity/${entityId}`),
      toggleAdmin: (userId: string, isAdmin: boolean) =>
        apiFetch(`/admin/users/${userId}/admin`, {
          method: "PATCH",
          body: JSON.stringify({ isAdmin }),
        }),
      loginWithDevSecret: async (secret: string) => {
        const response = await fetch(
          `${API_BASE}/auth/dev/admin-token?secret=${secret}`
        )
        if (!response.ok) throw new Error("Invalid Secret")
        return response.json()
      },
    }),
    [apiFetch]
  )

  return {
    loading,
    error,
    ...api,
  }
}

// Convenience hook for fetching markets initially
export function useAdminMarkets(token: string | null) {
  const { getMarkets, loading, error } = useAdminApi(token)
  const [markets, setMarkets] = useState<Record<string, unknown>[]>([])

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const res = await getMarkets()
      setMarkets(res as Record<string, unknown>[])
    } catch {
      // Error handled by useAdminApi state
    }
  }, [getMarkets, token])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return { markets, loading, error, refresh }
}
