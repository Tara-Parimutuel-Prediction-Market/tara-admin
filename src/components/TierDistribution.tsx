import React, { useEffect, useState } from "react"
import { Trophy } from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"
import { TIERS, tierColor } from "../lib/tiers"

interface Row {
  tier: string
  label: string
  /** Every account holding this rung. */
  count: number
  /** Of those, the ones with at least one resolved prediction. */
  ranked: number
}

interface Distribution {
  distribution: Row[]
  total: number
  totalRanked: number
}

/**
 * Headcount on each rung of the reputation ladder.
 *
 * Shows two numbers per rung on purpose. `reputationTier` defaults to 'rookie'
 * the moment an account is created, so the Rookie row is dominated by people
 * who have never placed a prediction at all. Reporting only the raw count would
 * read as a huge beginner cohort; `ranked` is the number who have actually
 * played, and the bar is scaled to that so the ladder's real shape is visible.
 */
export const TierDistribution: React.FC<{ token: string | null }> = ({
  token,
}) => {
  const api = useAdminApi(token)
  const [data, setData] = useState<Distribution | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    api
      .getUserTierDistribution()
      .then((r) => {
        if (!cancelled) setData(r)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (error)
    return (
      <div className="glass-card" style={{ padding: "1.5rem" }}>
        <h3 style={{ margin: 0 }}>Reputation Tiers</h3>
        <p style={{ color: "hsl(var(--destructive))", fontSize: "0.85rem" }}>
          Couldn't load tier distribution: {error}
        </p>
      </div>
    )

  if (!data)
    return (
      <div className="glass-card" style={{ padding: "1.5rem" }}>
        <h3 style={{ margin: 0 }}>Reputation Tiers</h3>
        <p
          style={{
            color: "hsl(var(--muted-foreground))",
            fontSize: "0.85rem",
          }}
        >
          Loading…
        </p>
      </div>
    )

  // Scale bars to the biggest *ranked* rung, not to the total. Rookie's raw
  // count is an order of magnitude larger than every other rung put together,
  // so scaling to it would flatten the rest of the ladder into invisible slivers.
  const peak = Math.max(...data.distribution.map((d) => d.ranked), 1)

  return (
    <div
      className="glass-card"
      style={{ padding: "1.5rem", marginTop: "2rem" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.35rem",
        }}
      >
        <h3 style={{ margin: 0 }}>Reputation Tiers</h3>
        <Trophy size={20} color="hsl(var(--primary))" />
      </div>
      <p
        style={{
          margin: "0 0 1.25rem",
          fontSize: "0.8rem",
          color: "hsl(var(--muted-foreground))",
        }}
      >
        {data.totalRanked.toLocaleString()} of {data.total.toLocaleString()}{" "}
        users have a resolved prediction. Bars show ranked users; the grey
        figure is everyone on that rung.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.distribution.map((row) => {
          const unranked = row.count - row.ranked
          return (
            <div
              key={row.tier}
              style={{ display: "flex", alignItems: "center", gap: 12 }}
              title={
                TIERS[row.tier]?.requirement ??
                "Not a rung the current ladder defines"
              }
            >
              <span
                style={{
                  width: 110,
                  flexShrink: 0,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: tierColor(row.tier),
                }}
              >
                {row.label}
              </span>

              <div
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 999,
                  background: "hsl(var(--background))",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(row.ranked / peak) * 100}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: tierColor(row.tier),
                    // A rung with nobody on it still reads as a row, which is
                    // the point — an empty Legend is a finding.
                    minWidth: row.ranked > 0 ? 2 : 0,
                  }}
                />
              </div>

              <span
                style={{
                  width: 96,
                  flexShrink: 0,
                  textAlign: "right",
                  fontSize: "0.8rem",
                  fontVariantNumeric: "tabular-nums",
                  color: "hsl(var(--foreground))",
                }}
              >
                {row.ranked.toLocaleString()}
                {unranked > 0 && (
                  <span style={{ color: "hsl(var(--muted-foreground))" }}>
                    {" "}
                    / {row.count.toLocaleString()}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
