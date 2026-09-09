import React, { useEffect, useState, useRef } from "react"
import { useAdminApi } from "../lib/useAdminApi"
import { UserDossier } from "../components/UserDossier"
import { Search, X, AlertTriangle, Swords } from "lucide-react"

/**
 * Duels (the `challenges` table), read-only.
 *
 * Duels were the one product surface with no admin view at all: the money
 * appeared in the ledger as duel_wager / duel_payout rows, but nothing said who
 * challenged whom or how it ended.
 *
 * The reason this page leads with "stuck" is that cancelMarket() never calls
 * settleByMarket(), so a duel on a cancelled market is never settled, expired
 * or refunded — both wagers stay debited with no code path back. Those rows are
 * money the platform is holding that belongs to two users.
 */

// Mirrored from ChallengeStatus in the backend entity. NOT an enum: the admin
// tsconfig sets erasableSyntaxOnly, which forbids them.
const DUEL_STATUSES = ["open", "active", "settled", "expired", "void"] as const
type DuelStatus = (typeof DUEL_STATUSES)[number]

/** The five states map onto badge classes index.css already defines. */
const STATUS_BADGE: Record<string, string> = {
  open: "badge-open",
  active: "badge-resolved",
  settled: "badge-upcoming",
  expired: "badge-closed",
  void: "badge-cancelled",
}

interface DuelParty {
  id: string
  username: string | null
  firstName: string | null
}

interface Duel {
  id: string
  status: DuelStatus
  wagerAmount: number
  pot: number
  platformFee: number
  feeWaived: boolean
  currency: string
  equippedCard: string | null
  createdAt: string
  settledAt: string | null
  winnerId: string | null
  creator: DuelParty | null
  joiner: DuelParty | null
  market: { id: string; title: string; status: string } | null
  outcome: { id: string; label: string } | null
  stuck: boolean
}

interface DuelSummary {
  counts: Record<string, number>
  total: number
  totalStaked: number
  stuckCount: number
  stuckLocked: number
}

const PAGE_SIZE = 20

/**
 * No shared money formatter exists in this app — every page rolls its own.
 * This follows the FinancePage pair: ngultrum with no decimals, USDT with two.
 */
function fmtMoney(value: number, currency: string): string {
  if (currency === "USDT") {
    return `$${new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value || 0)}`
  }
  return `Nu. ${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value || 0)}`
}

/** "@alice", else a first name, else a shortened id. Never blank. */
function partyName(p: DuelParty | null): string {
  if (!p) return "—"
  if (p.username) return `@${p.username}`
  return p.firstName || `${p.id.slice(0, 8)}…`
}

const DuelsPage: React.FC = () => {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [duels, setDuels] = useState<Duel[]>([])
  const [summary, setSummary] = useState<DuelSummary | null>(null)
  const [initialLoad, setInitialLoad] = useState(true)
  const [fetching, setFetching] = useState(false)

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [stuckOnly, setStuckOnly] = useState(false)
  const [page, setPage] = useState(1)

  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)

  const [dossierUserId, setDossierUserId] = useState<string | null>(null)

  // useAdminApi returns a new object every render, so depending on it directly
  // would re-fire the effect forever. The house workaround is a stable ref.
  const getDuelsRef = useRef(api.getDuels)
  useEffect(() => {
    getDuelsRef.current = api.getDuels
  })

  useEffect(() => {
    let cancelled = false
    // Raising the in-flight flag as the request starts is the point of the
    // flag; the rule's concern (cascading renders) does not apply to a single
    // boolean that settles in .finally(). UserManagement does exactly this —
    // it escapes the rule only because its 1000-line body defeats the
    // analysis, not because it is written differently.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetching(true)

    getDuelsRef
      .current({
        search,
        status: statusFilter,
        stuck: stuckOnly,
        page,
        limit: PAGE_SIZE,
      })
      .then((res: unknown) => {
        if (cancelled) return
        const r = res as {
          data: Duel[]
          total: number
          pages: number
          summary: DuelSummary
        }
        setDuels(r.data)
        setTotal(r.total)
        setPages(r.pages)
        setSummary(r.summary)
      })
      .catch((e: unknown) => {
        if (!cancelled) console.error("Failed to fetch duels", e)
      })
      .finally(() => {
        if (!cancelled) {
          setFetching(false)
          setInitialLoad(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [search, statusFilter, stuckOnly, page])

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1)
      setSearch(searchInput)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  const hasFilters = !!search.trim() || statusFilter !== "all" || stuckOnly

  const inputStyle: React.CSSProperties = {
    background: "hsl(var(--background))",
    border: "none",
    borderRadius: 8,
    padding: "7px 12px",
    color: "hsl(var(--foreground))",
    fontSize: "0.85rem",
    boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
    outline: "none",
    fontFamily: "inherit",
  }

  const thStyle: React.CSSProperties = {
    padding: "1rem",
    textAlign: "left",
    fontWeight: 600,
    color: "hsl(var(--muted-foreground))",
    textTransform: "uppercase",
    fontSize: "0.75rem",
    letterSpacing: "0.05em",
  }

  const tdStyle: React.CSSProperties = { padding: "1rem" }
  const muted: React.CSSProperties = {
    color: "hsl(var(--muted-foreground))",
    fontSize: "0.75rem",
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Duels</h2>
          <p style={{ margin: "4px 0 0", ...muted, fontSize: "0.875rem" }}>
            {total} duels match · page {page} of {pages}
          </p>
        </div>
      </div>

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      {summary && (
        <div className="stat-grid" style={{ marginBottom: "1.5rem" }}>
          <div className="stat-card">
            <div style={muted}>ALL DUELS</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
              {summary.total}
            </div>
            <div style={muted}>
              {fmtMoney(summary.totalStaked, "BTN")} staked in total
            </div>
          </div>

          {DUEL_STATUSES.map((s) => (
            <div className="stat-card" key={s}>
              <div style={muted}>{s.toUpperCase()}</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                {summary.counts[s] ?? 0}
              </div>
            </div>
          ))}

          {/* The tile that matters. Clicking it filters to the problem. */}
          <div
            className="stat-card"
            onClick={() => {
              setStuckOnly(true)
              setPage(1)
            }}
            title="Show only these"
            style={{
              cursor: "pointer",
              border:
                summary.stuckCount > 0
                  ? "1px solid hsl(var(--destructive))"
                  : undefined,
            }}
          >
            <div
              style={{
                ...muted,
                color:
                  summary.stuckCount > 0
                    ? "hsl(var(--destructive))"
                    : muted.color,
              }}
            >
              STUCK
            </div>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                color:
                  summary.stuckCount > 0
                    ? "hsl(var(--destructive))"
                    : undefined,
              }}
            >
              {summary.stuckCount}
            </div>
            <div style={muted}>
              {fmtMoney(summary.stuckLocked, "BTN")} locked
            </div>
          </div>
        </div>
      )}

      {summary && summary.stuckCount > 0 && (
        <div
          className="glass-card"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            marginBottom: "1.5rem",
            padding: "1rem",
            border: "1px solid hsl(var(--destructive))",
          }}
        >
          <AlertTriangle
            size={16}
            color="hsl(var(--destructive))"
            style={{ flexShrink: 0, marginTop: 2 }}
          />
          <div style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>
            <strong>
              {summary.stuckCount} duel{summary.stuckCount === 1 ? "" : "s"} on
              cancelled markets, holding {fmtMoney(summary.stuckLocked, "BTN")}.
            </strong>
            <div style={{ ...muted, marginTop: 3 }}>
              Cancelling a market refunds its positions but does not settle its
              duels, so these will never resolve or refund on their own. Both
              players remain debited.
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "hsl(var(--muted-foreground))",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search duel id, market title, @username…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ ...inputStyle, width: "100%", paddingLeft: 30 }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}
          style={inputStyle}
        >
          <option value="all">All Statuses</option>
          {DUEL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            setStuckOnly((v) => !v)
            setPage(1)
          }}
          className="secondary"
          style={{
            padding: "7px 12px",
            fontSize: "0.8rem",
            display: "flex",
            alignItems: "center",
            gap: 5,
            color: stuckOnly ? "hsl(var(--destructive))" : undefined,
          }}
        >
          <AlertTriangle size={13} />
          {stuckOnly ? "Stuck only" : "Show stuck"}
        </button>

        {hasFilters && (
          <button
            onClick={() => {
              setSearchInput("")
              setSearch("")
              setStatusFilter("all")
              setStuckOnly(false)
              setPage(1)
            }}
            className="secondary"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: "0.8rem",
              padding: "7px 12px",
            }}
          >
            <X size={13} /> Clear
          </button>
        )}

        <span style={{ marginLeft: "auto", ...muted, fontSize: "0.8rem" }}>
          {duels.length} shown · {total} total
        </span>
      </div>

      {/* Indeterminate strip, always present so the layout never jumps. */}
      <div
        style={{
          height: 3,
          borderRadius: 2,
          marginBottom: "1rem",
          background: "hsl(var(--background))",
          boxShadow: "0 0 15px hsla(var(--primary), 0.1)",
          overflow: "hidden",
        }}
      >
        {fetching && (
          <div
            style={{
              height: "100%",
              width: "40%",
              background: "hsl(var(--primary))",
              borderRadius: 2,
              animation: "slideBar 1s ease-in-out infinite alternate",
            }}
          />
        )}
      </div>
      <style>{`
        @keyframes slideBar {
          from { margin-left: 0%; }
          to   { margin-left: 60%; }
        }
      `}</style>

      {initialLoad ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          Retrieving duels...
        </div>
      ) : duels.length === 0 ? (
        <div
          className="glass-card"
          style={{
            padding: "3rem",
            textAlign: "center",
            color: "hsl(var(--muted-foreground))",
          }}
        >
          {hasFilters ? "No duels match your filters." : "No duels yet."}
        </div>
      ) : (
        <div
          className="glass-card"
          style={{
            position: "relative",
            pointerEvents: fetching ? "none" : "auto",
            padding: 0,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "1100px",
                fontSize: "0.85rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid hsla(var(--foreground), 0.1)",
                    backgroundColor: "hsla(var(--background), 0.5)",
                  }}
                >
                  <th style={thStyle}>Duel</th>
                  <th style={thStyle}>Players</th>
                  <th style={thStyle}>Market · Defending</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Stake</th>
                  <th style={thStyle}>Card</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {duels.map((d) => (
                  <tr
                    key={d.id}
                    style={{
                      borderBottom: "1px solid hsla(var(--foreground), 0.05)",
                      transition: "background-color 0.2s ease",
                      // Stuck money should be impossible to scroll past.
                      borderLeft: d.stuck
                        ? "3px solid hsl(var(--destructive))"
                        : "3px solid transparent",
                    }}
                  >
                    <td style={tdStyle}>
                      <div
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.68rem",
                          color: "hsl(var(--muted-foreground))",
                        }}
                        title={d.id}
                      >
                        {d.id.slice(0, 12)}…
                      </div>
                      {d.stuck && (
                        <span
                          className="badge badge-cancelled"
                          style={{ marginTop: 4, display: "inline-block" }}
                        >
                          Stuck
                        </span>
                      )}
                    </td>

                    <td style={tdStyle}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <Party
                          party={d.creator}
                          winnerId={d.winnerId}
                          onOpen={setDossierUserId}
                        />
                        <Swords
                          size={12}
                          style={{ color: "hsl(var(--muted-foreground))" }}
                        />
                        <Party
                          party={d.joiner}
                          winnerId={d.winnerId}
                          onOpen={setDossierUserId}
                        />
                      </div>
                      {d.status === "settled" && !d.winnerId && (
                        <div style={muted}>No winner recorded</div>
                      )}
                    </td>

                    <td style={{ ...tdStyle, maxWidth: 280 }}>
                      <div style={{ fontSize: "0.8rem" }}>
                        {d.market?.title ?? "—"}
                      </div>
                      <div style={muted}>
                        {d.outcome?.label ?? "—"}
                        {d.market && d.market.status !== "open" && (
                          <> · market {d.market.status}</>
                        )}
                      </div>
                    </td>

                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ fontWeight: 600 }}>
                        {fmtMoney(d.wagerAmount, d.currency)}
                      </div>
                      <div style={muted}>
                        pot {fmtMoney(d.pot, d.currency)} · fee{" "}
                        {d.feeWaived
                          ? "0"
                          : fmtMoney(d.platformFee, d.currency)}
                      </div>
                    </td>

                    <td style={tdStyle}>
                      {d.equippedCard ? (
                        <span className="badge badge-upcoming">
                          {d.equippedCard}
                        </span>
                      ) : (
                        <span style={muted}>—</span>
                      )}
                    </td>

                    <td style={tdStyle}>
                      <span
                        className={`badge ${
                          STATUS_BADGE[d.status] ?? "badge-upcoming"
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>

                    <td style={tdStyle}>
                      <div style={{ fontSize: "0.78rem" }}>
                        {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                      {d.settledAt && (
                        <div style={muted}>
                          settled {new Date(d.settledAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {total > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: "2rem",
            flexWrap: "wrap",
          }}
        >
          <button
            className="secondary"
            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
            onClick={() => setPage(1)}
            disabled={page === 1 || fetching}
          >
            «
          </button>
          <button
            className="secondary"
            style={{ padding: "6px 14px", fontSize: "0.8rem" }}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || fetching}
          >
            ‹ Prev
          </button>

          {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
            let start = Math.max(1, page - 3)
            const end = Math.min(pages, start + 6)
            start = Math.max(1, end - 6)
            return start + i
          }).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              disabled={fetching}
              style={{
                padding: "6px 12px",
                fontSize: "0.8rem",
                borderRadius: 8,
                border: "none",
                cursor: fetching ? "default" : "pointer",
                background:
                  p === page ? "hsl(var(--primary))" : "hsl(var(--background))",
                color:
                  p === page
                    ? "hsl(var(--primary-foreground))"
                    : "hsl(var(--foreground))",
                boxShadow:
                  p === page
                    ? "0 0 15px hsla(var(--primary), 0.1)"
                    : "var(--glass-shadow)",
                fontWeight: p === page ? 700 : 400,
                fontFamily: "inherit",
                opacity: fetching ? 0.6 : 1,
                transition: "all 0.15s ease",
              }}
            >
              {p}
            </button>
          ))}

          <button
            className="secondary"
            style={{ padding: "6px 14px", fontSize: "0.8rem" }}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages || fetching}
          >
            Next ›
          </button>
          <button
            className="secondary"
            style={{ padding: "6px 12px", fontSize: "0.8rem" }}
            onClick={() => setPage(pages)}
            disabled={page === pages || fetching}
          >
            »
          </button>

          <span style={{ ...muted, marginLeft: 4 }}>
            {`Page ${page} / ${pages} · ${total} duels`}
          </span>
        </div>
      )}

      <UserDossier
        key={dossierUserId}
        userId={dossierUserId}
        onClose={() => setDossierUserId(null)}
      />
    </div>
  )
}

/**
 * One player. Clickable through to their dossier, which is the only
 * cross-entity drill-down this app has — there is no page-to-page navigation.
 */
const Party: React.FC<{
  party: DuelParty | null
  winnerId: string | null
  onOpen: (id: string) => void
}> = ({ party, winnerId, onOpen }) => {
  if (!party)
    return (
      <span style={{ color: "hsl(var(--muted-foreground))" }}>no opponent</span>
    )
  const won = winnerId === party.id
  return (
    <span
      onClick={() => onOpen(party.id)}
      title="Open dossier"
      style={{
        cursor: "pointer",
        textDecoration: "underline",
        textUnderlineOffset: 3,
        fontWeight: won ? 700 : 400,
        color: won ? "hsl(var(--primary))" : "hsl(var(--foreground))",
      }}
    >
      {partyName(party)}
      {won && " ★"}
    </span>
  )
}

export default DuelsPage
