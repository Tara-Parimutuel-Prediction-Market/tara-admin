# Oro — Complete System Reference

> **Scope:** Every mechanism and idea implemented across `oro-client` (backend + frontend Mini App) and `oro-admin` (admin dashboard). Written from the source code, not from docs alone.

---

## Table of Contents

1. [System Overview](#1-system-overview)

2. [Tech Stack](#2-tech-stack)

3. [Authentication & Identity](#3-authentication--identity)

4. [User Model](#4-user-model)

5. [Prediction Market Engine](#5-prediction-market-engine)

6. [Market Lifecycle & State Machine](#6-market-lifecycle--state-machine)

7. [Odds Display — LMSR](#7-odds-display--lmsr)

8. [Settlement & Payout](#8-settlement--payout)

9. [Resolution & Dispute System](#9-resolution--dispute-system)

10. [Auto-Resolution Cron Job](#10-auto-resolution-cron-job)

11. [Payment System — DK Bank](#11-payment-system--dk-bank)

12. [Transaction Ledger](#12-transaction-ledger)

13. [Free Credits & Bonus Balance](#13-free-credits--bonus-balance)

14. [Reputation System](#14-reputation-system)

15. [Bet Streak System](#15-bet-streak-system)

16. [Duel / Challenge System](#16-duel--challenge-system)

17. [Power Cards](#17-power-cards)

18. [Referral System](#18-referral-system)

19. [Leagues & Group Leaderboards](#19-leagues--group-leaderboards)

20. [Oracle Orbit — Community Suggestion Hub](#20-oracle-orbit--community-suggestion-hub)

21. [Telegram Bot](#21-telegram-bot)

22. [Real-Time Updates — WebSocket Gateway](#22-real-time-updates--websocket-gateway)

23. [Notifications Queue](#23-notifications-queue)

24. [Audit Log](#24-audit-log)

25. [Redis Usage](#25-redis-usage)

26. [Market Discovery — Football Data Integration](#26-market-discovery--football-data-integration)

27. [Admin Dashboard (oro-admin)](#27-admin-dashboard-oro-admin)

28. [Frontend Mini App (TMA)](#28-frontend-mini-app-tma)

29. [Security Design](#29-security-design)

30. [Database Entities Summary](#30-database-entities-summary)

31. [Environment Variables](#31-environment-variables)

---

## 1. System Overview

Oro is a **Telegram Mini App (TMA) prediction market platform** for Bhutan, using the Bhutanese Ngultrum (Nu / BTN) as its currency. Users authenticate through Telegram, link their **DK Bank** account, deposit Nu, place predictions on binary/multi-outcome markets, and receive payouts when markets are settled.

The system has three codebases:

| Codebase | Role |

| --------------------- | ----------------------------------------- |

| `oro-client/backend` | NestJS REST + WebSocket API |

| `oro-client/frontend` | React Telegram Mini App (TMA) |

| `oro-admin` | React admin dashboard (separate Vite app) |

---

## 2. Tech Stack

### Backend (`oro-client/backend`)

- **Runtime:** Node.js, NestJS framework

- **Language:** TypeScript

- **Database:** PostgreSQL via TypeORM

- **Cache / Locks:** Redis (BullMQ queues + distributed locks)

- **Auth:** JWT (RS256/HS256), Telegram `initData` HMAC-SHA-256 validation

- **Payments:** DK Bank Gateway (Bhutan SIT / Production)

- **Scheduler:** `@nestjs/schedule` cron jobs

- **Queue:** BullMQ via `@nestjs/bullmq`

- **Real-Time:** `@nestjs/websockets` Socket.IO gateway

- **API Docs:** Swagger (`@nestjs/swagger`)

### Frontend Mini App (`oro-client/frontend`)

- **Framework:** React + TypeScript + Vite

- **TMA SDK:** `@telegram-apps/sdk-react`

- **Wallet:** TON Connect 2.0

- **Navigation:** `@telegram-apps/sdk` navigation

### Admin Dashboard (`oro-admin`)

- **Framework:** React + TypeScript + Vite

- **Auth:** Dev-secret JWT (separate from user JWT)

- **API:** REST calls to `GET/POST /api/admin/*`

---

## 3. Authentication & Identity

### Telegram initData Login

1. Telegram injects `initData` (URL-encoded string) into the Mini App at launch.

2. Backend validates it with HMAC-SHA-256:

- `secret_key = HMAC-SHA-256("WebAppData", botToken)`

- `expected_hash = HMAC-SHA-256(secret_key, sorted_data_check_string)`

- `timingSafeEqual(expected, received)` — constant-time comparison prevents timing attacks.

3. `auth_date` freshness check: reject if older than 24 hours.

4. On first login → create `User` + `AuthMethod(provider=TELEGRAM)` row.

5. Returns a JWT signed with `JWT_SECRET`.

### JWT Strategy

- All protected endpoints use a `JwtAuthGuard` (`Bearer` token in `Authorization` header).

- Admin endpoints use a separate `AdminJwtGuard` that checks `user.isAdmin === true`.

### Dev-Secret Admin Login (`oro-admin`)

- `GET /api/auth/dev/admin-token?secret=<ADMIN_DEV_SECRET>` — environment-gated endpoint.

- Returns a short-lived JWT with `isAdmin: true` payload.

- Used exclusively by the admin dashboard login page.

- Implemented as a standalone exported function `loginWithDevSecret()` — not inside the React hook.

### DK Bank Phone Verification

- When a user links their DK Bank account, their phone number's HMAC-SHA-256 hash (`dkPhoneHash`) is stored.

- When a Telegram-shared contact arrives, its hash (`telegramPhoneHash`) is stored.

- Payments cross-check both hashes — identity must match before any withdrawal proceeds.

- Raw phone numbers are **never stored** — only HMAC hashes.

---

## 4. User Model

Each `User` row (`users` table) holds:

| Field | Purpose |

| ------------------------------------------------- | ---------------------------------------------------------------------- |

| `telegramId` | Telegram numeric user ID (string) |

| `telegramChatId` | Telegram chat ID for DM notifications (= telegramId for private chats) |

| `dkCid` | 11-digit Bhutanese CID linked to the DK Bank account |

| `dkAccountNumber` | DK Bank account number |

| `dkAccountName` | Account holder name from DK Bank |

| `dkPhoneHash` | HMAC-SHA-256 of DK Bank registered phone |

| `telegramPhoneHash` | HMAC-SHA-256 of Telegram-shared phone |

| `isAdmin` | Admin privilege flag |

| `reputationScore` | Float 0.0–1.0 accuracy score |

| `reputationTier` | `rookie` \| `sharpshooter` \| `hot_hand` \| `legend` |

| `totalPredictions` / `correctPredictions` | Prediction history counts |

| `categoryScores` | JSONB per-category `{ correct, total }` |

| `brierScore` / `brierCount` | Calibration quality metric |

| `betStreakCount` | Consecutive daily betting streak |

| `betStreakLastAt` | UTC date of last bet (YYYY-MM-DD) |

| `streakBoostUsed` | Whether Day-7 boost has fired this cycle |

| `cardInventory` | JSONB `{ doubleDown, shield, ghost }` counts |

| `bonusBalance` | Running total of bonus credits still in play |

| `freeCreditGranted` | Whether the Nu 20 welcome bonus was issued |

| `referredByUserId` | UUID of the user who referred this user |

| `referralBonusTriggered` | Whether referrer has received their credit |

| `referralPrizeClaimed` | Whether the milestone prize was paid out |

| `contrarianWins` / `contrarianAttempts` | Contrarian badge tracking |

| `contrarianBadge` | `null` \| `bronze` \| `silver` \| `gold` |

| `adminTotalResolutions` / `adminWrongResolutions` | Admin accountability metrics |

**Requirement before placing any bet:**

- Must have `dkAccountNumber` (linked DK Bank account)

- Must have `phoneNumber` (verified phone)

- Must NOT have an active duel on the same market

---

## 5. Prediction Market Engine

### Mechanism: Parimutuel

All markets use the **Parimutuel** mechanism (`MarketMechanism.PARIMUTUEL`).

- All bets on all outcomes go into a single pool (`totalPool`).

- A **house edge** (`houseEdgePct`, default 5–8%) is taken from the total pool.

- `payoutPool = totalPool × (1 − houseEdgePct / 100)`

- Winners share the payout pool proportionally to their stake on the winning outcome.

- **Odds at placement** = `payoutPool / outcomePool` at the moment of the bet.

### Minimum Bet

- Nu **100** minimum per position.

### Concurrency Safety

- **Redis distributed lock** (`acquireLockWithRetry`): TTL 15s, 8 retries × 200ms = 1.6s max wait before `LOCK_CONTENDED` error.

- **PostgreSQL pessimistic write lock** (`SELECT ... FOR UPDATE`) as a secondary guard if Redis is unavailable.

- Both together ensure no two bets on the same market run simultaneously at the DB level.

### Bet Flow (inside DB transaction)

1. Lock `Market` row with pessimistic write.

2. Check market `status === OPEN`.

3. Verify outcome exists in market.

4. Verify user exists, has `dkAccountNumber`, has `phoneNumber`.

5. Block if user has an active duel on this market.

6. Deduct balance via `Transaction` ledger.

7. Create `Position` record.

8. Update `Outcome.totalBetAmount` and `Market.totalPool`.

9. Apply streak update.

10. Apply reputation-weighted LMSR (for probability display only).

11. Emit WebSocket event to connected clients.

12. Queue Telegram notification.

---

## 6. Market Lifecycle & State Machine

Markets have **7 states** with strict allowed transitions:

```

UPCOMING ──► OPEN ──► CLOSED ──► RESOLVING

│ │ │ │

▼ ▼ ▼ │ (auto or manual)

CANCELLED CANCELLED CANCELLED ▼

RESOLVED ──► SETTLED

```

| State | Meaning |

| ----------- | -------------------------------------------------- |

| `upcoming` | Created, not yet open for bets |

| `open` | Accepting bets |

| `closed` | Betting closed, awaiting resolution |

| `resolving` | Admin proposed an outcome; objection window open |

| `resolved` | Outcome confirmed (after window or admin override) |

| `settled` | Payouts distributed |

| `cancelled` | Market voided; all positions refunded |

### Key Market Fields

| Field | Purpose |

| ---------------------- | ------------------------------------------------------------------------------ |

| `houseEdgePct` | % taken as house cut |

| `liquidityParam` | LMSR `b` parameter (default Nu 1000) |

| `category` | `sports` \| `politics` \| `weather` \| `entertainment` \| `economy` \| `other` |

| `opensAt` / `closesAt` | Scheduled open/close timestamps |

| `windowMinutes` | Objection window duration (10, 20, 30, 60, or 120 min) |

| `proposedOutcomeId` | Admin's proposed winning outcome |

| `resolvedOutcomeId` | Final confirmed winning outcome |

| `disputeDeadlineAt` | When the objection window closes |

| `evidenceUrl` | Public URL to resolution evidence |

| `evidenceNote` | Admin explanation of evidence |

| `externalMatchId` | football-data.org match ID (for auto-created markets) |

| `externalMarketType` | `match-winner` \| `over-under` |

| `disputeBondPool` | Accumulated forfeited bonds from wrong objectors |

---

## 7. Odds Display — LMSR

While settlement uses parimutuel mechanics, **probability display** uses the **Logarithmic Market Scoring Rule (LMSR)**:

```

p_i = exp(q_i / b) / Σ exp(q_j / b)

```

Where:

- `q_i` = total bet amount on outcome `i`

- `b` = `liquidityParam` (default 1000 BTN)

**Numerical stability:** Log-sum-exp trick is applied to prevent floating-point overflow.

**Decimal odds** = `1 / p_i`

**Cost function** (for what-if analysis):

```

C(q) = b × ln(Σ exp(q_i / b))

```

**Reputation-weighted LMSR:** Each bettor's effective share = `amount × reputationMultiplier` where `reputationMultiplier = 0.5 + score` (range ~0.5×–1.5×). High-reputation users move displayed probabilities more than low-reputation users.

---

## 8. Settlement & Payout

Triggered by `POST /api/admin/markets/:id/settle` (or auto-resolve cron).

### Settlement Steps

1. Validate market is `RESOLVED` with a `resolvedOutcomeId`.

2. Fetch all `PENDING` positions.

3. Calculate `payoutPool = totalPool × (1 − houseEdgePct / 100)`.

4. For each winning position:

- Base payout = `(positionAmount / winningOutcomePool) × payoutPool`

- **Early-confidence bonus:** If `poolPctAtBet < 0.5` (bet placed when outcome was uncertain), apply small multiplier for conviction.

- **Day-7 streak boost:** If `streakBoostUsed` triggered this bet, multiply by `1.2×`.

- **Bonus balance cap:** Winnings from `isBonus=true` positions capped at Nu 50 withdrawable; excess re-credited as play money.

5. Credit payouts to winners via `Transaction(type=POSITION_PAYOUT)`.

6. Mark losing positions `LOST`, winning positions `WON`.

7. Refund positions on cancelled markets.

8. Write `Settlement` record.

9. Run `ReputationService.recalculateForMarket()`.

10. Distribute `disputeBondPool` to upheld objectors.

11. Post market-settled notification to Telegram channel.

12. Emit WebSocket `market:settled` event.

---

## 9. Resolution & Dispute System

### Propose → Object → Finalise Flow

1. **Admin proposes:** `POST /api/admin/markets/:id/propose` — sets `proposedOutcomeId`, `status = RESOLVING`, `disputeDeadlineAt = now + windowMinutes`, uploads evidence URL and note.

2. **Users object:** `POST /api/markets/:id/dispute` — any user with a position can file an objection during the window.

- **Bond required:** `max(10, 2% of user's position amount)` deducted as `Transaction(type=DISPUTE_BOND_LOCK)`.

- Bond is locked (`DisputeBondStatus.LOCKED`) until resolved.

3. **Window expires:**

- Zero objections → auto-resolve cron settles with proposed outcome.

- 1+ objections → Admin must review manually via `POST /api/admin/markets/:id/resolve`.

4. **Admin resolves:**

- If admin **upholds** objectors: bonds returned + share of `disputeBondPool` paid to each upheld objector.

- If admin **overrules** objectors: bonds forfeited, added to `disputeBondPool`.

5. Market transitions `RESOLVING → RESOLVED → SETTLED`.

### Admin Accountability

- `adminTotalResolutions` and `adminWrongResolutions` tracked per admin.

- An overturn (upheld objector) counts as a wrong resolution.

- High wrong/total ratio flags bad actor admins.

---

## 10. Auto-Resolution Cron Job

**Schedule:** Every 5 minutes (`EVERY_5_MINUTES`).

**Logic:**

1. Find all `RESOLVING` markets where `disputeDeadlineAt < now`.

2. Count objections for each.

3. If **zero objections** → call `engine.settleMarket(market.proposedOutcomeId)`.

4. If **1+ objections** → skip; log that admin review is needed.

5. If no `proposedOutcomeId` → log warning and skip.

6. Writes `AuditLog` entry for each auto-resolved market.

---

## 11. Payment System — DK Bank

### Architecture

- **DK Gateway Service** (`DKGatewayService`) — low-level HTTP client for DK Bank's SIT/production REST API.

- **DK Bank Payment Service** (`DKBankPaymentService`) — orchestrates deposit/withdrawal flows including OTP.

- Merchant credentials: `DK_CLIENT_ID`, `DK_CLIENT_SECRET`, `DK_MERCHANT_ID`, `DK_MERCHANT_ACCOUNT_NUMBER`.

- Dev environment uses SIT gateway: `sit.digitalkidu.bt:8082`, merchant `110158212197 / Tshering Zangmo`.

### Deposit Flow

1. User initiates deposit in frontend.

2. Backend calls DK Bank Inquiry API (`POST /api/payment/dk/initiate`).

3. DK Bank generates OTP, sends to user's registered phone.

4. OTP session stored in Redis with 10-minute TTL (`Oro:otp:<paymentId>`).

5. User submits OTP (`POST /api/payment/dk/verify-otp`).

6. Backend calls DK Bank confirmation API with OTP.

7. On success: create `Transaction(type=DEPOSIT)`, update balance.

8. Queue `PAYMENT_SUCCESS` notification.

### Withdrawal Flow

- Similar OTP-based flow in reverse.

- **Phone hash check:** Telegram phone hash must match DK Bank phone hash.

- **Bonus cap:** Bonus-derived winnings capped at Nu 50 before any withdrawal.

### OTP Security

- Max 3 failed OTP attempts before session is invalidated.

- Telegram-based OTP: 60s TTL, separate from DK Bank OTP window.

- `timingSafeEqual` used for all hash comparisons.

### Payment Entity Fields

- `type`: `deposit` \| `withdrawal` \| `position_placed` \| `position_payout` \| `refund`

- `status`: `pending` \| `success` \| `failed` \| `cancelled`

- `method`: `dkbank` \| `ton` \| `credits`

- `dkInquiryId`, `dkTxnStatusId`, `dkRequestId` — DK Bank correlation IDs.

- `externalPaymentId` — unique across all payments.

---

## 12. Transaction Ledger

All balance changes flow through the `transactions` table. Balance = `SUM(amount)` for a user. Types:

| Type | Description |

| ---------------------- | ------------------------------------------ |

| `deposit` | Money in from DK Bank |

| `withdrawal` | Money out to DK Bank |

| `bet_placed` | Debit when position is opened |

| `bet_payout` | Credit when position is won |

| `refund` | Credit when market is cancelled |

| `dispute_bond_lock` | Bond deducted when objecting |

| `dispute_bond_forfeit` | Bond lost (wrong objection) |

| `dispute_bond_reward` | Bond returned + reward (correct objection) |

| `referral_bonus` | Credit to referrer on referee's first bet |

| `free_credit` | Welcome bonus or daily credit |

| `streak_bonus` | Day-7 streak payout boost |

| `referral_prize` | Milestone prize for top referrers |

| `duel_wager` | Debit when duel is created/accepted |

| `duel_payout` | Credit to duel winner |

Each transaction stores `balanceBefore`, `balanceAfter`, and `isBonus` flag.

---

## 13. Free Credits & Bonus Balance

### Welcome Bonus

- **Nu 20** free credit on first registration (`isBonus: true`).

- `freeCreditGranted` flag prevents double-granting.

- `bonusBalance` tracks how much bonus credit is still in play.

### Daily Free Credit

- Scheduled job grants daily credit to active users.

- Delivered via Telegram DM notification.

### Bonus Payout Cap

- Winnings from bonus-origin bets capped at **Nu 50 withdrawable**.

- Excess above Nu 50 is re-credited as play-money (not withdrawable).

### Dev Environment

- Additional **Nu 1000** seed credits on top of welcome bonus for testing.

---

## 14. Reputation System

Four interlocking mechanisms:

### 1. Accuracy Score

```

raw = correctPredictions / totalPredictions

confidence = min(totalPredictions / 30, 1.0)

prior = 0.52 (CID-verified user) | 0.50 (organic)

score = raw × confidence + prior × (1 − confidence)

```

- Cold-start: CID-verified users start at 0.52 (slight accuracy head-start).

- Requires 30 predictions for full confidence weight.

- Deduplication: multiple bets on same market → only the last position counts.

### 2. Time Decay

```

decayFactor = exp(−ln2 × daysSinceLastActive / 365)

```

- At 365 days inactive: weight halves.

- At 730 days inactive: weight quarters.

- Stored score is unchanged — only real-time signal weighting is decayed.

### 3. Brier Score Calibration

```

brierScore = rolling average of (predictedProbability − actual)²

calibrationMultiplier = 1 − brierScore × 0.5

```

- Lower is better (0 = perfect, 1 = worst).

- Penalises overconfident predictions.

- `predictedProbability` stored per position at bet time.

### 4. Full Weight Multiplier (for LMSR signal)

```

weight = reputationMultiplier × decayFactor × calibrationMultiplier

reputationMultiplier = 0.5 + score (range ~0.5×–1.5×)

```

### Reputation Tiers

| Tier | Description |

| -------------- | ------------------------- |

| `rookie` | Default |

| `sharpshooter` | Consistent accuracy |

| `hot_hand` | Recent strong performance |

| `legend` | Long-term top performer |

### Category Scores

- Stored as JSONB `{ sports: { correct, total }, politics: { ... }, ... }`.

- Enables per-category leaderboards.

### Contrarian Badge

- Tracks users who bet against the Expert-weighted signal and win.

- Badges: `bronze` (3+ wins), `silver` (7+ wins), `gold` (15+ wins, ≥55% win rate).

---

## 15. Bet Streak System

- Tracks consecutive calendar days with at least one bet.

- Day counted per UTC date (YYYY-MM-DD).

- **Cycle:** 7 days. On Day 7:

- `boostActive = true` on that day's bet only.

- Payout multiplied by **1.2×** (20% bonus).

- `streakBoostUsed = true` to prevent double-fire.

- Cycle resets to Day 1 on day 8.

- If user misses a day: streak resets to 1.

- Multiple bets in the same day do not advance the streak.

- Telegram notification sent at Day 3 and Day 7 milestones.

---

## 16. Duel / Challenge System

Users can challenge each other to **1v1 duels** on any open market.

### Flow

1. **Create:** Creator picks an outcome, sets a wager amount (0 = bragging rights), optionally equips a Power Card.

2. **Share:** A shareable link is generated (Telegram deep-link or in-app link).

3. **Accept:** Any user with ≥5 predictions can join by picking the opposing outcome.

- Both users' wagers are locked (`Transaction(type=DUEL_WAGER)`).

4. **Active:** Status becomes `ACTIVE`. Both users' parimutuel bets on this market are blocked until duel settles.

5. **Settlement:** When market resolves, duel winner receives `2 × wagerAmount × (1 − 10% fee)`.

- `doubleDown` card waives the 10% fee → winner gets full `2×`.

6. **Expiry:** If no one joins within 72 hours → `EXPIRED`, wager refunded.

7. **Void:** If market is cancelled → `VOID`, wagers refunded.

### Eligibility

- Minimum **5 predictions** required to accept a duel.

- User cannot have an existing active duel on the same market.

### Card Effects in Duels

| Card | Effect |

| ------------ | ---------------------------------------------------- |

| `doubleDown` | Platform fee waived — winner gets full `2×` pot |

| `shield` | Creator's bet streak won't reset on a loss |

| `ghost` | Wager shows as `???` in the open feed until accepted |

---

## 17. Power Cards

Earned by reaching **duel win milestones**:

| Wins | Card Earned |

| ------- | ------------ |

| 3 wins | `doubleDown` |

| 7 wins | `shield` |

| 15 wins | `ghost` |

- Stored as JSONB `cardInventory: { doubleDown: N, shield: N, ghost: N }` per user.

- Cards are consumed when equipped on a duel.

- Multiple copies can stack (earn again at next milestone multiple).

---

## 18. Referral System

### Mechanics

1. Every user gets a referral code: `ref_<telegramId>`.

2. New user opens bot via deep-link `?startapp=ref_<telegramId>`.

3. On registration, `referredByUserId` is stored (once, never overwritten).

4. Self-referral is blocked.

### Rewards

- **Referrer bonus:** When the referred user places their **first bet**, the referrer receives a `REFERRAL_BONUS` credit (`Transaction`). `referralBonusTriggered = true` on the new user prevents double-fire.

- **Milestone prize:** When a referrer converts `REFERRAL_PRIZE_THRESHOLD` users, they receive a **Nu 500** prize pool payment. `referralPrizeClaimed = true` ensures once-only.

---

## 19. Leagues & Group Leaderboards

### Telegram Group Integration

- When the bot is added to a group, a `TelegramGroup` record is created/reactivated.

- When users send messages in the group, they're auto-registered as `GroupMembership` if they have an Oro account.

- When the bot is removed, the group is deactivated.

### Leaderboard

- Per-group leaderboard ranks members by `reputationScore`, prediction count, and win rate.

- Weekly leaderboard posted to group by cron job.

- `LeaderboardEntry` shape: `{ rank, userId, firstName, username, reputationScore, reputationTier, totalPredictions, winRate }`.

### Global Leaderboard

- Accessible in the Mini App via `TmaLeaderboardPage`.

- Rankings by reputation score across all users.

## 20. Oracle Orbit — Community Suggestion Hub

### Interaction Model: The Orbit

Unlike traditional list-based feeds, the Community Feed uses a physics-inspired "Oracle Orbit" UI where market suggestions float as glassmorphic bubbles (orbs).

- **Dynamic Scaling:** Orbs scale proportionally to their popularity (vote count), ranging from 80px to 140px.
- **Micro-Animations:** Bubbles drift, pulse, and orbit independently using optimized CSS keyframes (`orbFloat`, `orbPulse`, `orbDrift`).
- **Collision-Aware Placement:** An iterative placement algorithm ensures bubbles never overlap, maintaining a readable and high-end aesthetic even as more suggestions are added.

### Features

- **Ask the Crowd:** Users can "cast" their own market prophecies. Adding a prophecy triggers a celebratory confetti sequence and immediately injects a new orb into the hub.
- **Backing a Prophecy:** Users can support neighbor suggestions by upvoting. Successful votes trigger visual feedback (confetti) and increase the orb's size in real-time.
- **Glassmorphic UI:** High-blur background overlays (`backdrop-filter`) separate the social hub from the main market list, creating an immersive "focus mode."

### Implementation

- **Component:** `OracleOrbit.tsx` (state-managed hub).
- **Trigger:** A "Pulse" button (floating action button) integrated into the `TmaFeedPage`.
- **Styling:** Pure CSS animations for native performance inside the Telegram Mini App (TMA).

---

## 21. Telegram Bot

### Commands & Flows Handled by `bot.controller.ts`

- **`/start`** — Welcome message + "🚀 Open Oro" inline button opening the Mini App.

- **`/start ref_<id>`** — Referral deep-link registration.

- **Active markets broadcast** — Bot posts active markets list with a "Place your prediction" link.

- **Phone contact sharing** — User taps "Share Contact"; bot receives `message.contact`, HMAC-hashes the phone, stores `telegramPhoneHash`, sends OTP for DK Bank phone verification.

- **Group handling** — Auto-registers members, handles bot added/removed events for league management.

### Inline Keyboard Button

- Every bot message with market info includes: `{ text: "🚀 Open Oro", url: TELEGRAM_MINI_APP_URL }`.

- `TELEGRAM_MINI_APP_URL` environment variable controls the Mini App URL.

### Menu Button (Bottom-left of chat input)

- Configured in **BotFather** via `/setmenubutton` — not in code.

- Opens the Mini App directly when tapped.

### Channel Posts

- `TelegramSimpleService.postToChannel()` posts resolved market announcements to the public channel.

- `TELEGRAM_CHANNEL_ID` environment variable.

---

## 22. Real-Time Updates — WebSocket Gateway

- `MarketsGateway` (`@WebSocketGateway`) exposes a Socket.IO endpoint.

- Events emitted on bet placement and market settlement:

- `market:updated` — new odds/pool after each bet.

- `market:settled` — winner announced.

- Admin dashboard uses `useWebSocket` and `useRealTimeUpdates` hooks to subscribe.

- Frontend Mini App uses the same events to update live odds without polling.

---

## 23. Notifications Queue

BullMQ queue (`NOTIFICATION_QUEUE`) with the following job types processed by `NotificationProcessor`:

| Job | Trigger | Message |

| ------------------ | ------------------------- | ----------------------------------------------- |

| `PAYMENT_SUCCESS` | Deposit confirmed | "Your deposit of Nu X is confirmed" |

| `MARKET_SETTLED` | Market settled | Channel post: winner announced |

| `BET_RESULT` | Position settled | "You won / Better luck / Refunded" + payout |

| `STREAK_MILESTONE` | Day 3 or Day 7 bet streak | Streak progress or boost notification |

| `DAILY_CREDIT` | Daily cron credit grant | "Your daily free credit of Nu X has been added" |

All notifications delivered via `TelegramSimpleService.sendMessage(chatId, html)`.

---

## 24. Audit Log

Every admin action is recorded in `audit_logs` table via `AuditService.log()`.

Fields: `adminId`, `username`, `roleType` (`admin` \| `user`), `action`, `entityType`, `entityId`, `payload.before`, `payload.after`, `meta`, `ipAddress`, `createdAt`.

Key `AuditAction` values:

- `MARKET_CREATED`, `MARKET_UPDATED`, `MARKET_CANCELLED`

- `MARKET_PROPOSED`, `MARKET_RESOLVED`, `MARKET_SETTLED`

- `DISPUTE_REVIEWED`

- `USER_BANNED`, `USER_UPDATED`

- `PAYMENT_APPROVED`, `PAYMENT_REJECTED`

- `AUTO_RESOLVED` (from cron job)

Viewable in the admin dashboard `AuditLogPage` with filters: action, adminId, entity type, role type, date range, search.

---

## 25. Redis Usage

| Key Pattern | Purpose | TTL |

| ------------------------ | ------------------------ | -------------- |

| `lock:market:<marketId>` | Distributed bet lock | 15s |

| `Oro:otp:<paymentId>` | OTP session state | 10 min |

| Telegram OTP | Phone verification OTP | 60s |

| BullMQ queues | Notification job storage | Per job config |

`RedisService` wraps `ioredis` and exposes:

- `acquireLockWithRetry(key, ttl, retries, delay)` — returns lock token or throws `LOCK_CONTENDED`.

- `releaseLock(key, token)` — Lua-script atomic release.

- Standard `get/set/del`.

---

## 26. Market Discovery — Football Data Integration

`fifaService.ts` / `adminImportService.ts` in `oro-admin`:

- Fetches upcoming fixtures from `football-data.org` API.

- Admin can preview fixtures and import them as markets.

- Imported market fields: title, description, `opensAt`, `closesAt`, `externalMatchId`, `externalSource`, `externalMarketType` (`match-winner` or `over-under`).

- Auto-resolution: when a fixture result is available, the cron job can match `externalMatchId` to resolve the market automatically.

- Viewed in the admin `MarketDiscovery` page.

---

## 26. Admin Dashboard (`oro-admin`)

### Pages

| Page | Route Key | Purpose |

| ------------------- | ---------------- | ----------------------------- |

| `AdminDashboard` | `dashboard` | Overview stats + health check |

| `MarketManagement` | `markets` | CRUD for markets |

| `MarketDiscovery` | `discovery` | Import football fixtures |

| `KeeperDashboard` | `keeper` | Keeper/resolver role view |

| `SettlementPage` | `settlements` | Manage settlement payouts |

| `UserManagement` | `users` | View/manage users |

| `PaymentLogPage` | `payments` | Payment history |

| `AuditLogPage` | `audit` | Admin action audit trail |

| `ResolutionLogPage` | `resolution-log` | Market resolution history |

---

## 27. Admin Dashboard (oro-admin)

### Health Check

- `GET /api/admin/health` returns:

- `database`: status + latency (ms)

- `redis`: status + latency (ms)

- `memory`: RSS (MB), heap used (MB), heap total (MB), heap %

- `uptime` (seconds)

- `status`: `ok` \| `degraded` (triggered if RSS > 500 MB or heap > 95%)

- Displayed in `HealthCheck` component on dashboard, auto-refreshing every 30 seconds.

### Authentication

- Dev-secret login via `loginWithDevSecret(secret)` standalone function.

- Token stored in `sessionStorage`.

- Each sub-page reads `sessionStorage.getItem("admin_token")` and calls `useAdminApi(token)`.

### Key Admin Operations

- Create / edit / cancel markets

- Open / close markets (status transitions)

- Propose market resolution with evidence

- Review and finalise disputes

- Settle markets

- Import markets from football data

- View user profiles, link DK Bank manually

- View all payments, transactions, audit logs

---

## 28. Frontend Mini App (TMA)

### Pages

| Page | Purpose |

| --------------------- | ------------------------------------------ |

| `MarketsPage` | Browse open markets |

| `MarketDetailPage` | Market info, place bet, view odds |

| `ResolvedMarketsPage` | Settled market history |

| `TmaProfilePage` | User profile, reputation, stats |

| `TmaWalletPage` | Balance, deposit (DK Bank / TON), withdraw |

| `DKBankBetPage` | DK Bank deposit/bet flow |

| `TONBetPage` | TON wallet bet flow |

| `TmaChallengesPage` | Create/view duels |

| `TmaFeedPage` | Social prediction feed |

| `TmaLeaderboardPage` | Global leaderboard |

| `TmaSettingsPage` | App settings |

| `TONConnectPage` | TON wallet connect |

### TMA SDK Integration

- Uses `@telegram-apps/sdk-react` for:

- `miniApp.mount()` — initialise Mini App

- `retrieveLaunchParams()` — get `initData` and theme params

- Navigation via TMA back button

- Viewport and safe-area management

- Theme synchronisation with Telegram

### TON Connect

- Users can connect a TON wallet for alternative payments.

- `tonconnect-manifest.json` in `/public/`.

### Mock Environment

- `mockEnv.ts` simulates Telegram environment for local development outside Telegram.

- Injects fake `tgWebAppData`, theme params, viewport, and platform.

---

## 29. Security Design

| Concern | Implementation |

| ---------------- | -------------------------------------------------------------------------------- |

| initData forgery | HMAC-SHA-256 with secret derived from bot token; `timingSafeEqual` |

| initData replay | 24-hour freshness check on `auth_date` |

| Concurrent bets | Redis distributed lock + PostgreSQL pessimistic write lock |

| Phone identity | HMAC-SHA-256 of phone number (raw never stored) |

| OTP brute-force | Max 3 failed attempts; 10-minute session TTL |

| Admin access | Separate `AdminJwtGuard`; `isAdmin` flag in DB |

| Sensitive fields | `dkPhoneHash`, `telegramPhoneHash`, `phoneNumber` stripped from API responses |

| .env secrets | All `.env*` files gitignored; never committed |

| DK credentials | Trailing spaces in `DK_CLIENT_ID` can cause silent auth failures — trim on paste |

---

## 30. Database Entities Summary

| Entity | Table | Purpose |

| -------------------- | ------------------------ | ------------------------------------------------ |

| `User` | `users` | User profile, balance state, reputation, streaks |

| `AuthMethod` | `auth_methods` | OAuth/Telegram auth rows per user |

| `Market` | `markets` | Prediction market |

| `Outcome` | `outcomes` | Individual outcomes within a market |

| `Position` | `positions` | User bet on an outcome |

| `Payment` | `payments` | DK Bank payment records |

| `Transaction` | `transactions` | Immutable ledger of all balance changes |

| `Settlement` | `settlements` | Final settlement record per market |

| `Dispute` | `disputes` | User objections to proposed outcomes |

| `Challenge` | `challenges` | 1v1 duel records |

| `AuditLog` | `audit_logs` | Admin action log |

| `TelegramGroup` | `telegram_groups` | Telegram groups where bot is active |

| `GroupMembership` | `group_memberships` | User ↔ group membership |

| `Season` | `seasons` | League season periods |

| `PaymentOtp` | `payment_otps` | OTP session records |

| `DkGatewayAuthToken` | `dk_gateway_auth_tokens` | Cached DK Bank access tokens |

---

## 31. Environment Variables

### Backend (`backend/.env`)

| Variable | Purpose |

| ---------------------------- | ------------------------------------------------ |

| `DATABASE_URL` | PostgreSQL connection string |

| `REDIS_URL` | Redis connection string |

| `JWT_SECRET` | JWT signing secret |

| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |

| `TELEGRAM_MINI_APP_URL` | Mini App URL (used in bot buttons) |

| `TELEGRAM_CHANNEL_ID` | Channel for public market announcements |

| `DK_CLIENT_ID` | DK Bank OAuth client ID (**no trailing spaces**) |

| `DK_CLIENT_SECRET` | DK Bank OAuth client secret |

| `DK_MERCHANT_ID` | DK Bank merchant ID |

| `DK_MERCHANT_ACCOUNT_NUMBER` | DK Bank merchant account number |

| `DK_GATEWAY_URL` | DK Bank gateway base URL |

| `ADMIN_DEV_SECRET` | Secret for admin dashboard dev login |

| `NODE_ENV` | `development` \| `production` |

| `REFERRAL_PRIZE_THRESHOLD` | Number of conversions for referral prize |

### Admin Dashboard (`oro-admin/.env`)

| Variable | Purpose |

| ------------------- | ------------------------------------ |

| `VITE_API_BASE_URL` | Backend URL (must end with `/admin`) |

---

_Document generated from source code — April 2026._
