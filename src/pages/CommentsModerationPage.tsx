import React, { useCallback, useEffect, useState } from "react"
import {
  Flag,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  VolumeX,
  X,
} from "lucide-react"
import { useAdminApi } from "../lib/useAdminApi"

interface CommentFlag {
  reason: string
  note: string | null
  createdAt: string
}

interface CommentRow {
  id: string
  body: string
  createdAt: string
  flagCount: number
  deletedAt: string | null
  deletedBy: string | null
  deletedReason: string | null
  market: { id: string; title: string } | null
  author: {
    id: string
    username: string | null
    firstName: string | null
    lastName: string | null
    reputationTier: string
    commentsBlockedUntil: string | null
  } | null
  flags: CommentFlag[]
}

const PAGE_SIZE = 50

/**
 * Market comment moderation.
 *
 * Anyone signed in can comment, so the throttle and the word blocklist are only
 * a speed bump — this queue is the real moderation mechanism. Reported comments
 * sort to the top by default.
 *
 * Bodies are user-authored and stored raw. They are rendered as text children
 * here on purpose: this page must never use dangerouslySetInnerHTML.
 */
export default function CommentsModerationPage() {
  const token = sessionStorage.getItem("admin_token")
  const api = useAdminApi(token)

  const [rows, setRows] = useState<CommentRow[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [flaggedOnly, setFlaggedOnly] = useState(true)
  // What is typed, and what has actually been sent. Every keystroke firing a
  // query would hammer an unindexed ILIKE across three tables.
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Debounce the box, and reset to page 1 whenever the needle changes —
  // staying on page 7 of the old result set would show an empty list.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch((prev) => {
        if (prev !== searchInput.trim()) setPage(1)
        return searchInput.trim()
      })
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await api.getComments({
        flagged: flaggedOnly,
        q: search,
        page,
        limit: PAGE_SIZE,
      })
      setRows(res?.data ?? [])
      setTotal(res?.total ?? 0)
      setPages(res?.pages ?? 1)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load")
    }
    // api is rebuilt each render; depending on it would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flaggedOnly, search, page])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const remove = async (row: CommentRow) => {
    const reason = window.prompt(
      "Reason for removing this comment?\nThe author is told what you type here."
    )
    if (!reason || !reason.trim()) return
    setBusy(row.id)
    try {
      await api.deleteComment(row.id, reason.trim())
      setNotice("Comment removed and the author notified.")
      await refresh()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to remove")
    } finally {
      setBusy(null)
    }
  }

  const mute = async (row: CommentRow) => {
    if (!row.author) return
    const raw = window.prompt(
      "Pause this user's commenting for how many hours?",
      "24"
    )
    if (!raw) return
    const hours = parseInt(raw, 10)
    if (!Number.isFinite(hours) || hours < 1) {
      setNotice("Enter a whole number of hours.")
      return
    }
    const reason = window.prompt("Reason (shown to the user, optional)") ?? ""
    setBusy(row.id)
    try {
      await api.muteCommenter(row.author.id, hours, reason.trim() || undefined)
      setNotice(`Commenting paused for ${hours}h.`)
      await refresh()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to mute")
    } finally {
      setBusy(null)
    }
  }

  const unmute = async (row: CommentRow) => {
    if (!row.author) return
    setBusy(row.id)
    try {
      await api.unmuteCommenter(row.author.id)
      setNotice("Commenting restored.")
      await refresh()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to unmute")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <MessageSquare size={22} />
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>
          Market comments
        </h1>
        <button onClick={() => void refresh()} style={ghostButton}>
          <RefreshCw size={14} /> Refresh
        </button>
      </header>

      {loadError && (
        <div style={errorBox}>
          <ShieldAlert size={16} />
          <div>{loadError}</div>
        </div>
      )}
      {notice && <div style={noticeBox}>{notice}</div>}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 280px", minWidth: 220 }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 11,
              top: "50%",
              transform: "translateY(-50%)",
              opacity: 0.5,
              pointerEvents: "none",
            }}
          />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search comments, authors or markets…"
            style={searchBox}
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              aria-label="Clear search"
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "inherit",
                opacity: 0.55,
                display: "flex",
                padding: 4,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 13,
            whiteSpace: "nowrap",
          }}
        >
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => {
              setPage(1)
              setFlaggedOnly(e.target.checked)
            }}
          />
          Reported only
        </label>
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          {total} comment{total === 1 ? "" : "s"}
        </span>
      </div>

      {rows.length === 0 ? (
        <div style={{ ...panel, alignItems: "center", opacity: 0.7 }}>
          <span style={{ fontSize: 13 }}>
            {search
              ? `Nothing matches “${search}”.`
              : flaggedOnly
                ? "Nothing reported. Untick “Reported only” to browse everything."
                : "No comments yet."}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.map((row) => {
            const muted =
              row.author?.commentsBlockedUntil != null &&
              new Date(row.author.commentsBlockedUntil).getTime() > Date.now()
            return (
              <div key={row.id} style={panel}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <strong style={{ fontSize: 14 }}>
                    {row.author?.username
                      ? `@${row.author.username}`
                      : [row.author?.firstName, row.author?.lastName]
                          .filter(Boolean)
                          .join(" ") || "Unknown user"}
                  </strong>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>
                    {row.author?.reputationTier}
                  </span>
                  {row.flagCount > 0 && (
                    <span style={flagPill}>
                      <Flag size={11} /> {row.flagCount}
                    </span>
                  )}
                  {muted && <span style={mutedPill}>muted</span>}
                  {row.deletedAt && (
                    <span style={removedPill}>removed by {row.deletedBy}</span>
                  )}
                  <span
                    style={{ fontSize: 12, opacity: 0.6, marginLeft: "auto" }}
                  >
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </div>

                <div style={rule} />

                {row.market && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    on “{row.market.title}”
                  </div>
                )}

                {/* Text child — React escapes it. Never innerHTML. */}
                <p
                  style={{
                    margin: 0,
                    fontSize: 13.5,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    opacity: row.deletedAt ? 0.45 : 1,
                    textDecoration: row.deletedAt ? "line-through" : "none",
                  }}
                >
                  {row.body}
                </p>

                {row.deletedReason && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    Removal reason: {row.deletedReason}
                  </div>
                )}

                {row.flags.length > 0 && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 4 }}
                  >
                    {row.flags.map((f, i) => (
                      <div key={i} style={{ fontSize: 12, opacity: 0.75 }}>
                        <strong>{f.reason}</strong>
                        {f.note ? ` — ${f.note}` : ""}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions sit on their own rule, pushed right — the reading
                    order is the comment, then what you can do about it. */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    marginTop: 4,
                    paddingTop: 12,
                    borderTop: `1px solid ${rule.background}`,
                  }}
                >
                  {!row.deletedAt && (
                    <button
                      style={dangerButton}
                      disabled={busy === row.id}
                      onClick={() => void remove(row)}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                  {row.author &&
                    (muted ? (
                      <button
                        style={ghostAction}
                        disabled={busy === row.id}
                        onClick={() => void unmute(row)}
                      >
                        Lift mute
                      </button>
                    ) : (
                      <button
                        style={ghostAction}
                        disabled={busy === row.id}
                        onClick={() => void mute(row)}
                      >
                        <VolumeX size={14} /> Mute author
                      </button>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            style={ghostAction}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ fontSize: 13 }}>
            Page {page} of {pages}
          </span>
          <button
            style={ghostAction}
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

const panel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  border: "1px solid var(--border, #2a2a2a)",
  borderRadius: 12,
  padding: 16,
  background: "var(--card, rgba(255,255,255,0.02))",
}

/** Hairline inside a comment card, separating its three bands. */
const rule: React.CSSProperties = {
  height: 1,
  background: "rgba(148,163,184,0.18)",
  margin: "2px 0",
}

const searchBox: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 30px 9px 33px",
  borderRadius: 9,
  border: "1px solid var(--border, #2a2a2a)",
  background: "var(--card, rgba(255,255,255,0.02))",
  color: "inherit",
  fontSize: 13,
  outline: "none",
}

const buttonBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "9px 16px",
  borderRadius: 9,
  border: "none",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  color: "#fff",
}

const dangerButton: React.CSSProperties = {
  ...buttonBase,
  background: "#dc2626",
}

const ghostButton: React.CSSProperties = {
  ...buttonBase,
  background: "transparent",
  border: "1px solid var(--border, #2a2a2a)",
  color: "inherit",
  marginLeft: "auto",
}

const ghostAction: React.CSSProperties = {
  ...buttonBase,
  background: "transparent",
  border: "1px solid var(--border, #2a2a2a)",
  color: "inherit",
}

const boxBase: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 13,
  lineHeight: 1.5,
}

const errorBox: React.CSSProperties = {
  ...boxBase,
  background: "rgba(220,38,38,0.08)",
  border: "1px solid rgba(220,38,38,0.3)",
}

const noticeBox: React.CSSProperties = {
  ...boxBase,
  background: "rgba(37,99,235,0.08)",
  border: "1px solid rgba(37,99,235,0.3)",
}

const pillBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
}

const flagPill: React.CSSProperties = {
  ...pillBase,
  background: "rgba(245,158,11,0.15)",
  color: "#f59e0b",
}

const mutedPill: React.CSSProperties = {
  ...pillBase,
  background: "rgba(220,38,38,0.15)",
  color: "#f87171",
}

const removedPill: React.CSSProperties = {
  ...pillBase,
  background: "rgba(255,255,255,0.08)",
  opacity: 0.8,
}
