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
### Low
_None identified._

---

## Improvements & Refactors

### High
_None identified._

### Medium
_None identified._

### Low
_None identified._

---

## Feature Ideas

### High
_None identified._

### Medium
- **#22 [packages/backend/src/db/dbUserFunctions.ts, packages/backend/src/routes/user.ts]**: `GET /user/history` endpoint and `returnUserPickHistory()` DB function already exist, but there is no frontend UI to browse full pick history. Create a `PickHistoryView.tsx` component with season/week/outcome filters, surfaced as a new Dashboard tab or collapsible section.
- **#24 [packages/backend/src/cron/cronTick.ts, packages/backend/src/notifications/]**: No admin-configurable "picks open" reminder exists. The end-of-week standings digest already fires automatically via `rankings_updated` in the cron. The missing piece is a weekly reminder at a configurable day/time with two behaviors: (1) if games have been curated for the active week, send the normal picks-open reminder to all users; (2) if no games exist yet, send an admin-only notification prompting them to add games — the standard `games_ready` only fires after curation, so without this an admin who forgot would get no reminder at all. Would require a `scheduled_notifications` DB table or a stored cron schedule; reuses existing `dispatcher.ts` and `templates.ts`.

### Low
- **#25 [packages/backend/src/db/dbUserFunctions.ts:141–158]**: `deleteUserWithAudit()` exists in the DB layer but there is no API route or frontend UI for account self-deletion. Add `DELETE /api/user/account` (with password confirmation) and an "Account Management" section in Settings.

---

## Summary

| Category | High | Medium | Low | Total |
|----------|------|--------|-----|-------|
| Security | 1 | 0 | 0 | 1 |
| Bugs | 0 | 0 | 0 | 0 |
| Performance | 0 | 1 | 0 | 1 |
| Improvements & Refactors | 0 | 0 | 0 | 0 |
| Feature Ideas | 0 | 2 | 1 | 3 |
| **Total** | **1** | **3** | **1** | **5** |
