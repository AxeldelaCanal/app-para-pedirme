# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run lint     # Run ESLint
npm run build    # Production build (never run after changes per user preference)
```

No test suite configured.

## Architecture

Multi-driver platform. Two surfaces sharing the same Next.js 15 App Router app:

**Client surface** (`/{slug}`) — public, no auth
- `/` → redirects to `/axel-de-la-canal` (hardcoded default driver)
- `/{slug}` → `ClientView` component manages two tabs: `BookingForm` (4-step wizard) and `DriverSection` (login/register for drivers)
- `/{slug}/confirmation/[id]` → ride summary; shows pending changes with "pendiente" badge; actions: cancel, edit
- `/{slug}/editar/[id]` → full ride editor: origin, multiple destinations (drag-to-reorder via `@dnd-kit`), date/time, price recalc

**Driver registration & auth**
- `/registro` → creates driver account + rows in `drivers` + `settings` → sends verification email → redirects to `/dashboard/verify-email`
- `/dashboard/verify-email` → static "check your email" page
- `/dashboard/verify-email/[token]` → auto-verifies on mount, sets cookie, redirects to `/dashboard`
- `/dashboard/login` → email + password → sets 30-day `driver_id` cookie
- `/dashboard/forgot-password` + `/dashboard/reset-password/[token]` → password reset via email token

**Driver dashboard** (`/dashboard`) — protected by `driver_id` cookie via `src/proxy.ts`
- `/dashboard` → ride list, filters, stats; ⚙ button opens a bottom sheet with all settings (tarifas, nav app, dark mode, QR, account, logout); polls every 10s + Supabase Realtime
- Floating QR button (bottom-right) opens a modal with shareable booking link
- Back button `←` links to driver's own `/{slug}` booking page

## Data flow

1. Client submits form → `POST /api/rides` (body includes `driver_slug`) → resolves `driver_id` from `drivers` table → inserts into `rides` → sends email + push (skipped for `driver_slug === 'demo'`)
2. `GET /api/price?waypoints=...&slug=...` → Google Maps Distance Matrix API (server-side) + `settings` table → returns `{ price_ars, distance_km, duration_min }`
3. Dashboard polls `GET /api/rides` every 10s; Supabase Realtime fires on INSERT/UPDATE for instant updates; `prevRidesRef` tracks previous state to fire browser Notifications
4. Driver actions (accept/reject/complete) → `PATCH /api/rides/[id]` → opens WhatsApp deep link with pre-filled message via `openWA()` / `buildWaUrl()`
5. Client cancel/edit → `PATCH` with `status: 'cancelled'` or `pending_changes` → sends email to driver + push notification

## Key types (`src/types/index.ts`)

```ts
type RideStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'
```

`Ride.destinations: Location[]` — canonical multi-stop list. `destination`/`destination_lat`/`destination_lng` mirror the last entry for backwards compatibility.  
`Ride.current_stop_index: number | null` — `null` = not started; number = driver is navigating that stop index.  
`Ride.pending_changes?: PendingChanges | null` — client-proposed edits on an accepted ride, awaiting driver approval.  
`Driver` — has `id`, `name`, `slug`, `email`, `password_hash`, `phone`, `email_verified`, `verification_token`, `verification_token_expires_at`.

## Pending changes flow

When a client edits an **accepted** ride that **has not started** (`current_stop_index === null`):
- `/editar/[id]` sends `{ pending_changes: changes }` — always includes `destinations` even if unchanged
- `RideCard` diffs `pending_changes` against current ride values to show only what actually changed (date, origin, stops, price)
- `PATCH /api/rides/[id]` with `action: 'accept_changes'` applies fields and nullifies the column
- `action: 'reject_changes'` nullifies `pending_changes`
- If ride **is in progress** (`current_stop_index !== null`), changes apply directly

## Auth (`src/lib/auth.ts`)

`getDriverId()` reads the `driver_id` httpOnly cookie. All protected API routes call this.  
`src/proxy.ts` — Next.js middleware that guards `/dashboard/*` (except login, forgot-password, reset-password, verify-email routes). Exports `proxy` as the middleware function and `config` with the matcher.  
`driver_id` cookie: `httpOnly`, `secure`, `sameSite: 'lax'`, `path: '/'`, 30-day `maxAge`. Must be `lax` (not `strict`) so notification clicks from a closed browser restore the session correctly.  
`/api/auth` POST/DELETE — login/logout.  
`/api/auth/register` POST — creates driver + settings row, sends verification email, does NOT auto-login.  
`/api/auth/verify-email` POST — verifies token, sets `driver_id` cookie.  
`/api/auth/me` GET/PATCH/DELETE — profile, change password or email (both require current password), delete account.  
`/api/auth/reset` POST/GET/PATCH — password reset token flow.

## Supabase

**Tables:**
- `drivers` — `id uuid`, `name`, `slug` (unique), `email` (unique), `password_hash`, `phone`, `email_verified bool`, `verification_token`, `verification_token_expires_at`
- `rides` — `driver_id uuid` → `drivers(id)`; `pending_changes jsonb`; `destinations jsonb`; `current_stop_index int`
- `settings` — `driver_id uuid` → `drivers(id)`; pricing config + `push_subscription jsonb`

**RLS:** enabled on all tables. `rides` INSERT is allowed for anon. All other writes require the service role.

**Critical:** `src/lib/supabase.ts` uses `SUPABASE_SERVICE_ROLE_KEY` (falls back to anon key). Server-side `update`/`insert` on `settings` and `drivers` silently affects 0 rows with the anon key due to RLS — always use service role for server API routes.

## Notifications

Two layers, both triggered server-side from `POST /api/rides` and `PATCH /api/rides/[id]`:

- **Email** (`src/lib/email.ts`) — Resend API. Each function accepts `driverEmail?: string`; falls back to `NOTIFICATION_EMAIL` env var if not passed. Triggers: new ride, cancellation, `pending_changes` set, ride back to pending. Email sends are independent of push subscription — never gate email behind push.
- **Web Push** (`src/lib/push.ts`) — VAPID via `web-push`. `sendPush()` returns `{ expired: boolean }`; caller must clear `push_subscription` from DB on `expired: true`. Service Worker at `public/sw.js` suppresses notification if window is focused.
- Push subscription is saved via `POST /api/push` and tested via `POST /api/push/test`.
- Dashboard auto-registers push subscription on load if `Notification.permission === 'granted'`.
- `notificationclick` in `public/sw.js` uses `self.registration.scope + 'dashboard'` (absolute URL) to avoid PWA context resolution issues.

## PWA

- `public/manifest.json` → `start_url: "/"` — root layout
- `public/manifest-dashboard.json` → `start_url: "/dashboard"` — `src/app/dashboard/layout.tsx`
- `src/app/api/manifest/[slug]/route.ts` → dynamic manifest with `start_url: "/{slug}"` per driver
- `/{slug}/page.tsx` overrides the manifest link via `generateMetadata` to point to the per-slug dynamic manifest

`InstallButton` handles `beforeinstallprompt`. `PWAFix` uses localStorage timestamp to force reload after 30s background (fixes iOS blank screen).

## LocalStorage keys

All keys are per-device (not synced to DB):
- `darkMode` — `'true'` | absent
- `nav_app` — `'waze'` | `'gmaps'` (default: waze); used by `RideCard` at navigation click time
- `nav_{rideId}` — `'arrived'` | absent; persists the nav step state per active ride

## Navigation deep links (`src/components/RideCard.tsx`)

`navUrl(lat, lng)` builds the URL per platform. `openNav(url)` opens it: non-HTTPS schemes use `window.location.href` (OS intercepts at Intent level before Chrome), HTTPS uses `window.open(_blank)`.

| Platform | Google Maps | Waze |
|---|---|---|
| Android | `geo:lat,lng?q=lat,lng` | `waze://?ll=lat,lng&navigate=yes` |
| iOS | `comgooglemaps://?daddr=lat,lng&directionsmode=driving` | `waze://?ll=lat,lng&navigate=yes` |
| Desktop | `https://maps.google.com/maps?daddr=lat,lng` | `https://waze.com/ul?ll=lat,lng&navigate=yes` |

**Critical:** `window.open(_blank)` with HTTPS App Links only works for the first navigation in a PWA session — subsequent calls open Chrome Custom Tab. Always use native URI schemes (`geo:`, `waze://`, `comgooglemaps://`) on mobile.

## WhatsApp deep links (`src/components/RideCard.tsx`)

`buildWaUrl(phone, msg)` returns `whatsapp://send?phone=...&text=...` on mobile, `https://wa.me/...` on desktop. `openWA(url)` handles opening: non-HTTPS → `window.location.href`, HTTPS → `window.open(_blank)`.

**Critical:** `window.open` after `await` loses the user gesture context on some Android devices (e.g. Moto G Power) — Chrome blocks it or opens in Custom Tab. Always use `openWA()` (not raw `window.open`) for WhatsApp links that follow async operations.

## Scheduling & conflict detection (`src/lib/scheduling.ts`)

`detectConflict(newRide, acceptedRides)` — checks if a new ride overlaps with the last accepted ride using `haversineKm` for estimated travel time between the previous drop-off and the new pick-up. Returns `{ conflict, gapMin, suggestedAt? }`. `RideCard` calls this before accepting a ride and shows a warning with a suggested time if there's a conflict.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY           # server-only; bypasses RLS for settings/drivers writes
NEXT_PUBLIC_GOOGLE_MAPS_KEY         # client-side: LocationInput (Places Autocomplete)
GOOGLE_MAPS_API_KEY                 # server-side: /api/price (Distance Matrix)
RESEND_API_KEY
RESEND_FROM                         # sender address; must be verified domain in Resend
NOTIFICATION_EMAIL                  # fallback email if driver email unavailable
NEXT_PUBLIC_APP_URL                 # e.g. https://app-para-pedirme.vercel.app
NEXT_PUBLIC_VAPID_PUBLIC_KEY        # embedded at build time; ~88 chars starting with BH
VAPID_PRIVATE_KEY
VAPID_EMAIL                         # mailto:... — contact for push server, NOT notification recipient
```

Generate VAPID keys with: `npx web-push generate-vapid-keys`

## Demo driver

Slug `demo` (`/demo`) — notifications intentionally disabled. `POST /api/rides` skips email and push when `driver_slug === 'demo'`. Rides are still persisted and visible from the demo dashboard.

## Commits

A pre-commit hook (Gentleman Guardian Angel) runs AI code review on staged files. **Never use `--no-verify`** — if the hook fails (e.g. low API credits), stop and inform the user.

## Notable patterns

- `LocationInput` uses `@googlemaps/js-api-loader` v2 — params are `key`/`v`, not `apiKey`/`version`. Component uses `defaultValue` (uncontrolled), will NOT reflect prop changes after mount.
- Dashboard uses both polling (10s interval) AND Supabase Realtime. Realtime handles instant delivery; polling is a safety net. JSONB updates (`pending_changes`, `destinations`) are re-fetched via `GET /api/rides/[id]` since Realtime doesn't reliably deliver full JSONB payload.
- Android date input: use `getFullYear/getMonth/getDate` not `toISOString().split('T')[0]` — UTC offset shifts the date.
- Web Push `applicationServerKey` needs `as unknown as ArrayBuffer` cast — TypeScript's `Uint8Array<ArrayBufferLike>` is incompatible with the DOM type.
- iOS Web Push: only works when PWA is installed to home screen AND permission granted from within the installed PWA.
- `pending_changes` always includes `destinations` in the payload even for date-only edits. `RideCard` diffs against current ride values to show only what changed.
- `formatName(name)` in `/{slug}/page.tsx` cleans slugs for display: replaces `-`/`.` with spaces and capitalizes first letter.
- Supabase `.update()` returns no error even when 0 rows are matched (RLS block). Always use service role key server-side; never assume a 200 from Supabase means a row was actually written.
