# Spec for league-member-ads

Title: League Member Business Ads
Branch: claude/feature/league-member-ads
Spec file: context/specs/league-member-ads.md

## Summary
A per-league, admin-toggleable feature that lets league members advertise their real profession/business to the rest of their league (e.g. "my MSP company", "my wife's singing"). Each member can set a business name, tagline, and link; ads display somewhere in the league UI when the feature is enabled for that league. Built as a self-contained slice on Cloudflare D1 (not Neon/Postgres) so it stays cheap and fully removable without touching the core schema.

## Functional Requirements
- League admins can turn the feature on/off per league (off by default for existing leagues).
- When enabled, any league member can create/edit/delete their own single ad: business name, short tagline/description, and a link (URL).
- When disabled, the ad editing UI and display are hidden for that league; existing ad data is preserved (not deleted) so re-enabling restores it.
- Ads are only visible to members of the same league — no cross-league display.
- Ads display in a dedicated section (e.g. a "League Sponsors" panel/strip) rather than mixed into game/pick data.
- All ad data lives in a separate Cloudflare D1 database, with its own schema, migrations, DB access module, routes, and frontend files — isolated from the existing Neon-backed `dbXFunctions.ts` files so the feature can be deleted by removing its own files/binding.
- Backend enforces the enabled/disabled flag on writes (not just hidden in the UI).

## Possible Edge Cases
- League admin disables the feature while members have existing ads saved — data must persist, not be wiped.
- A member submits a non-http(s) URL (e.g. `javascript:`) — must be rejected server-side.
- A member leaves the league or is removed — their ad should stop displaying (or be deleted) for that league.
- Very long business name/tagline input — needs a length cap to avoid layout breakage.
- Empty/blank submission — should be treated as "no ad" rather than displaying an empty card.
- League has zero ads submitted yet, feature enabled — display should show nothing or an empty state, not an error.
- D1 binding missing/misconfigured in an environment (e.g. local dev without D1) — feature should fail gracefully (e.g. hidden or clear error), not crash the app.

## Acceptance Criteria
- [ ] League admin can toggle the feature on/off from League Settings.
- [ ] With the feature on, a member can add/edit/remove their own ad (name, tagline, link).
- [ ] With the feature off, the ad UI is hidden and the write endpoint rejects requests for that league.
- [ ] Ads are scoped correctly — only visible within the owning league, never cross-league.
- [ ] Invalid URLs (non-http/https schemes) are rejected with a clear error.
- [ ] All new code lives in isolated files (new D1 schema, new route file, new DB functions file, new frontend api/component files) with no changes required to existing Neon schema or core route files beyond mounting the new route and adding the toggle to League Settings.
- [ ] Feature can be fully removed by deleting the new files and the D1 binding, with no leftover references in core code.

## Open Questions
- Where exactly should ads display — Dashboard sidebar, a tab, the Leaderboard page, League Settings only? Needs a placement decision before implementation.
- Any character limits desired for business name/tagline beyond a reasonable technical cap (e.g. 60/200 chars)?

## Decisions
- One ad per user per league (no multiples).
- No special admin moderation beyond the league-level on/off toggle — members manage only their own ad.
- Ad content is structured data, not an uploaded/designed image: business name, tagline, link, and an optional **photo/logo URL** (user pastes a link to an image they already host elsewhere — no file upload or object storage built for this).
- Photo/logo renders as a fixed square (e.g. 300×300, `object-fit: cover`, optionally circular) inside a consistent card template the frontend defines once; the `<img>` needs an `onError` fallback to a placeholder since the pasted URL isn't controlled by the app and can go dead or change later.

## Testing Guidelines
Create test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Toggling the feature on/off updates league settings and is enforced server-side on write endpoints.
- Creating, updating, and deleting a member's own ad.
- Rejecting a non-http(s) URL.
- Ads are scoped per league (a member of League A cannot see/write League B's ads).
- Feature-disabled league rejects ad writes even if the request is otherwise valid.

## Personal Opinion
This is a good, low-risk feature: it's opt-in per league, isolated from the core schema, and matches a real want (fun for a family league) without touching anything that affects scoring, picks, or auth. Complexity is low — the main design decision to nail down before coding is D1 setup (new binding, new Drizzle SQLite schema, D1 migrations via wrangler) since that's a different toolchain than the existing Neon/drizzle-kit flow, and the two open questions on placement and per-user cardinality should be answered before writing the plan so the schema doesn't need reshaping mid-implementation.
