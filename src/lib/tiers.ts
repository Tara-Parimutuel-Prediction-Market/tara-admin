/**
 * The reputation ladder, for admin display.
 *
 * Colours and labels are copied from the user-facing definition in the PWA
 * (shared/reputation/tiers.tsx) so a tier looks the same to an admin as it does
 * to the person holding it. The thresholds are the authority of calcTier() in
 * the backend's reputation.service.ts; they are repeated here only as a
 * tooltip, never to decide anything.
 *
 * Before this file, UserManagement coloured tiers by matching "expert",
 * "reliable" and "regular" — names from an older ladder that no longer exist,
 * so every user fell through to grey and rendered a raw string like "hot_hand".
 */
export interface TierMeta {
  label: string
  color: string
  /** Plain-language requirement, for a title attribute. */
  requirement: string
}

/** Lowest to highest. Order matters for display. */
export const TIER_ORDER = [
  "rookie",
  "scout",
  "sharpshooter",
  "analyst",
  "hot_hand",
  "prophet",
  "legend",
] as const

export const TIERS: Record<string, TierMeta> = {
  rookie: {
    label: "Rookie",
    color: "#94a3b8",
    requirement: "Fewer than 10 resolved predictions",
  },
  scout: {
    label: "Scout",
    color: "#2dd4bf",
    requirement: "10+ resolved predictions",
  },
  sharpshooter: {
    label: "Sharpshooter",
    color: "#3b82f6",
    requirement: "31+ predictions at 50%+ accuracy",
  },
  analyst: {
    label: "Analyst",
    color: "#a78bfa",
    requirement: "51+ predictions at 60%+ accuracy",
  },
  hot_hand: {
    label: "Hot Hand",
    color: "#22c55e",
    requirement: "71+ predictions at 65%+ accuracy",
  },
  prophet: {
    label: "Prophet",
    color: "#f472b6",
    requirement: "101+ predictions at 70%+ accuracy",
  },
  legend: {
    label: "Legend",
    color: "#f59e0b",
    requirement: "201+ predictions at 80%+ accuracy",
  },
}

/**
 * Display name for a stored tier. Falls back to the raw value rather than to
 * "Rookie": an unrecognised tier is a data problem, and showing it as the
 * lowest rung would hide that instead of surfacing it.
 */
export function tierLabel(tier: string | null | undefined): string {
  if (!tier) return "Rookie"
  return TIERS[tier]?.label ?? tier
}

export function tierColor(tier: string | null | undefined): string {
  if (!tier) return TIERS.rookie.color
  return TIERS[tier]?.color ?? "hsl(var(--muted-foreground))"
}
