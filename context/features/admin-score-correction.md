# Plan: Admin Score Correction

## Context

The existing `markGameComplete()` DB function and `POST /admin/games/complete` route are dev/test-only (production is hard-blocked). When CFBD API returns wrong final scores, an admin has no UI path to fix them — direct DB access is required. This adds a production-safe `PATCH /admin/games/:gameId/score` endpoint, an `admin.score_corrections` audit table, and a "Correct Score" dialog on the admin GameCard for picked games.

---

## Files to Modify / Create

### Backend

| File | Change |
|------|--------|
| `packages/backend/src/db/schema/admin.ts` | Add `scoreCorrections` table |
| `packages/backend/src/db/dbAdminFunctions.ts` | Add `correctGameScore()` function |
| `packages/backend/src/utils/zValidate.ts` | Add `correctGameScoreValidator` |
| `packages/backend/src/routes/admin.ts` | Add `PATCH /games/:gameId/score` route |
| `packages/backend/tests/routes/admin.test.ts` _(or new file)_ | Route tests for score correction |
| `packages/backend/tests/db/dbAdminFunctions.test.ts` _(or new file)_ | DB function tests |

### Shared

| File | Change |
|------|--------|
| `packages/shared/types/cfb-pickem-api.ts` | Add `CorrectGameScoreRequest` type |

### Frontend

| File | Change |
|------|--------|
| `packages/frontend/src/apis/adminRequests.ts` | Add `correctGameScore()` API function |
| `packages/frontend/src/components/admin/GameCard.tsx` | Add dialog + "Correct Score" button |
| `packages/frontend/src/components/admin/GamesList.tsx` | Thread `onGameCorrected` callback |
| `packages/frontend/src/hooks/useGameManagement.ts` | Add handler to update game in list |

---

## Step-by-Step Implementation

### 1. DB Schema — `admin.ts`

Add `scoreCorrections` table to the `admin` pgSchema:

```
scoreCorrections:
  id           serial PK
  gameId       int  NOT NULL  FK → adminGames.gameId (CASCADE delete)
  correctedBy  int  NOT NULL  FK → user.users.userId (no action on delete — preserve audit)
  correctedAt  timestamp  NOT NULL  defaultNow()
  oldHomePoints  int nullable   (null if game had no score before)
  oldAwayPoints  int nullable
  newHomePoints  int NOT NULL
  newAwayPoints  int NOT NULL
```

After adding the table, run:
```
cd packages/backend && pnpm generate && pnpm migrate
```

### 2. DB Function — `correctGameScore()`

New function in `dbAdminFunctions.ts`. Wrap in `db.transaction()`:

1. Read current game row (to capture old scores for audit).
2. If game not found, return null.
3. Compute `winningTeam` from new scores (same logic as `markGameComplete`).
4. Update `adminGames` row: `completed = true`, `homePoints`, `awayPoints`, `winningTeam`.
5. Insert row into `scoreCorrections` with before/after values and `correctedBy`.
6. Return updated game row.

Signature:
```ts
correctGameScore(
  gameId: number,
  homePoints: number,
  awayPoints: number,
  correctedBy: number
): Promise<AdminDbGameData | null>
```

Reuses: `winningTeam` calculation logic (inline, same 3-line pattern as `markGameComplete`).

### 3. Validation — `zValidate.ts`

Add `correctGameScoreBodyValidator`:
- body schema: `{ homePoints: z.number().int().min(0), awayPoints: z.number().int().min(0) }`
- param schema: `{ gameId: z.coerce.number().int().positive() }` — use `zValidator('param', ...)`

Two separate validators exported: `correctGameScoreParamValidator` and `correctGameScoreBodyValidator`.

### 4. Route — `PATCH /admin/games/:gameId/score`

Add after the existing `/games/complete` handler in `admin.ts`:

```
.patch(
  '/games/:gameId/score',
  apiRateLimit,
  authMiddleware,
  requireRole('admin'),
  correctGameScoreParamValidator,
  correctGameScoreBodyValidator,
  async c => {
    const { gameId } = c.req.valid('param');
    const { homePoints, awayPoints } = c.req.valid('json');
    const userId = c.get('jwtPayload').userId;   // correctedBy

    const updated = await dbAdminFunctions.correctGameScore(gameId, homePoints, awayPoints, userId);
    if (!updated) throw new HTTPException(404, { message: 'Game not found' });

    // Fire rankings_updated if all picked games for the week are now complete
    const weekGames = await dbAdminFunctions.returnPickedGames({
      year: updated.year,
      week: updated.weekNumber,
    });
    if (weekGames.length > 0 && weekGames.every(g => g.completed)) {
      dispatchNotification({ notificationType: 'rankings_updated', ... });
    }

    return c.json(updated);
  }
)
```

No `NODE_ENV` guard. Auth: admin role only.

### 5. Shared Type — `cfb-pickem-api.ts`

```ts
export type CorrectGameScoreRequest = {
  homePoints: number;
  awayPoints: number;
};
```

### 6. Frontend API — `adminRequests.ts`

```ts
export async function correctGameScore(
  gameId: number,
  request: CorrectGameScoreRequest
): Promise<{ success: boolean; data?: AdminGameWire; error?: string }>
```

Calls `client.api.admin.games[':gameId'].score.$patch({ param: { gameId: String(gameId) }, json: request })`.

Follow the existing try/catch + `res.ok` pattern used throughout `adminRequests.ts`.

### 7. Frontend UI — `GameCard.tsx`

Add local state: `dialogOpen: boolean`, `homeInput: string`, `awayInput: string`, `submitting: boolean`, `dialogError: string | null`.

Add props:
- `onGameCorrected?: (updated: AdminDbGameData) => void` — optional so existing callers don't break

Render a small icon button (EditIcon or ScoreboardIcon) in the top-right area, visible only when `game.picked === true`. Clicking opens a `<Dialog>`:
- Title: "Correct Score"
- Game label: `{awayTeam} @ {homeTeam}`
- Two `<TextField>` inputs: "Away Points" (pre-filled if `game.awayPoints !== null`) and "Home Points" (pre-filled if `game.homePoints !== null`)
- "Save" button (disabled while submitting)
- Inline error text if `dialogError` is set
- On save: call `correctGameScore(game.gameId, ...)`, on success call `onGameCorrected(data)` and close dialog

### 8. Frontend — Thread Callback

**`GamesList.tsx`**: add `onGameCorrected?: (updated: AdminDbGameData) => void` prop, pass down to each `GameCard`.

**`useGameManagement.ts`** (or wherever games array state lives): add `handleGameCorrected(updated: AdminDbGameData)` that replaces the matching game in the array by `gameId`.

Wire: `AdminSection` or `GamesList` consumer passes `handleGameCorrected` down to `GamesList`.

---

## Reused Utilities

- `winningTeam` calculation logic (inline 3-line pattern from `markGameComplete`)
- `returnPickedGames()` for the notification trigger check
- `apiRateLimit`, `authMiddleware`, `requireRole` middleware
- `dispatchNotification` for `rankings_updated`
- Existing `AdminGameWire` / `InferResponseType` pattern for RPC types
- `extractError()` helper in `adminRequests.ts`

---

## Verification

1. `cd packages/backend && pnpm generate && pnpm migrate` — migration applies cleanly
2. `pnpm build` — no TypeScript errors
3. `pnpm test:backend` — new route + DB function tests pass
4. Manual: in browser dev environment, load a picked game, click "Correct Score", enter scores, confirm — game card updates with new score inline, no full reload
5. Verify audit row appears in `admin.score_corrections` via Drizzle Studio
6. Verify `rankings_updated` notification fires when correcting the last incomplete picked game in a week
