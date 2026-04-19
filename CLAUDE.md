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

Two separate surfaces sharing the same Next.js 15 App Router app:

**Client surface** (`/`) — public, no auth
- `/` → `BookingForm` (4-step wizard: locations → price auto-fetch → date/time → contact)
- `/confirmation/[id]` → ride summary; actions: cancel, link to `/editar/[id]`
- `/editar/[id]` → full ride editor: origin, multiple destinations (drag-to-reorder via `@dnd-kit`), date/time, price recalc

**Driver dashboard** (`/dashboard`) — protected by `dashboard_auth` cookie via `src/middleware.ts`
- `/dashboard/login` → sets cookie via `POST /api/auth`
- `/dashboard` → ride list, filters, stats, settings panel; polls every 5s for live updates

## Data flow

1. Client submits form → `POST /api/rides` → Supabase `rides` table → sends email via Resend + push notification via Web Push
2. `GET /api/price` → Google Maps Distance Matrix API (server-side) + `settings` table → returns `{ price_ars, distance_km, duration_min }`
3. Dashboard polls `GET /api/rides` every 10s; compares against `prevRidesRef` to fire browser Notifications on new rides, cancellations, or pending changes
4. Driver actions (accept/reject/complete) → `PATCH /api/rides/[id]` → opens WhatsApp deep link with pre-filled message
5. Client cancel/edit → `PATCH` with `status: 'cancelled'` or `pending_changes` → sends email to driver + push notification

## Key types (`src/types/index.ts`)

```ts
type RideStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'
```

`Ride.destinations: Location[]` — the canonical multi-stop list. `destination`/`destination_lat`/`destination_lng` mirror the last entry for backwards compatibility.  
`Ride.current_stop_index: number | null` — `null` means ride hasn't started; a number means driver is in progress.  
`Ride.pending_changes?: PendingChanges | null` — client-proposed edits on an accepted ride, awaiting driver approval.

## Pending changes flow

When a client edits an **accepted** ride that **has not started** (`current_stop_index === null`):
- `/editar/[id]` sends `{ pending_changes: changes }` instead of applying directly
- Driver sees a diff banner in `RideCard` and can accept or reject
- `PATCH /api/rides/[id]` with `action: 'accept_changes'` applies `pending_changes` fields and nullifies the column
- `action: 'reject_changes'` just nullifies `pending_changes`
- If the ride **is in progress**, changes apply directly (no approval needed — driver is already with the client)

## Pricing (`src/lib/pricing.ts`)

`calculatePrice(distanceKm, durationMin, settings)` — rounds to nearest $10.  
`DEFAULT_SETTINGS` used as fallback if the `settings` DB row doesn't exist.

## Scheduling conflict detection (`src/lib/scheduling.ts`)

`detectConflict(newRide, acceptedRides)` uses Haversine distance between the last destination of the prior ride and the origin of the new ride, assuming 40 km/h average speed, with a 10-minute buffer. Returns `{ conflict, gapMin, suggestedAt? }`.

## Auth

`src/middleware.ts` guards all `/dashboard/*` routes (except `/dashboard/login`) by checking the `dashboard_auth` cookie.  
`/api/settings` GET is public (confirmation page needs `driver_phone`). PUT requires the cookie.

## Notifications

Two layers, both triggered server-side from `POST /api/rides` and `PATCH /api/rides/[id]`:

- **Email** (`src/lib/email.ts`) — Resend API. Sends on: new ride, cancellation, pending_changes set, ride back to pending.
- **Web Push** (`src/lib/push.ts`) — VAPID via `web-push`. Subscription stored in `settings.push_subscription` JSONB. Service Worker at `public/sw.js` only shows notification if no focused window (avoids duplicates with foreground polling).

Push subscription is created in the dashboard after the user grants notification permission (`/api/push` POST/DELETE).

## PWA manifests

Two separate manifests to allow correct "Add to Home Screen" on Android:
- `public/manifest.json` → `start_url: "/"` — injected in root layout
- `public/manifest-dashboard.json` → `start_url: "/dashboard"` — injected in `src/app/dashboard/layout.tsx`

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_GOOGLE_MAPS_KEY        # client-side: LocationInput (Places Autocomplete)
GOOGLE_MAPS_API_KEY                 # server-side: /api/price (Distance Matrix)
DASHBOARD_PASSWORD
RESEND_API_KEY                      # email notifications
NOTIFICATION_EMAIL                  # driver's email address
NEXT_PUBLIC_APP_URL                 # e.g. https://app-para-pedirme.vercel.app
NEXT_PUBLIC_VAPID_PUBLIC_KEY        # Web Push
VAPID_PRIVATE_KEY
VAPID_EMAIL                         # mailto:...
```

## Supabase tables

- `rides` — all ride requests; RLS policies cover SELECT/INSERT/UPDATE/DELETE
- `settings` — single row (`id = 1`) with pricing config, driver phone, and `push_subscription jsonb`

`rides.pending_changes` is a JSONB column. RLS must allow UPDATE on it for the client-side approval flow to work.

## Notable patterns

- `LocationInput` uses `@googlemaps/js-api-loader` v2 — loader params are `key`/`v`, not `apiKey`/`version`. The component uses `defaultValue` (uncontrolled input), so it will NOT reflect prop changes after mount.
- Dashboard sorting order: pending → accepted → completed → cancelled → rejected. All filtering is client-side after a single fetch on mount.
- Supabase Realtime was replaced with polling (`useRef` + `prevRidesRef`) because Realtime doesn't reliably deliver JSONB column updates in production.
- PWA: `public/manifest.json`, `InstallButton` (beforeinstallprompt), `PWAFix` (localStorage timestamp → reload after 30s background to fix iOS blank screen).
- Android date input fix: use local date string (`getFullYear/getMonth/getDate`) instead of `toISOString().split('T')[0]` to avoid UTC offset shifting the date.
- Web Push `applicationServerKey` requires `as unknown as ArrayBuffer` cast — TypeScript's `Uint8Array<ArrayBufferLike>` is incompatible with the DOM type without it.
- iOS Web Push only works when the PWA is installed to home screen AND permission was granted from within the installed PWA (not from Safari).
