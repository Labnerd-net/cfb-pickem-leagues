# Spec for Email XSS and Rate Limiter IP Spoofing Fix

Title: Email XSS and Rate Limiter IP Spoofing Fix
Branch: claude/fix/email-xss-and-rate-limiter-ip-fix
Spec file: context/specs/email-xss-and-rate-limiter-ip-fix.md

## Summary

Two high-severity security issues to fix:

1. **[2] Email template XSS** — `rankingsUpdatedTemplate` in `packages/backend/src/notifications/templates.ts` interpolates `e.displayName` directly into an HTML table without escaping. A user whose display name contains `<script>...` or any HTML entity will have that content rendered raw in emails sent to all opted-in users.

2. **[3] Rate limiter IP spoofing** — `packages/backend/src/utils/rateLimiter.ts` trusts `x-forwarded-for` unconditionally. Any client can set this header to any value, effectively sharing or bypassing their rate-limit bucket. This is especially dangerous for the `authRateLimit` preset (5 attempts/15 min on login/register).

## Functional Requirements

- [2] All user-supplied strings (specifically `e.displayName`) embedded in `htmlBody` fields must be HTML-escaped before interpolation. The plain-text `textBody` does not require escaping.
- [2] HTML escaping must cover at minimum: `&`, `<`, `>`, `"`, `'`.
- [2] Escaping must be applied consistently across all templates that embed user-controlled data, not just `rankingsUpdatedTemplate`.
- [3] The rate limiter must fall back to the socket remote address (`c.env.incoming?.socket?.remoteAddress` or equivalent in Hono/Node) when `x-forwarded-for` is absent or untrusted.
- [3] A `TRUST_PROXY` environment variable (boolean, default `false`) should control whether forwarded IP headers are respected. When `false`, the rate limiter uses only the socket address.
- [3] When `TRUST_PROXY=true`, only the first IP in `x-forwarded-for` is used (already the current behavior for parsing, but it must only activate under the flag).

## Possible Edge Cases

- Display names that are already partially escaped (e.g., `&amp;`) — double-escaping must be avoided. Since display names are stored raw and never pre-escaped in the DB, a single-pass escape at render time is safe.
- Hono running behind a reverse proxy in production (Nginx, Traefik) where `x-forwarded-for` is legitimately set by the proxy. The `TRUST_PROXY` flag must allow this use case to work.
- `c.req.header('x-forwarded-for')` returns a comma-separated list when multiple proxies are involved; only the first entry (leftmost, client IP) should be used.
- Socket address may be unavailable in certain edge environments. The fallback should be `'unknown'` (preserving current behavior), not a crash.
- `textBody` in `rankingsUpdatedTemplate` uses display names too — confirm these do not need escaping (plain text, not rendered as HTML).

## Acceptance Criteria

- [ ] A display name of `<script>alert(1)</script>` in the leaderboard produces a safe, escaped string (`&lt;script&gt;alert(1)&lt;/script&gt;`) in the email HTML, not executable JS.
- [ ] All other fields in `htmlBody` that are derived from user input are escaped (audit all templates).
- [ ] `week` and `year` numeric fields do not need escaping (they are numbers, not user strings).
- [ ] With `TRUST_PROXY=false` (default), setting `x-forwarded-for: 1.2.3.4` in a request does not change the rate-limit key — the socket address is used.
- [ ] With `TRUST_PROXY=true`, the rate limiter uses the first IP from `x-forwarded-for`.
- [ ] `npm run build` passes with no errors.
- [ ] Existing rate limiter behavior (window, count, headers) is unchanged beyond IP resolution.

## Open Questions

- Should `TRUST_PROXY` be a new env var, or should we derive it from existing config (e.g., `NODE_ENV=production` implies a proxy)? Leaning toward explicit env var for clarity. - new var
- Should we use a small library (`he`) for HTML escaping, or a hand-rolled utility? The `he` library is more complete (handles named entities) but adds a dependency. For this use case a small inline utility covering the 5 critical characters is sufficient and avoids a new dep. - inline 

## Testing Guidelines

Create or extend test files in `./tests` for:

- **`templates.test.ts`** (backend):
  - `rankingsUpdatedTemplate` with a display name containing `<`, `>`, `&`, `"`, `'` — assert that `htmlBody` contains the escaped form and does not contain the raw characters.
  - `rankingsUpdatedTemplate` with a normal display name — assert output is unchanged.

- **`rateLimiter.test.ts`** (backend):
  - With `TRUST_PROXY=false`: a request with `x-forwarded-for: 1.2.3.4` is rate-limited by socket address, not by `1.2.3.4`.
  - With `TRUST_PROXY=true`: a request with `x-forwarded-for: 1.2.3.4` is rate-limited by `1.2.3.4`.

## Personal Opinion

Both fixes are straightforward and clearly worth doing. Item [2] is a real XSS risk — display names are user-controlled and any opted-in user receives the email, so the blast radius is everyone. Item [3] is lower practical risk for a small self-hosted app (no shared hosting, likely single-instance behind a known proxy), but it's a correctness issue for the auth rate limiter specifically and worth fixing cleanly.

Neither change is complex. The escaping utility is ~10 lines; the `TRUST_PROXY` flag adds one env var and a conditional. Bundling them in one fix branch is fine since they're both small and independent.
