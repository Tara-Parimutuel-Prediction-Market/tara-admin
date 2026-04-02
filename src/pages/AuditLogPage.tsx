import { useEffect, useState } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import {
  Shield,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Scale,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  Banknote,
  UserCheck,
  HelpCircle,
  type LucideIcon,
} from "lucide-react"

interface AuditPayload {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  meta?: Record<string, unknown>
}

interface AuditLog {
  id: string
  adminId: string
  adminUsername: string | null
  action: string
  entityType: string | null
  entityId: string | null
  payload: AuditPayload | null
  ipAddress: string | null
  createdAt: string
}

const ACTION_COLOR: Record<string, string> = {
  "market.create": "#22c55e",
  "market.transition": "#3b82f6",
  "market.propose": "#f59e0b",
  "market.resolve": "#8b5cf6",
  "market.cancel": "#ef4444",
  "market.delete": "#dc2626",
  "market.update": "#64748b",
  "balance.credit": "#06b6d4",
  "user.admin_toggle": "#f97316",
}

const ACTION_ICON: Record<string, LucideIcon> = {
  "market.create": Plus,
  "market.transition": ArrowRight,
  "market.propose": Scale,
  "market.resolve": CheckCircle2,
  "market.cancel": XCircle,
  "market.delete": Trash2,
  "market.update": Pencil,
  "balance.credit": Banknote,
  "user.admin_toggle": UserCheck,
}

function JsonDiff({
  before,
  after,
}: {
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}) {
  if (!before && !after) return null
  const keys = Array.from(
    new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  )
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {keys.map((k) => {
        const bVal = before?.[k]
        const aVal = after?.[k]
        const changed = JSON.stringify(bVal) !== JSON.stringify(aVal)
        return (
          <div
            key={k}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              fontSize: "0.78rem",
            }}
          >
            <span
              style={{
                color: "hsl(var(--muted-foreground))",
                minWidth: 120,
                fontFamily: "monospace",
              }}
            >
              {k}
            </span>
            {bVal !== undefined && (
              <span
                style={{
                  background: changed
                    ? "rgba(239,68,68,0.12)"
                    : "hsl(var(--muted)/0.3)",
                  color: changed ? "#ef4444" : "hsl(var(--muted-foreground))",
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontFamily: "monospace",
                  textDecoration: changed ? "line-through" : "none",
                }}
              >
                {JSON.stringify(bVal)}
              </span>
            )}
            {changed && aVal !== undefined && (
              <>
                <span style={{ color: "hsl(var(--muted-foreground))" }}>→</span>
                <span
                  style={{
                    background: "rgba(34,197,94,0.12)",
                    color: "#22c55e",
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontFamily: "monospace",
                  }}
                >
                  {JSON.stringify(aVal)}
                </span>
              </>
            )}
            {bVal === undefined && aVal !== undefined && (
              <span
                style={{
                  background: "rgba(34,197,94,0.12)",
                  color: "#22c55e",
                  padding: "1px 6px",
                  borderRadius: 4,
                  fontFamily: "monospace",
                }}
              >
                {JSON.stringify(aVal)}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false)
  const color = ACTION_COLOR[log.action] ?? "#64748b"
  const ActionIcon: LucideIcon = ACTION_ICON[log.action] ?? HelpCircle
  const hasMeta = !!(
    log.payload?.before ||
    log.payload?.after ||
    log.payload?.meta
  )

  return (
    <>
      <tr
        onClick={() => hasMeta && setExpanded(!expanded)}
        style={{
          cursor: hasMeta ? "pointer" : "default",
          transition: "background 0.1s",
        }}
      >
        <td
          style={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            color: "hsl(var(--muted-foreground))",
            whiteSpace: "nowrap",
          }}
        >
          {new Date(log.createdAt).toLocaleString()}
        </td>
        <td>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.75rem",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 6,
              background: `${color}18`,
              color,
            }}
          >
            <ActionIcon size={14} color={color} /> {log.action}
          </span>
        </td>
        <td style={{ fontSize: "0.82rem", fontWeight: 600 }}>
          {log.adminUsername ?? log.adminId.slice(0, 8) + "…"}
        </td>
        <td
          style={{ fontSize: "0.78rem", color: "hsl(var(--muted-foreground))" }}
        >
          {String(log.payload?.meta?.title ?? log.entityId?.slice(0, 8) ?? "—")}
        </td>
        <td
          style={{
            fontSize: "0.75rem",
            color: "hsl(var(--muted-foreground))",
            fontFamily: "monospace",
          }}
        >
          {log.ipAddress ?? "—"}
        </td>
        <td style={{ textAlign: "center" }}>
          {hasMeta &&
            (expanded ? (
              <ChevronDown size={14} color="hsl(var(--muted-foreground))" />
            ) : (
              <ChevronRight size={14} color="hsl(var(--muted-foreground))" />
            ))}
        </td>
      </tr>
      {expanded && hasMeta && (
        <tr>
          <td
            colSpan={6}
            style={{
              padding: "0 1rem 1rem 2.5rem",
              background: "hsl(var(--muted)/0.15)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 32,
                flexWrap: "wrap",
                paddingTop: 12,
              }}
            >
              {(log.payload?.before || log.payload?.after) && (
                <div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      color: "hsl(var(--muted-foreground))",
                      marginBottom: 8,
                    }}
                  >
                    Changes
                  </div>
                  <JsonDiff
                    before={log.payload?.before}
                    after={log.payload?.after}
                  />
                </div>
              )}
              {log.payload?.meta &&
                Object.keys(log.payload.meta).length > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "hsl(var(--muted-foreground))",
                        marginBottom: 8,
                      }}
                    >
                      Context
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {Object.entries(log.payload.meta).map(([k, v]) => (
                        <div
                          key={k}
                          style={{
                            fontSize: "0.78rem",
                            display: "flex",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              color: "hsl(var(--muted-foreground))",
                              minWidth: 120,
                              fontFamily: "monospace",
                            }}
                          >
                            {k}
                          </span>
                          <span
                            style={{
                              fontFamily: "monospace",
                              color: "hsl(var(--foreground))",
                            }}
                          >
                            {JSON.stringify(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              <div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "hsl(var(--muted-foreground))",
                    marginBottom: 8,
                  }}
                >
                  IDs
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "monospace",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                  }}
                >
                  <div>
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>
                      log id{" "}
                    </span>{" "}
                    {log.id}
                  </div>
                  <div>
                    <span style={{ color: "hsl(var(--muted-foreground))" }}>
                      admin{" "}
                    </span>{" "}
                    {log.adminId}
                  </div>
                  {log.entityId && (
                    <div>
                      <span style={{ color: "hsl(var(--muted-foreground))" }}>
                        entity{" "}
                      </span>{" "}
                      {log.entityId}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function AuditLogPage() {
  const token = localStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filterAction, setFilterAction] = useState("all")
  const [limit, setLimit] = useState(200)
  const [loadTick, setLoadTick] = useState(0)

  const load = () => setLoadTick((t) => t + 1)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getAuditLogs(limit)
      .then((data: AuditLog[]) => {
        if (!cancelled) setLogs(data)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, loadTick])

  const allActions = Array.from(new Set(logs.map((l) => l.action))).sort()

  const filtered = logs.filter((l) => {
    const matchAction = filterAction === "all" || l.action === filterAction
    const matchSearch =
      !search ||
      l.action.includes(search.toLowerCase()) ||
      (l.adminUsername ?? "").toLowerCase().includes(search.toLowerCase()) ||
      String(l.payload?.meta?.title ?? "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (l.entityId ?? "").includes(search)
    return matchAction && matchSearch
  })

  // Stats
  const resolveCount = logs.filter((l) => l.action === "market.resolve").length
  const createCount = logs.filter((l) => l.action === "market.create").length
  // compute last-24h count at load time (stored in state so no impure call during render)
  const [last24h] = useState(
    () =>
      logs.filter(
        (l) => new Date(l.createdAt).getTime() > Date.now() - 86400000
      ).length
  )

  return (
    <div>
      {/* Header */}
      <div
        style={{
          marginBottom: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 4,
            }}
          >
            <Shield size={22} color="hsl(var(--primary))" />
            <h2 style={{ margin: 0 }}>Audit Log</h2>
          </div>
          <p
            style={{
              margin: 0,
              color: "hsl(var(--muted-foreground))",
              fontSize: "0.875rem",
            }}
          >
            Full tamper-evident trail of every admin action
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="secondary"
          style={{ display: "flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw
            size={14}
            style={{
              animation: loading ? "spin 0.8s linear infinite" : "none",
            }}
          />
          Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Total Actions",
            value: logs.length,
            color: "hsl(var(--primary))",
          },
          { label: "Last 24h", value: last24h, color: "#3b82f6" },
          { label: "Markets Created", value: createCount, color: "#22c55e" },
          { label: "Resolutions", value: resolveCount, color: "#8b5cf6" },
        ].map((s) => (
          <div
            key={s.label}
            className="glass-card"
            style={{ padding: "1rem", textAlign: "center" }}
          >
            <div
              style={{ fontSize: "1.6rem", fontWeight: 800, color: s.color }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
                marginTop: 2,
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        className="glass-card"
        style={{
          padding: "1rem",
          marginBottom: 16,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flex: 1,
            minWidth: 200,
          }}
        >
          <Search size={16} color="hsl(var(--muted-foreground))" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action, admin, market…"
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              width: "100%",
              color: "hsl(var(--foreground))",
              fontSize: "0.875rem",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Filter size={16} color="hsl(var(--muted-foreground))" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{
              background: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 6,
              padding: "4px 8px",
              fontSize: "0.8rem",
            }}
          >
            <option value="all">All actions</option>
            {allActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div
          style={{ fontSize: "0.78rem", color: "hsl(var(--muted-foreground))" }}
        >
          {filtered.length} of {logs.length} entries
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading && (
          <div
            style={{
              padding: "3rem",
              textAlign: "center",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Loading audit trail…
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              color: "hsl(var(--destructive))",
            }}
          >
            Error: {error}
          </div>
        )}
        {!loading && !error && (
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Admin</th>
                <th>Target</th>
                <th>IP</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: "3rem",
                      color: "hsl(var(--muted-foreground))",
                    }}
                  >
                    No audit entries found.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => <LogRow key={log.id} log={log} />)
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Load more */}
      {!loading && logs.length >= limit && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            className="secondary"
            onClick={() => setLimit((l) => l + 200)}
          >
            Load more (showing {limit})
          </button>
        </div>
      )}
    </div>
  )
}

export default AuditLogPage
