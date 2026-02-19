# Spec for admin-users-tab

branch: claude/feature/admin-users-tab

## Summary
Add a third tab to the Dashboard page, visible only to admin users, that lists all registered users with their display name, email, and roles. The backend endpoint already exists (`POST /admin/users`); this feature is primarily a frontend concern, though the HTTP method on the backend endpoint should also be corrected to GET.

## Functional Requirements
- A new "Users" tab appears in the admin tab bar alongside "My Dashboard" and "Admin Controls"
- The tab is only rendered when the logged-in user has the `admin` role (same guard already used in Dashboard.tsx)
- Clicking the tab loads and displays a list of all registered users
- Each row in the list shows: display name, email, and roles
- Roles should be rendered as readable labels (e.g. "admin", "user"), not raw array syntax
- The list should indicate a loading state while the request is in flight
- If the request fails, display an error message to the admin
- If there are no users (impossible in practice but worth handling), show an empty-state message
- The backend route `POST /admin/users` should be changed to `GET /admin/users` since it reads data and has no request body

## Possible Edge Cases
- A user with multiple roles should display all of them
- The currently logged-in admin appears in the list alongside other users — that is expected and correct
- The password hash must never be sent or displayed; the backend already returns `ProfileData` which excludes it
- Network or auth errors should be surfaced clearly, not silently swallowed

## Acceptance Criteria
- The "Users" tab is visible in the Dashboard only when `isAdmin` is true
- Non-admin users see no trace of the tab or its content
- All registered users are listed with display name, email, and roles after the tab is selected
- Roles are human-readable, not rendered as raw JSON/array syntax
- Loading and error states are handled visibly
- The backend route responds to `GET /admin/users` (not `POST`)
- The frontend API call uses `GET`

## Open Questions
- Should the admin be able to edit or delete users from this view, or is it read-only for now? (Assuming read-only based on the request.) - read only for now.  we will add editing and deleting capabilities later
- Should roles be editable inline (e.g. promoting a user to admin)? If so, that is out of scope for this feature. - not yet.  editing will come later
- Is pagination needed? The user count is likely small for now, so a flat list is acceptable. Add a note if you expect this to grow.  - no pagination is needed.

## Testing Guidelines
Create a test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:
- Frontend API function: `getUsers()` returns the user list on a successful 200 response
- Frontend API function: `getUsers()` surfaces the error message on a non-200 response
- Backend route: `GET /admin/users` returns 200 with user profiles for an authenticated admin
- Backend route: `GET /admin/users` returns 403 when called by a non-admin user
- Backend route: `GET /admin/users` returns 401 when called without a token

## Personal Opinion
This is a straightforward, low-risk read-only feature. The backend already has `returnUsers()` and the endpoint skeleton; the tab infrastructure in Dashboard.tsx is already in place. The only real concern is correcting `POST` to `GET` on the backend route — it is a minor breaking change to the route method that is easy to miss if anything outside the app is calling it. Overall, this is a good idea and the right scope for a single feature.
