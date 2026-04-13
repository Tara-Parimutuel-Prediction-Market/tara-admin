import React, { useState, useEffect, useRef } from "react"

interface Outcome {
  id?: string
  label: string
  imageUrl?: string | null
}

const CATEGORIES = [
  { value: "sports", label: "Sports" },
  { value: "politics", label: "Politics" },
  { value: "weather", label: "Weather" },
  { value: "entertainment", label: "Entertainment" },
  { value: "economy", label: "Economy" },
  { value: "other", label: "Other" },
] as const

interface MarketInitialData {
  title?: string
  description?: string
  outcomes?: Outcome[]
  opensAt?: string
  closesAt?: string
  houseEdgePct?: number
  mechanism?: string
  liquidityParam?: number
  category?: string | null
  imageUrl?: string | null
  imageUrlAlt?: string | null
}

export interface MarketFormData {
  title: string
  description: string
  outcomes: { id?: string; label: string; imageUrl?: string | null }[]
  opensAt: string
  closesAt: string
  houseEdgePct: number
  mechanism: string
  liquidityParam: number
  category: string
  imageUrl: string
  imageUrlAlt: string
}

interface MarketFormProps {
  initialData?: MarketInitialData
  onSubmit: (data: MarketFormData) => void
  onCancel: () => void
  loading?: boolean
}

// ── Wikipedia image search ────────────────────────────────────────────────────

interface WikiImage {
  title: string
  thumbUrl: string
  fullUrl: string
}

async function searchWikiImages(query: string): Promise<WikiImage[]> {
  if (!query.trim()) return []
  const terms = encodeURIComponent(query.trim())
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${terms}&gsrnamespace=0&gsrlimit=6` +
    `&prop=pageimages&piprop=thumbnail&pithumbsize=300&pilimit=6` +
    `&format=json&origin=*`
  const res = await fetch(url)
  const data = await res.json()
  const pages: WikiImage[] = []
  if (data?.query?.pages) {
    for (const p of Object.values(data.query.pages) as Record<
      string,
      unknown
    >[]) {
      const page = p as { title?: string; thumbnail?: { source?: string } }
      if (page?.thumbnail?.source) {
        pages.push({
          title: page.title ?? "",
          thumbUrl: page.thumbnail.source,
          fullUrl: page.thumbnail.source.replace(/\/\d+px-/, "/400px-"),
        })
      }
    }
  }
  return pages
}

// ── Main form component ───────────────────────────────────────────────────────

const MarketForm: React.FC<MarketFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading,
}) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    description: initialData?.description || "",
    outcomes: (initialData?.outcomes?.map((o: Outcome) => ({
      id: o.id,
      label: o.label,
      imageUrl: o.imageUrl ?? null,
    })) ?? [
      { label: "Yes", imageUrl: null },
      { label: "No", imageUrl: null },
    ]) as {
      id?: string
      label: string
      imageUrl?: string | null
    }[],
    opensAt: initialData?.opensAt
      ? new Date(initialData.opensAt).toISOString().slice(0, 16)
      : "",
    closesAt: initialData?.closesAt
      ? new Date(initialData.closesAt).toISOString().slice(0, 16)
      : "",
    houseEdgePct: initialData?.houseEdgePct || 5,
    mechanism: initialData?.mechanism || "parimutuel",
    liquidityParam: initialData?.liquidityParam || 1000,
    category: initialData?.category || "other",
    imageUrl: initialData?.imageUrl || "",
    imageUrlAlt: initialData?.imageUrlAlt || "",
  })

  // Image 1 search state
  const [imgQuery, setImgQuery] = useState(initialData?.title || "")
  const [imgResults, setImgResults] = useState<WikiImage[]>([])
  const [imgSearching, setImgSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Image 2 search state
  const [imgQuery2, setImgQuery2] = useState("")
  const [imgResults2, setImgResults2] = useState<WikiImage[]>([])
  const [imgSearching2, setImgSearching2] = useState(false)
  const debounceRef2 = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-populate image search query when title changes
  useEffect(() => {
    setImgQuery(formData.title)
  }, [formData.title])

  const runImageSearch = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!q.trim()) {
        setImgResults([])
        return
      }
      setImgSearching(true)
      try {
        const results = await searchWikiImages(q)
        setImgResults(results)
      } catch {
        /* ignore */
      } finally {
        setImgSearching(false)
      }
    }, 600)
  }

  const runImageSearch2 = (q: string) => {
    if (debounceRef2.current) clearTimeout(debounceRef2.current)
    debounceRef2.current = setTimeout(async () => {
      if (!q.trim()) {
        setImgResults2([])
        return
      }
      setImgSearching2(true)
      try {
        const results = await searchWikiImages(q)
        setImgResults2(results)
      } catch {
        /* ignore */
      } finally {
        setImgSearching2(false)
      }
    }, 600)
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleOutcomeChange = (index: number, value: string) => {
    const newOutcomes = [...formData.outcomes]
    newOutcomes[index] = { ...newOutcomes[index], label: value }
    setFormData((prev) => ({ ...prev, outcomes: newOutcomes }))
  }

  const handleOutcomeImageChange = (index: number, url: string) => {
    const newOutcomes = [...formData.outcomes]
    newOutcomes[index] = { ...newOutcomes[index], imageUrl: url || null }
    setFormData((prev) => ({ ...prev, outcomes: newOutcomes }))
  }

  const addOutcome = () => {
    setFormData((prev) => ({
      ...prev,
      outcomes: [...prev.outcomes, { label: "", imageUrl: null }],
    }))
  }

  const removeOutcome = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      outcomes: prev.outcomes.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      houseEdgePct: Number(formData.houseEdgePct),
      liquidityParam: Number(formData.liquidityParam),
    })
  }

  return (
    <div className="glass-card" style={{ maxWidth: "600px", margin: "0 auto" }}>
      <form onSubmit={handleSubmit}>
        <h3>{initialData ? "Edit Market" : "Create New Market"}</h3>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            TITLE
          </label>
          <input
            name="title"
            value={formData.title}
            onChange={handleChange}
            className="input-field"
            required
            placeholder="e.g., Argentina vs Portugal — Who wins?"
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            DESCRIPTION
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="input-field"
            style={{ minHeight: "80px", resize: "vertical" }}
            placeholder="Market details..."
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            CATEGORY
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="input-field"
            required
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* ── Cover Image ─────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            COVER IMAGE
          </label>

          {/* Selected image preview */}
          {formData.imageUrl && (
            <div
              style={{
                position: "relative",
                marginBottom: "0.75rem",
                display: "inline-block",
              }}
            >
              <img
                src={formData.imageUrl}
                alt="cover"
                style={{
                  width: 80,
                  height: 80,
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "2px solid hsl(var(--primary))",
                  display: "block",
                }}
              />
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, imageUrl: "" }))}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "hsl(var(--destructive))",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  fontSize: 12,
                  cursor: "pointer",
                  lineHeight: "20px",
                  textAlign: "center",
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Manual URL input */}
          <input
            name="imageUrl"
            value={formData.imageUrl}
            onChange={handleChange}
            className="input-field"
            placeholder="Paste image URL, or search Wikipedia below…"
            style={{ marginBottom: "0.5rem" }}
          />

          {/* Wikipedia image search */}
          <div
            style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}
          >
            <input
              value={imgQuery}
              onChange={(e) => setImgQuery(e.target.value)}
              className="input-field"
              style={{ marginBottom: 0, flex: 1 }}
              placeholder={`Search images, e.g. "Argentina national football team"`}
            />
            <button
              type="button"
              className="secondary"
              style={{ whiteSpace: "nowrap", padding: "0 1rem" }}
              onClick={() => runImageSearch(imgQuery)}
              disabled={imgSearching}
            >
              {imgSearching ? "…" : "🔍 Search"}
            </button>
          </div>

          {/* Image grid results */}
          {imgResults.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                padding: "0.5rem 0",
              }}
            >
              {imgResults.map((img) => (
                <button
                  key={img.thumbUrl}
                  type="button"
                  title={img.title}
                  onClick={() => {
                    setFormData((p) => ({ ...p, imageUrl: img.fullUrl }))
                    setImgResults([])
                  }}
                  style={{
                    padding: 0,
                    border:
                      formData.imageUrl === img.fullUrl
                        ? "2px solid hsl(var(--primary))"
                        : "2px solid transparent",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: "none",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={img.thumbUrl}
                    alt={img.title}
                    style={{
                      width: 72,
                      height: 72,
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={(e) => {
                      ;(
                        e.currentTarget.parentElement as HTMLElement
                      ).style.display = "none"
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          <p
            style={{
              fontSize: "0.7rem",
              color: "hsl(var(--muted-foreground))",
              margin: "0.25rem 0 0",
            }}
          >
            Images sourced from Wikipedia (free licence). Search by team,
            player, topic, or country name.
          </p>
        </div>

        {/* ── Cover Image 2 (Right / Alt side) ────────────────────────────── */}
        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            IMAGE 2 — RIGHT SIDE{" "}
            <span style={{ opacity: 0.5 }}>(optional, e.g. away team)</span>
          </label>

          {/* Selected image 2 preview */}
          {formData.imageUrlAlt && (
            <div
              style={{
                position: "relative",
                marginBottom: "0.75rem",
                display: "inline-block",
              }}
            >
              <img
                src={formData.imageUrlAlt}
                alt="cover alt"
                style={{
                  width: 80,
                  height: 80,
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "2px solid hsl(var(--primary))",
                  display: "block",
                }}
              />
              <button
                type="button"
                onClick={() => setFormData((p) => ({ ...p, imageUrlAlt: "" }))}
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  background: "hsl(var(--destructive))",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  fontSize: 12,
                  cursor: "pointer",
                  lineHeight: "20px",
                  textAlign: "center",
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          )}

          {/* Manual URL input */}
          <input
            name="imageUrlAlt"
            value={formData.imageUrlAlt}
            onChange={handleChange}
            className="input-field"
            placeholder="Paste image URL, or search Wikipedia below…"
            style={{ marginBottom: "0.5rem" }}
          />

          {/* Wikipedia image search 2 */}
          <div
            style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}
          >
            <input
              value={imgQuery2}
              onChange={(e) => setImgQuery2(e.target.value)}
              className="input-field"
              style={{ marginBottom: 0, flex: 1 }}
              placeholder={`Search images, e.g. "Portugal national football team"`}
            />
            <button
              type="button"
              className="secondary"
              style={{ whiteSpace: "nowrap", padding: "0 1rem" }}
              onClick={() => runImageSearch2(imgQuery2)}
              disabled={imgSearching2}
            >
              {imgSearching2 ? "…" : "🔍 Search"}
            </button>
          </div>

          {/* Image grid results 2 */}
          {imgResults2.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                padding: "0.5rem 0",
              }}
            >
              {imgResults2.map((img) => (
                <button
                  key={img.thumbUrl}
                  type="button"
                  title={img.title}
                  onClick={() => {
                    setFormData((p) => ({ ...p, imageUrlAlt: img.fullUrl }))
                    setImgResults2([])
                  }}
                  style={{
                    padding: 0,
                    border:
                      formData.imageUrlAlt === img.fullUrl
                        ? "2px solid hsl(var(--primary))"
                        : "2px solid transparent",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: "none",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={img.thumbUrl}
                    alt={img.title}
                    style={{
                      width: 72,
                      height: 72,
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={(e) => {
                      ;(
                        e.currentTarget.parentElement as HTMLElement
                      ).style.display = "none"
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          <p
            style={{
              fontSize: "0.7rem",
              color: "hsl(var(--muted-foreground))",
              margin: "0.25rem 0 0",
            }}
          >
            When both Image 1 &amp; Image 2 are set, the card shows a split
            thumbnail (left team / right team).
          </p>
        </div>

        {/* ── Outcomes ─────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "1rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            OUTCOMES
            {initialData && (
              <span
                style={{
                  marginLeft: 8,
                  fontWeight: 400,
                  opacity: 0.6,
                  textTransform: "none",
                  fontSize: "0.7rem",
                }}
              >
                (rename only — count is fixed to preserve existing bets)
              </span>
            )}
          </label>
          {formData.outcomes.map((outcome, index) => (
            <div key={index} style={{ marginBottom: "0.75rem" }}>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginBottom: "0.35rem",
                }}
              >
                <input
                  value={outcome.label}
                  onChange={(e) => handleOutcomeChange(index, e.target.value)}
                  className="input-field"
                  style={{ marginBottom: 0 }}
                  required
                  placeholder={`Outcome ${index + 1} label`}
                />
                {!initialData && formData.outcomes.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOutcome(index)}
                    className="secondary"
                    style={{ padding: "0 0.75rem" }}
                  >
                    &times;
                  </button>
                )}
              </div>
              <div
                style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}
              >
                {outcome.imageUrl && (
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <img
                      src={outcome.imageUrl}
                      alt=""
                      style={{
                        width: 36,
                        height: 36,
                        objectFit: "cover",
                        borderRadius: 6,
                        border: "1px solid hsl(var(--border))",
                        display: "block",
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleOutcomeImageChange(index, "")}
                      style={{
                        position: "absolute",
                        top: -5,
                        right: -5,
                        background: "hsl(var(--destructive))",
                        color: "#fff",
                        border: "none",
                        borderRadius: "50%",
                        width: 16,
                        height: 16,
                        fontSize: 10,
                        cursor: "pointer",
                        lineHeight: "16px",
                        textAlign: "center",
                        padding: 0,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
                <input
                  value={outcome.imageUrl || ""}
                  onChange={(e) =>
                    handleOutcomeImageChange(index, e.target.value)
                  }
                  className="input-field"
                  style={{ marginBottom: 0, fontSize: "0.75rem" }}
                  placeholder={`Outcome ${index + 1} image URL (optional)`}
                />
              </div>
            </div>
          ))}
          {!initialData && (
            <button
              type="button"
              onClick={addOutcome}
              className="secondary"
              style={{ width: "100%", fontSize: "0.75rem" }}
            >
              + Add Outcome
            </button>
          )}
        </div>

        {/* ── Dates ────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              OPENS AT
            </label>
            <input
              type="datetime-local"
              name="opensAt"
              value={formData.opensAt}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontSize: "0.75rem",
                color: "hsl(var(--muted-foreground))",
              }}
            >
              CLOSES AT
            </label>
            <input
              type="datetime-local"
              name="closesAt"
              value={formData.closesAt}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>
        </div>

        {/* ── Fee ──────────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontSize: "0.75rem",
              color: "hsl(var(--muted-foreground))",
            }}
          >
            PLATFORM FEE (%)
          </label>
          <input
            type="number"
            name="houseEdgePct"
            value={formData.houseEdgePct}
            onChange={handleChange}
            className="input-field"
            min="0"
            max="100"
            required
          />
        </div>

        <div
          style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}
        >
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={loading}>
            {loading
              ? "Saving..."
              : initialData
                ? "Update Market"
                : "Create Market"}
          </button>
        </div>
      </form>
    </div>
  )
}

export default MarketForm
