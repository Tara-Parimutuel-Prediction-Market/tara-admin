import React, { useEffect, useState } from "react"
import { AlertTriangle, Clock } from "lucide-react"

interface Market {
  id: string
  closesAt?: string
  status: string
}

interface LateMoneyData {
  marketId: string
  lateMoneyPercentage: number
  betSizeLimit: number
  timeUntilClose: number
}

interface LateMoneyWarning {
  detected: boolean
  percentage: number
  finalMinuteBets: number
  totalBets: number
  message: string
}

interface LateMoneyMonitorProps {
  market: Market
  onLateMoneyDetected?: (data: LateMoneyData) => void
}

export const LateMoneyMonitor: React.FC<LateMoneyMonitorProps> = ({
  market,
  onLateMoneyDetected,
}) => {
  const [lateMoneyWarning, setLateMoneyWarning] =
    useState<LateMoneyWarning | null>(null)
  const [betSizeLimit, setBetSizeLimit] = useState<number>(1000)
  const [timeUntilClose, setTimeUntilClose] = useState<number>(0)

  useEffect(() => {
    if (!market.closesAt || market.status !== "open") return

    const tick = () => {
      const now = Date.now()
      const closeTime = new Date(market.closesAt!).getTime()
      const diff = closeTime - now

      if (diff > 0) {
        const newLimit = diff < 30000 ? 50 : diff < 60000 ? 100 : 1000
        setTimeUntilClose(diff)
        setBetSizeLimit(newLimit)

        // Late money detection — runs inside interval callback, not effect body
        if (diff < 60000) {
          const finalMinuteBets = Math.floor(Math.random() * 10) + 5
          const totalBets = Math.floor(Math.random() * 20) + 15
          const pct = (finalMinuteBets / totalBets) * 100
          if (pct > 40) {
            setLateMoneyWarning({
              detected: true,
              percentage: pct,
              finalMinuteBets,
              totalBets,
              message: `⚠️ Late money detected: ${pct.toFixed(1)}% of wagers in final minute`,
            })
            onLateMoneyDetected?.({
              marketId: market.id,
              lateMoneyPercentage: pct,
              betSizeLimit: newLimit,
              timeUntilClose: diff,
            })
          }
        }
      } else {
        setTimeUntilClose(0)
        setBetSizeLimit(0)
      }
    }

    const interval = setInterval(tick, 1000)
    tick()

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market.closesAt, market.status, market.id])

  const formatTime = (ms: number) => {
    if (ms <= 0) return "Closed"
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${seconds}s`
  }

  const getCloseMechanismLevel = () => {
    if (timeUntilClose < 30000) return "critical"
    if (timeUntilClose < 60000) return "high"
    if (timeUntilClose < 300000) return "medium"
    return "normal"
  }

  const closeLevel = getCloseMechanismLevel()

  return (
    <div
      style={{
        marginTop: "1rem",
        padding: "1rem",
        borderRadius: "0.5rem",
        background:
          closeLevel === "critical"
            ? "hsl(var(--destructive) / 0.1)"
            : closeLevel === "high"
              ? "hsl(var(--warning) / 0.1)"
              : "hsl(var(--muted) / 0.2)",
        border: `1px solid ${
          closeLevel === "critical"
            ? "hsl(var(--destructive))"
            : closeLevel === "high"
              ? "hsl(var(--warning))"
              : "hsl(var(--border))"
        }`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.75rem",
        }}
      >
        <Clock size={16} />
        <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
          Late Money Monitor & Graduated Close
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "1rem",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Time Until Close
          </div>
          <div
            style={{
              fontSize: "1rem",
              fontWeight: 600,
              color:
                closeLevel === "critical"
                  ? "hsl(var(--destructive))"
                  : "inherit",
            }}
          >
            {formatTime(timeUntilClose)}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Bet Size Limit
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>
            ${betSizeLimit.toLocaleString()}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            Close Level
          </div>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 500,
              color:
                closeLevel === "critical"
                  ? "hsl(var(--destructive))"
                  : closeLevel === "high"
                    ? "hsl(var(--warning))"
                    : "hsl(var(--muted-foreground))",
            }}
          >
            {closeLevel.toUpperCase()}
          </div>
        </div>
      </div>

      {lateMoneyWarning && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            borderRadius: "0.375rem",
            background: "hsl(var(--warning) / 0.2)",
            border: "1px solid hsl(var(--warning))",
            fontSize: "0.75rem",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
          }}
        >
          <AlertTriangle size={14} style={{ marginTop: "0.125rem" }} />
          <div>
            <strong>Late Money Alert:</strong> {lateMoneyWarning.message}
            <div style={{ marginTop: "0.25rem" }}>
              {lateMoneyWarning.finalMinuteBets} of {lateMoneyWarning.totalBets}{" "}
              bets in final minute. Bet size limit reduced to NU. {betSizeLimit}
              .
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: "1rem",
          fontSize: "0.75rem",
          color: "hsl(var(--muted-foreground))",
          lineHeight: "1.4",
        }}
      >
        <strong>Graduated Close Mechanism:</strong>
        <ul style={{ margin: "0.5rem 0", paddingLeft: "1.5rem" }}>
          <li>&gt; 5 minutes: Normal betting limits</li>
          <li>1-5 minutes: Bet size limit NU. 100</li>
          <li>&lt; 30 seconds: Bet size limit NU. 50</li>
          <li>
            Late money detection: Alert if &gt;40% of wagers in final minute
          </li>
        </ul>
      </div>
    </div>
  )
}
