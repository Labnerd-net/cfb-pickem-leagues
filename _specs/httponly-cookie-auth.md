# Spec for httponly-cookie-auth

branch: claude/feature/httponly-cookie-auth

## Summary

Move the JWT from localStorage to an httpOnly cookie. The 7-day expiry is preserved. This eliminates the XSS exposure of the long-lived credential without introducing the complexity of refresh token rotation. Logout must hit the server to clear the cookie.

## Functional Requirements

- On successful login or registration, the server sets the JWT as an httpOnly, SameSite=Strict, Secure cookie instead of returning it in the response body
- The frontend no longer stores the token in localStorage or reads it from there
- All authenticated API requests automatically include the cookie (browser handles this natively)
- Logout sends a request to the server, which clears the cookie via Set-Cookie with an expired date
- The server reads the JWT from the cookie header rather than the Authorization Bearer header
- The auth middleware must support reading the token from the cookie
- The existing 7-day expiry is unchanged
- On page load, the frontend determines auth state by calling a `/auth/me` or equivalent endpoint rather than reading from localStorage
- If the JWT cookie is absent or invalid, the server returns 401 and the frontend redirects to login

## Possible Edge Cases

- CSRF: SameSite=Strict should mitigate same-site request forgery for most cases; document why no additional CSRF token is needed (or add one if cross-origin use cases exist)
- Mixed HTTP/HTTPS in local dev: the Secure flag must be conditional on environment so local dev still works over HTTP
- Multiple tabs: all tabs share the cookie, so logout in one tab should eventually reflect in others (no special handling needed beyond the existing session model)
- Clock skew: expiry enforcement is unchanged, this is not a new concern
- Existing sessions: users with tokens currently in localStorage will be silently logged out after deploy; this is acceptable given the small user base

## Acceptance Criteria

- After login, no JWT is present in localStorage
- Browser DevTools shows the httpOnly cookie set with the correct flags (httpOnly, SameSite=Strict, Secure in production)
- Authenticated requests succeed without any Authorization header being manually attached by frontend code
- Calling logout clears the cookie and subsequent authenticated requests return 401
- Refreshing the page preserves the authenticated session
- The frontend correctly reflects auth state (logged in / logged out) based on the `/auth/me` response, not localStorage

## Open Questions

- Should the `Authorization: Bearer` header path be kept as a fallback for API clients or tooling (e.g. Drizzle Studio, curl testing)? Or removed entirely to simplify the middleware? - remove entirely
- Is CSRF protection needed? The app is same-origin only today, but worth confirming there are no cross-origin POST flows planned - no it is same-origin always
- Should `/auth/me` return the full profile (email, displayName, roles) so the frontend AuthContext can be populated from it, or is a minimal `{ authenticated: true }` sufficient? - return the full profile

## Testing Guidelines

Create test files in the `./tests` folder for the following cases, without going too heavy:

- Login response sets the cookie with correct flags and does not include the token in the response body
- Authenticated request with a valid cookie succeeds
- Authenticated request with no cookie returns 401
- Authenticated request with an expired or malformed cookie returns 401
- Logout clears the cookie (Set-Cookie with max-age=0 or past expiry)
- `/auth/me` returns profile data when cookie is valid, 401 when not

## Personal Opinion

This is a good change and worth doing. Moving from localStorage to httpOnly cookie is a well-understood, low-risk improvement with a clear security benefit. The scope is manageable: the server-side change is mostly in the auth middleware and login/logout handlers, and the frontend change is removing the manual token plumbing and replacing the localStorage auth check with an `/auth/me` call.

The one thing to get right is not introducing complexity that doesn't belong here. Specifically: do not add refresh token rotation as part of this change. That can be evaluated separately if there is ever a real need for revocation. Scope this strictly to cookie transport.

Concern: the `/auth/me` endpoint adds a network round-trip on every page load to determine auth state. This is a minor UX regression vs. the synchronous localStorage read. It can be mitigated by showing a loading state briefly on initial render, which is standard practice.
