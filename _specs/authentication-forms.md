# Spec for Authentication Forms

branch: claude/feature/authentication-forms

## Summary

Create login and registration forms accessible at `/login` and `/registration` routes. Both forms will include email and password fields with password visibility toggle, validation, and submit functionality. The forms will integrate with existing backend authentication endpoints (`/api/auth/login` and `/api/auth/register`) and provide easy navigation between login and registration views.

## Functional Requirements

- **Login Form** (`/login` route)
  - Email input field (type=email)
  - Password input field with show/hide password icon toggle
  - "Login" submit button
  - Link to navigate to registration page
  - Form submission calls backend `/api/auth/login` endpoint
  - On successful login, store JWT token and redirect user to appropriate page
  - Display error messages for failed login attempts

- **Registration Form** (`/registration` route)
  - Email input field (type=email)
  - Password input field with show/hide password icon toggle
  - Verify password input field with show/hide password icon toggle
  - "Sign Up" submit button
  - Link to navigate to login page
  - Form submission calls backend `/api/auth/register` endpoint
  - Password and verify password fields must match before submission
  - On successful registration, store JWT token and redirect user to appropriate page
  - Display error messages for failed registration attempts

- **Password Visibility Toggle**
  - Icon button on password fields to toggle between hidden (dots/asterisks) and visible (plain text)
  - Use Material-UI IconButton with visibility icons (Visibility/VisibilityOff)
  - Toggle state is independent for each password field

- **Navigation Between Forms**
  - Login form has a link/button: "Don't have an account? Sign up"
  - Registration form has a link/button: "Already have an account? Log in"
  - Clicking these links navigates to the corresponding route

- **Form Validation**
  - Email validation (valid email format)
  - Password requirements enforcement (leverage existing backend validation)
  - Real-time or on-blur validation feedback
  - Disable submit button while form is invalid or submitting

- **API Integration**
  - Use existing backend endpoints: `POST /api/auth/login` and `POST /api/auth/register`
  - Handle loading states during API calls
  - Display API error responses to the user
  - Store JWT token in localStorage on successful authentication
  - Set up Authorization header for subsequent API requests

## Possible Edge Cases

- User navigates directly to `/login` or `/registration` while already authenticated (should redirect to home/dashboard)
- Backend returns validation errors (e.g., email already exists, password too weak)
- Network failures or timeout during form submission
- User rapidly toggles password visibility
- User attempts to register with an email that already exists
- Browser password managers auto-filling credentials
- User clicks submit multiple times in quick succession
- JWT token expiration handling (may be out of scope for this spec)

## Acceptance Criteria

- Login form is accessible at `/login` route and renders all required fields
- Registration form is accessible at `/registration` route and renders all required fields (including verify password)
- Password visibility can be toggled on all password fields independently
- Registration form validates that password and verify password match
- Both forms validate email format before submission
- Forms successfully call backend endpoints and handle responses
- Successful authentication stores JWT token and redirects user
- Error messages are clearly displayed for validation and API errors
- Navigation links between login and registration work correctly
- Forms have appropriate loading states during submission
- Submit buttons are disabled during submission to prevent duplicate requests
- Forms are responsive and accessible (keyboard navigation, screen readers)

## Open Questions

- Should we add a "Remember me" checkbox on login form? yes
- Should we include a "Forgot password?" link (out of scope if password reset not implemented)? no
- What page should users be redirected to after successful login/registration? the home page '/'
- Should we add client-side password strength indicator on registration? no
- Should we persist form values if user navigates away and returns? no
- Do we need additional fields for registration (e.g., username, display name)? display name would be good

## Testing Guidelines

Create test file(s) in the ./tests folder for the new feature, and create meaningful tests for the following cases, without going too heavy:

- Login form renders with all required fields and elements
- Registration form renders with all required fields (including verify password)
- Password visibility toggle changes input type between password and text
- Registration form shows error when passwords don't match
- Forms show validation errors for invalid email format
- Submit button is disabled when form is invalid
- Forms call correct API endpoints with correct payload on submission
- Successful login/registration stores token and redirects
- API errors are displayed to the user
- Navigation links between login and registration work correctly
- Multiple rapid submit clicks are prevented (submit button disabled during request)
