# Backend authentication integration for the frontend

The backend owns authentication tokens in HttpOnly cookies. Frontend code must
never read, store, or forward an access token or refresh token itself.

## Configuration

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

Every API request must use `withCredentials: true`. The backend must have the
exact frontend origin in `FRONTEND_ORIGIN`.

## Backend endpoints

| Method | Endpoint                | Frontend use                                           |
| ------ | ----------------------- | ------------------------------------------------------ |
| POST   | `/auth/login`           | Password login; returns the user and sets both cookies |
| GET    | `/auth/google/start`    | Begin Google login with an optional local `returnTo`   |
| GET    | `/auth/google/callback` | Google-owned callback; do not call directly            |
| GET    | `/auth/me`              | Restore the user from the access cookie                |
| POST   | `/auth/refresh`         | Rotate access and refresh cookies; returns 204         |
| POST   | `/auth/logout`          | Revoke the session family and clear both cookies       |

## Session startup

On application startup:

1. Call `GET /auth/me`.
2. If it succeeds, map the backend user and populate the session store.
3. If it returns 401, attempt one refresh.
4. If refresh succeeds, retry `/auth/me` once.
5. If either step still returns 401, clear the frontend user state.

Do not trust the user object persisted in `sessionStorage` as authentication.
The backend cookie and `/auth/me` response are authoritative.

## Single-flight refresh

Only one refresh request may run at a time. Concurrent 401 responses must wait
for the same refresh promise because refresh tokens rotate on every use. Reusing
the old token revokes the complete session family.

```ts
let refreshRequest: Promise<void> | null = null;

function refreshOnce() {
  refreshRequest ??= client
    .post("/auth/refresh")
    .then(() => undefined)
    .finally(() => {
      refreshRequest = null;
    });
  return refreshRequest;
}
```

The response interceptor must retry the original request at most once. Never
intercept a 401 from `/auth/login`, `/auth/refresh`, or `/auth/logout` for
another refresh.

## Google login

```ts
const returnTo = location.pathname + location.search;
window.location.href = `${apiBase}/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
```

Add route `/auth/google/complete`. On that page, call `GET /auth/me`, store the
mapped user, then navigate to the safe local `returnTo` or the role home page.
The backend never exposes Google access tokens or ID tokens to the frontend.

## Google error states

| Code                    | Suggested message                                                     |
| ----------------------- | --------------------------------------------------------------------- |
| `google_cancelled`      | Google sign-in was cancelled.                                         |
| `google_failed`         | Google sign-in could not be completed. Try again.                     |
| `account_link_required` | An account already uses this email. Sign in with its existing method. |

Only display these known error codes.

## User mapping

Map backend roles in the API adapter: `TOURIST` to `tourist`, `HOTEL_OWNER` to
`partner`, and `ADMIN` to `admin`. Use `displayName || username` for the visible
name and `isEmailVerified` for `verified`.

Password login sends `{ username, password }`; the current frontend client sends
`{ email, password }` and must be corrected.

## Frontend checks

- Password login stores the returned user without storing tokens.
- Reload restores the user through `/auth/me`.
- Concurrent 401 responses trigger exactly one refresh request.
- A failed refresh clears the user and returns to login.
- Google success restores the user and honors a safe `returnTo`.
- All three Google error codes display safe messages.
- Logout clears frontend state and protected routes redirect to login.
