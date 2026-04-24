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
- `/{slug}` → `BookingForm` (4-step wizard: locations → price auto-fetch → date/time → contact)
- `/{slug}/confirmation/[id]` → ride summary; shows pending changes with "pendiente" badge; actions: cancel, edit
- `/{slug}/editar/[id]` → full ride editor: origin, multiple destinations (drag-to-reorder via `@dnd-kit`), date/time, price recalc

**Driver registration & auth**
- `/registro` → creates driver account + row in `drivers` table + row in `settings`
- `/dashboard/login` → email + password → sets `driver_id` cookie (30-day)
- `/dashboard/forgot-password` + `/dashboard/reset-password/[token]` → password reset flow via email token

**Driver dashboard** (`/dashboard`) — protected by `driver_id` cookie via `src/middleware.ts`
- `/dashboard` → ride list, filters, stats, settings panel; polls every 10s + Supabase Realtime

## Data flow

1. Client submits form → `POST /api/rides` (body includes `driver_slug`) → resolves `driver_id` from `drivers` table → inserts into `rides` → sends email via Resend + push notification via Web Push
2. `GET /api/price?waypoints=...&slug=...` → Google Maps Distance Matrix API (server-side) + `settings` table → returns `{ price_ars, distance_km, duration_min }`
3. Dashboard polls `GET /api/rides` every 10s; Supabase Realtime channel fires on INSERT/UPDATE for instant updates; `prevRidesRef` tracks previous state to fire browser Notifications
4. Driver actions (accept/reject/complete) → `PATCH /api/rides/[id]` → opens WhatsApp deep link with pre-filled message
5. Client cancel/edit → `PATCH` with `status: 'cancelled'` or `pending_changes` → sends email to driver + push notification

## Key types (`src/types/index.ts`)

```ts
type RideStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'
```

`Ride.destinations: Location[]` — canonical multi-stop list. `destination`/`destination_lat`/`destination_lng` mirror the last entry for backwards compatibility.  
`Ride.current_stop_index: number | null` — `null` = not started; number = driver is navigating that stop index.  
`Ride.pending_changes?: PendingChanges | null` — client-proposed edits on an accepted ride, awaiting driver approval.  
`Driver` — has `id`, `name`, `slug`, `email`, `password_hash`, `phone`.

## Pending changes flow

When a client edits an **accepted** ride that **has not started** (`current_stop_index === null`):
- `/editar/[id]` sends `{ pending_changes: changes }` — always includes `destinations` even if unchanged
- `RideCard` diffs `pending_changes` against current ride values to show only what actually changed (date, origin, stops, price)
- `PATCH /api/rides/[id]` with `action: 'accept_changes'` applies fields and nullifies the column
- `action: 'reject_changes'` nullifies `pending_changes`
- If ride **is in progress** (`current_stop_index !== null`), changes apply directly

## Auth (`src/lib/auth.ts`)

`getDriverId()` reads the `driver_id` httpOnly cookie. All protected API routes call this.  
`src/middleware.ts` guards `/dashboard/*` (except `/dashboard/login`, `/dashboard/forgot-password`, `/dashboard/reset-password`).  
`/api/auth` POST/DELETE — login/logout.  
`/api/auth/register` POST — creates driver + settings row.  
`/api/auth/me` GET/PATCH/DELETE — profile, change password, delete account.  
`/api/auth/reset` POST/GET/PATCH — password reset token flow.

## Supabase tables

- `drivers` — one row per driver: `id uuid`, `name`, `slug` (unique), `email` (unique), `password_hash`, `phone`
- `rides` — all ride requests; `driver_id uuid` references `drivers(id)`; `pending_changes jsonb`; `destinations jsonb`; `current_stop_index int`
- `settings` — one row per driver: `driver_id uuid` references `drivers(id)`; pricing config + `push_subscription jsonb`

RLS is enabled on all tables. Service role bypasses RLS. `rides` INSERT is allowed for anon.

## Pricing (`src/lib/pricing.ts`)

`calculatePrice(distanceKm, durationMin, settings)` — rounds to nearest $10.  
`DEFAULT_SETTINGS` — calibrated with real Uber MDP trips (base=700, per_km=710, per_min=30, fee=300).

## Scheduling conflict detection (`src/lib/scheduling.ts`)

`detectConflict(newRide, acceptedRides)` — Haversine distance from last destination of prior ride to origin of new ride, assuming 40 km/h, 10-minute buffer. Returns `{ conflict, gapMin, suggestedAt? }`.

## Notifications

Two layers, both triggered server-side from `POST /api/rides` and `PATCH /api/rides/[id]`:

- **Email** (`src/lib/email.ts`) — Resend API. Triggers: new ride, cancellation, pending_changes set, ride back to pending.
- **Web Push** (`src/lib/push.ts`) — VAPID via `web-push`. Subscription stored in `settings.push_subscription`. Service Worker at `public/sw.js` suppresses notification if window is focused (avoids duplicates with foreground polling).

## PWA

Two manifests to fix "Add to Home Screen" start URL on Android:
- `public/manifest.json` → `start_url: "/"` — root layout
- `public/manifest-dashboard.json` → `start_url: "/dashboard"` — `src/app/dashboard/layout.tsx`

`InstallButton` handles `beforeinstallprompt`. `PWAFix` uses localStorage timestamp to force reload after 30s background (fixes iOS blank screen).

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_GOOGLE_MAPS_KEY        # client-side: LocationInput (Places Autocomplete)
GOOGLE_MAPS_API_KEY                 # server-side: /api/price (Distance Matrix)
RESEND_API_KEY
NOTIFICATION_EMAIL                  # driver's email for Resend
NEXT_PUBLIC_APP_URL                 # e.g. https://app-para-pedirme.vercel.app
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_EMAIL                         # mailto:...
```

## Notable patterns

- `LocationInput` uses `@googlemaps/js-api-loader` v2 — params are `key`/`v`, not `apiKey`/`version`. Component uses `defaultValue` (uncontrolled), will NOT reflect prop changes after mount.
- Dashboard uses both polling (10s interval) AND Supabase Realtime. Realtime handles instant delivery; polling is a safety net. JSONB updates (pending_changes, destinations) are re-fetched via `GET /api/rides/[id]` since Realtime doesn't reliably deliver full JSONB payload.
- Android date input: use `getFullYear/getMonth/getDate` not `toISOString().split('T')[0]` — UTC offset shifts the date.
- Web Push `applicationServerKey` needs `as unknown as ArrayBuffer` cast — TypeScript's `Uint8Array<ArrayBufferLike>` is incompatible with the DOM type.
- iOS Web Push: only works when PWA is installed to home screen AND permission granted from within the installed PWA.
- `pending_changes` always includes `destinations` in the payload even for date-only edits. `RideCard` diffs against current ride values to show only what changed.
- `formatName(name)` in `/{slug}/page.tsx` cleans slugs for display: replaces `-`/`.` with spaces and capitalizes first letter.
