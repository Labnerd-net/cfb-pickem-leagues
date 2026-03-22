# Spec for Backlog Fixes: Timezone, Tab Indices, Env Validation, Log Pagination

Title: Backlog Fixes: Timezone, Tab Indices, Env Validation, Log Pagination
Branch: claude/fix/backlog-fixes-timezone-tabs-env-log
Spec file: context/specs/backlog-fixes-timezone-tabs-env-log.md

## Summary

Four unrelated low-priority backlog items addressed together. Three are one-liners or small refactors ([30], [31], [33]); one requires a backend query param + frontend UI change ([28]).

---

### [30] Email Timezone — `templates.ts`
Kickoff times in reminder emails are formatted with `toLocaleString` without an explicit timezone, so the output reflects the server's local timezone, which is meaningless to recipients.

### [31] Dashboard Tab Index Brittleness — `Dashboard.tsx`
The tab-to-component mapping uses `currentTab === 0`, `currentTab === 1`, etc. Adding or removing a tab requires manually renumbering every subsequent condition.

### [33] Lazy Env Var Validation — `envVars.ts`
Environment variables are read individually at the point of use. A missing required variable fails silently or throws a cryptic error at runtime rather than at startup.

### [28] Notification Log Pagination — `admin.ts` + `NotificationLogSection.tsx`
The notification log is capped at 500 rows with no pagination. Over multiple seasons this silently truncates older records with no indication in the UI.

---

## Functional Requirements

**[30]**
- Kickoff times in email templates must be formatted with an explicit timezone
- Use Eastern Time (`America/New_York`) as the display timezone since the majority of CFB games kick off in Eastern-relevant windows
- If a UTC fallback is preferred, format as `HH:MM UTC` with an explicit label — no silent server-tz bleed

**[31]**
- Replace the chain of `currentTab === N` ternaries in `Dashboard.tsx` with a data-driven structure (e.g., an array of tab descriptors)
- The rendered output must be identical — no visual or behavioral change
- Adding a new tab in the future should require only adding one entry to the array, not renumbering anything

**[33]**
- All required environment variables must be validated at server startup using Zod
- If a required variable is missing or invalid, the process must exit with a clear, descriptive error message before accepting any requests
- Optional variables with defaults should use `.default()` — they must not cause a startup failure if absent
- The validation must cover all variables currently read from `process.env` across the backend

**[28]**
- `GET /admin/notification-logs` must accept `limit` and `offset` query params
- Default `limit` should be 50; default `offset` should be 0
- The hardcoded 500-row cap should remain as a server-side safety ceiling, with a code comment explaining it
- The frontend `NotificationLogSection` must show paginated navigation (previous/next or page numbers) when the total result count exceeds the page size
- The UI should indicate how many total records exist and which page is being viewed

## Possible Edge Cases

**[30]**
- DST transitions: `America/New_York` handles this correctly via the IANA database; no special handling needed

**[33]**
- Variables that are optional in some environments (e.g., `CFBD_API_KEY` only required when `DATA_SOURCE=cfbd`) should use conditional validation — a missing `CFBD_API_KEY` when `DATA_SOURCE=ncaa` must not be a startup error
- `envVars.js` currently uses `.js` extension in a TypeScript project — the fix may need to handle the file extension inconsistency

**[28]**
- If `offset` exceeds the total record count, the response should return an empty array (not an error)
- The total count must be returned in the response so the frontend can render correct pagination controls

## Acceptance Criteria

- **[30]** Reminder emails display kickoff times in Eastern Time (or explicit UTC), not server-local time
- **[31]** Dashboard tab rendering is driven by an array; sequential index conditions are gone; behavior is unchanged
- **[33]** Starting the backend with a missing required env var prints a clear error and exits before the HTTP server binds
- **[33]** Starting with all required vars present proceeds normally
- **[28]** `GET /admin/notification-logs?limit=50&offset=0` returns the first 50 records
- **[28]** The notification log UI shows pagination controls and navigates correctly between pages

## Open Questions

- **[30]** Should the timezone be hardcoded to `America/New_York`, or should it be a new env var (`TIMEZONE`)? Given target scale (15–20 users, single operator), hardcoding Eastern is simpler and likely correct. - we are in the central timezone so `America/Chicago` would be more appropriate
- **[28]** Should the total count come back as a response header (`X-Total-Count`) or in the JSON body? Body is simpler given the Hono RPC typed client. - body is good

## Testing Guidelines

- **[30]** Unit test: given a `Date` object, the formatted string contains `ET` or `UTC` (not a bare number that could be local-tz)
- **[33]** Unit test: missing a required var causes the validator to throw; all vars present passes validation; `DATA_SOURCE=ncaa` with no `CFBD_API_KEY` passes
- **[28]** Unit/route test: `GET /admin/notification-logs` with `limit=2&offset=0` returns 2 records; with `offset` beyond total returns empty array

## Personal Opinion

All four are legitimate fixes worth making.

- **[30]** is a correctness bug — server-local timezone in emails is actively wrong. Straightforward fix.
- **[31]** is a maintainability refactor with zero risk — good to do before another tab gets added.
- **[33]** is the most impactful: fail-fast env validation is a quality-of-life improvement for deployment and worth the moderate effort. One wrinkle: `envVars.js` using `.js` in a TS project may require touching the file extension or adding a type declaration — worth investigating before implementation.
- **[28]** is the most work. At 15–20 users one season the 500-row cap won't be hit, but it's a latent correctness issue and the pagination work is reasonable. The bigger concern is that the total count query adds a second DB round-trip per page load — acceptable at this scale but worth noting.
