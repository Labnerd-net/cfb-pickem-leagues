# Spec for Admin Password Reset

Title: Admin Password Reset
Branch: claude/feature/admin-password-reset
Spec file: context/specs/admin-password-reset.md

## Summary

Admins can reset any user's password from the Users table in the admin dashboard. A "Reset Password" button per user row opens a dialog where the admin enters and confirms a new password. The backend validates, hashes, and saves it. No email is sent; the admin communicates the new password to the user out-of-band.

## Functional Requirements

- Each user row in the Users table has a "Reset Password" button (hidden for the currently logged-in admin)
- Clicking the button opens a dialog with two fields: New Password and Confirm Password
- The dialog validates that both fields match and that the password meets the existing password policy (min 8, max 72 chars)
- On submit, the frontend calls `PATCH /api/admin/users/:id/password` with the new password
- The backend endpoint is admin-only, validates the password with the existing `validatePassword()` util, hashes it with bcrypt, and updates the user's `passwordHash` in the DB
- On success, the dialog closes with a brief success message in the Users section
- On failure, the dialog shows the error message returned by the backend

## Possible Edge Cases

- Admin attempts to reset their own password — block this (user should use the Settings page instead)
- User does not exist — backend returns 404
- Password fails validation — backend returns 400 with the validation message
- Two admins attempt to reset the same user's password simultaneously — last write wins, acceptable at this scale

## Acceptance Criteria

- "Reset Password" button appears on every user row except the currently logged-in admin's own row
- Dialog requires both fields and enforces that they match before enabling submit
- Successful reset closes the dialog and shows a success alert in the Users section
- Backend rejects weak passwords with a 400 and the dialog surfaces the message
- Backend returns 403 for non-admin callers and 404 for unknown user IDs

## Open Questions

- None

## Testing Guidelines

Backend:
- 401 when unauthenticated
- 403 when called by a non-admin user
- 404 when userId does not exist
- 400 when password fails validation (too short, too long)
- 200 happy path — password is updated and the new hash verifies correctly with bcrypt

Frontend:
- Dialog submit button disabled when fields are empty or do not match
- Error message shown when backend returns an error

## Personal Opinion

Straightforward and appropriate for the scale. The right call to defer self-service email reset — this is simpler and sufficient for 15 users. No concerns.
