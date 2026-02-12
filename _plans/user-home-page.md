# User Home Page Implementation Plan

## Context

Currently, the application lacks a personalized authenticated user experience. After login, users are redirected to the public home page (`/`) with no indication they're logged in. The navbar doesn't change based on auth state, and there's no logout functionality. Additionally, auth state is managed inconsistently through direct localStorage access scattered across API request files.

This feature creates:
- A dedicated user home page (`/dashboard`) that welcomes users by display name
- Centralized auth state management via AuthContext (following the existing ThemeContext pattern)
- Dynamic navbar with conditional logout button
- Route protection to prevent unauthenticated access to user pages
- Proper logout flow that clears auth and redirects to public home

## Implementation Approach

### Architecture Decisions

1. **AuthContext for State Management**: Create an AuthContext/AuthProvider following the same pattern as ThemeContext. This provides a single source of truth for auth state, enables reactive UI updates, and centralizes user profile data.

  **Note from the human:** can you place related context/provider files in separate subdirectories in the contexts directory if you think it would be helpful and more readable.

2. **Route Protection**: Create a `PrivateRoute` wrapper component for declarative route guards. Reusable for future protected routes (picks, leaderboard, etc.).

3. **User Home Route**: Use `/dashboard` to distinguish from public home (`/`) and provide semantic meaning.

4. **Extracted Navbar Component**: Move navbar from App.tsx into separate component for cleaner auth integration and better component organization.

5. **Profile Data Caching**: Fetch user profile (including displayName) once on login/app mount and cache in AuthContext to avoid redundant API calls.

### Data Flow

**Login Flow**:
1. User submits login form → `loginUser()` API returns JWT token
2. LoginForm calls `authContext.login(token)`
3. AuthProvider stores token in localStorage, fetches user profile via `getUserProfile()`
4. AuthProvider sets user state with displayName, email, roles
5. LoginForm redirects to `/dashboard`

**Logout Flow**:
1. User clicks logout in Navbar → calls `authContext.logout()`
2. AuthProvider clears localStorage, sets user = null
3. User automatically redirected to `/` by route protection

**App Initialization**:
1. AuthProvider checks localStorage for existing JWT
2. If token exists, validates by calling `getUserProfile()`
3. If successful, sets user state; if fails (expired/invalid), clears token

## Critical Files

### New Files to Create

1. **`packages/frontend/src/contexts/AuthContext.tsx`**
   - Types: `AuthContextType`, `AuthUser`
   - Context creation and `useAuth()` custom hook

2. **`packages/frontend/src/contexts/AuthProvider.tsx`**
   - Provider component with state (user, isLoading)
   - Methods: `login(token)`, `logout()`
   - Initialization logic: check localStorage on mount

3. **`packages/frontend/src/components/PrivateRoute.tsx`**
   - Route guard wrapper component
   - Redirects to `/login` if not authenticated
   - Shows loading spinner during auth check

4. **`packages/frontend/src/components/Navbar.tsx`**
   - Extracted from App.tsx
   - Includes football icon, app title, ThemeToggle
   - Conditional logout button (visible only when `user` exists)

5. **`packages/frontend/src/pages/Dashboard.tsx`**
   - User home page with personalized welcome
   - Uses `useAuth()` to get `user.displayName`
   - Placeholder sections: Your Picks, Leaderboard, This Week's Games

### Files to Modify

1. **`packages/frontend/src/App.tsx`**
   - Wrap BrowserRouter content with `<AuthProvider>`
   - Remove inline AppBar/Toolbar (extract to Navbar component)
   - Add `<Navbar />` above Routes
   - Add protected route: `<Route path="dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />`

2. **`packages/frontend/src/pages/Login.tsx`**
   - Import `useAuth()` hook
   - Replace direct `loginUser()` + navigation with `login()` from context
   - Change redirect from `/` to `/dashboard` (line 54)

3. **`packages/frontend/src/pages/Registration.tsx`**
   - Import `useAuth()` hook
   - Call `login(token)` after successful registration
   - Update redirect to `/dashboard`

4. **`packages/frontend/src/apis/authRequests.ts`**
   - Remove `localStorage.setItem('jwt', ...)` from `loginUser()` and `registerUser()`
   - Let AuthProvider handle token storage
   - Keep existing return structure (token in response data)

## Implementation Steps

### Step 1: Create Auth Infrastructure

**1.1 Create AuthContext** (`packages/frontend/src/contexts/AuthContext.tsx`)
```typescript
export interface AuthUser {
  userId: number;
  email: string;
  displayName: string;
  roles: Role[];
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**1.2 Create AuthProvider** (`packages/frontend/src/contexts/AuthProvider.tsx`)
- State: `user` (AuthUser | null), `isLoading` (boolean)
- `login(token)`: Store token in localStorage, call `getUserProfile()`, set user state
- `logout()`: Remove token from localStorage, set user = null
- `useEffect` on mount: Check for existing token in localStorage, validate with `getUserProfile()`
- Handle errors: If profile fetch fails, clear token and set user = null

**1.3 Update authRequests.ts** (`packages/frontend/src/apis/authRequests.ts`)
- Remove `localStorage.setItem()` calls from `loginUser()` (lines 17-18)
- Remove `localStorage.setItem()` calls from `registerUser()` (lines 38-39)
- Token storage now handled by AuthProvider

### Step 2: Create Route Protection

**2.1 Create PrivateRoute** (`packages/frontend/src/components/PrivateRoute.tsx`)
```typescript
export default function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
      <CircularProgress />
    </Box>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

**2.2 Update App.tsx** (`packages/frontend/src/App.tsx`)
- Import AuthProvider, wrap BrowserRouter content
- Add route for dashboard with PrivateRoute guard
- Keep navbar inline for now (extract in next step)

### Step 3: Create User Home Page

**3.1 Create Dashboard Page** (`packages/frontend/src/pages/Dashboard.tsx`)
- Container > Paper layout (similar to Home.tsx pattern)
- Welcome message: `Welcome, {user?.displayName}!`
- Grid with placeholder Paper sections:
  - "Your Picks" (coming soon)
  - "Leaderboard" (coming soon)
  - "This Week's Games" (coming soon)

**3.2 Update Login and Registration**
- Login.tsx: Use `const { login } = useAuth()`, call `await login(result.data.token)`, navigate to `/dashboard`
- Registration.tsx: Same pattern as Login

### Step 4: Add Navbar with Logout

**4.1 Create Navbar Component** (`packages/frontend/src/components/Navbar.tsx`)
- Extract AppBar/Toolbar code from App.tsx (lines 16-24)
- Import `useAuth()` hook
- Add logout button with conditional rendering:
```typescript
{user && (
  <Button color="inherit" onClick={logout} sx={{ ml: 2 }}>
    Logout
  </Button>
)}
```

**4.2 Final App.tsx Update**
- Remove inline AppBar code (lines 16-24)
- Import and render `<Navbar />` above Routes

## References to Existing Patterns

**Auth State Pattern**: Follow `ThemeProvider.tsx` structure:
- State initialized from localStorage on mount
- Custom hook with error checking (`useAuth` similar to `useTheme`)
- Context wraps app in App.tsx

**API Request Pattern**:
- `getUserProfile()` exists in `packages/frontend/src/apis/userRequests.ts` (line 9)
- Returns `ProfileData` with userId, email, displayName, roles

**Material-UI Layout**: Follow `pages/Home.tsx` patterns:
- Container maxWidth="lg"
- Paper elevation with padding
- Box grid layout for sections
- Typography variants (h4, h6, body1)

## Verification Steps

### Manual Testing Checklist

1. **Unauthenticated Access**
   - Visit `/` → should see public home page
   - Try visiting `/dashboard` → should redirect to `/login`
   - Navbar should show: icon, title, theme toggle (NO logout button)

2. **Login Flow**
   - Login with valid credentials → should redirect to `/dashboard`
   - Dashboard should display: "Welcome, [displayName]!"
   - Navbar should now show logout button
   - Refresh page → should remain on `/dashboard` (auth persists)

3. **Logout Flow**
   - Click logout button → should redirect to `/`
   - Navbar should hide logout button
   - Try visiting `/dashboard` → should redirect to `/login`

4. **Registration Flow**
   - Register new account → should redirect to `/dashboard`
   - Should see welcome message with new displayName

5. **Edge Cases**
   - Clear localStorage manually → refresh → should show login
   - Invalid token in localStorage → should auto-logout on app load
   - Network error during profile fetch → should handle gracefully

### Code Verification

1. Check AuthContext exports are properly typed
2. Verify AuthProvider wraps app before BrowserRouter
3. Confirm PrivateRoute is used for `/dashboard` route
4. Validate logout clears localStorage and resets state
5. Check that displayName is fetched and displayed correctly

### Files to Review After Implementation

- `packages/frontend/src/App.tsx` - AuthProvider wrapping, route structure
- `packages/frontend/src/components/Navbar.tsx` - Conditional logout button
- `packages/frontend/src/contexts/AuthProvider.tsx` - Auth logic correctness
- `packages/frontend/src/pages/Dashboard.tsx` - Display name rendering
- `packages/frontend/src/pages/Login.tsx` - Updated redirect and auth flow
