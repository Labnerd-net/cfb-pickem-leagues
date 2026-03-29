# Project Backlog

> Generated: 2026-03-26
> Focus: Full audit

---

## Security

### High
- **#1 [packages/backend/src/db/index.ts:15, scripts/migrate-prod.ts:15]**: SSL is configured with `rejectUnauthorized: false`, disabling certificate validation entirely. Anyone on the same network path as the DB can intercept credentials and query results (MITM). Fix: replace with `{ ssl: { rejectUnauthorized: true, ca: fs.readFileSync('/path/to/ca.pem') } }` using the actual CA cert from your hosting provider.

### Medium
_None identified._

### Low
_None identified._

---

## Bugs

### High
_None identified._

### Medium
_None identified._

### Low
_None identified._

---

## Performance

### High
_None identified._

### Medium
- **#8 [packages/backend/src/notifications/dispatcher.ts:54–77]**: Emails are sent sequentially in a `for` loop. At 15 users this is fine, but slow SMTP will hold the event loop open for all sends. Fix (when needed): convert to `Promise.allSettled` with per-user catch blocks.
- **#9 [packages/frontend/src/pages/Dashboard.tsx:23–28]**: All four tab section components are mounted unconditionally on initial load, triggering API calls for every section even when only the first tab is visible. Fix: lazy-mount tab content on first activation, or conditionally render only the active tab.

### Low
_None identified._

---

## Improvements & Refactors

### High
_None identified._

### Medium
- **#14 [packages/frontend/src/components/admin/UsersSection.tsx]**: 295-line component handling four distinct responsibilities: user list fetching, role toggling, CSV export (including DOM manipulation), and broadcast notification form. Fix: extract CSV export into a `lib/` utility and the broadcast dialog into a `BroadcastDialog.tsx` component.
- **#15 [packages/frontend/src/components/user/useWeekGames.ts]**: 240-line hook mixing initialization, year/week navigation side effects, pick submission, and snackbar state. Fix: split into two hooks — one for week/year navigation, one for pick submission. Low urgency at current scale.

### Low
- **#19 [packages/frontend/src/components/user/WeekGameSection.tsx:40–91]**: Props are drilled through `UserWeekSelector` → `WeekPicksView` → `UserPicksGameCard`. Not painful at current scale, but consider a `WeekGameContext` if the chain grows.

---

## Feature Ideas

### High
- **#21 [packages/frontend/src/components/user/UserPicksGameCard.tsx]**: Games silently become unclickable with a "LOCKED" chip — no advance warning. Add a countdown timer to game cards (highlight red when <1 hour to kickoff), and consider an "unsaved picks" warning dialog when the first game of the week is about to lock.

### Medium
- **#22 [packages/backend/src/db/dbUserFunctions.ts, packages/backend/src/routes/user.ts]**: `GET /user/history` endpoint and `returnUserPickHistory()` DB function already exist, but there is no frontend UI to browse full pick history. Create a `PickHistoryView.tsx` component with season/week/outcome filters, surfaced as a new Dashboard tab or collapsible section.
- **#24 [packages/backend/src/cron/cronTick.ts, packages/backend/src/notifications/]**: No recurring admin-configurable notifications exist. Consider: weekly "picks open" reminder at a configurable day/time, and end-of-week standings digest after all games complete. Would require a `scheduled_notifications` DB table; reuses existing `dispatcher.ts` and `templates.ts`.

### Low
- **#25 [packages/backend/src/db/dbUserFunctions.ts:141–158]**: `deleteUserWithAudit()` exists in the DB layer but there is no API route or frontend UI for account self-deletion. Add `DELETE /api/user/account` (with password confirmation) and an "Account Management" section in Settings.

---

## Summary

| Category | High | Medium | Low | Total |
|----------|------|--------|-----|-------|
| Security | 1 | 0 | 0 | 1 |
| Bugs | 0 | 0 | 0 | 0 |
| Performance | 0 | 2 | 0 | 2 |
| Improvements & Refactors | 0 | 2 | 1 | 3 |
| Feature Ideas | 1 | 2 | 1 | 4 |
| **Total** | **2** | **6** | **2** | **10** |
