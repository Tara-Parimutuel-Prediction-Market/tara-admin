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
      } catch (e: any) {
        setError(e.message)
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
      createMarket: (data: any) =>
        apiFetch("/admin/markets", {
          method: "POST",
          body: JSON.stringify(data),
        }),
      updateMarket: (id: string, data: any) =>
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
      getUsers: () => apiFetch("/admin/users"),
      getAuditLogs: (limit?: number) =>
        apiFetch(`/admin/audit-logs${limit ? `?limit=${limit}` : ""}`),
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
  const [markets, setMarkets] = useState<any[]>([])

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const data = await getMarkets()
      setMarkets(data)
    } catch (e: any) {
      // Error handled by useAdminApi state
    }
  }, [getMarkets, token])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { markets, loading, error, refresh }
}
