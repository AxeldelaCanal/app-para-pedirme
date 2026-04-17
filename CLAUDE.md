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

Two separate surfaces sharing the same Next.js app:

**Client surface** (`/`) — public, no auth
- `/` → `BookingForm` (4-step wizard: locations → date/time → contact → confirm)
- `/confirmation/[id]` → shows ride summary, cancel/edit links
- `/editar/[id]` → lets client modify origin, destination, date, time; if locations change, must recalculate price before saving

**Driver dashboard** (`/dashboard`) — protected by `dashboard_auth` cookie
- `/dashboard/login` → sets the cookie via `POST /api/auth`
- `/dashboard` → ride list with status filters, period filters, search, stats, settings panel

## Data flow

1. Client submits form → `POST /api/rides` → Supabase `rides` table
2. `GET /api/price` hits Google Maps Distance Matrix API server-side, loads tarifas from `settings` table, calculates price
3. Dashboard subscribes to Supabase Realtime on `rides` (INSERT + UPDATE) for live notifications
4. Driver actions (accept/reject/complete) → `PATCH /api/rides/[id]` → opens WhatsApp link with pre-filled message
5. Client cancel → same PATCH with `status: 'cancelled'` → opens WhatsApp to driver phone from `settings.driver_phone`

## Key types (`src/types/index.ts`)

```ts
type RideStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'
```

`Ride` includes full origin/destination addresses + lat/lng, pricing, `notes?`, and `status`.  
`Settings` holds pricing config (`base_fare`, `price_per_km`, `price_per_min`, `booking_fee`) + `driver_phone`.

## Pricing (`src/lib/pricing.ts`)

`calculatePrice(distanceKm, durationMin, settings)` — rounds to nearest $10.  
`DEFAULT_SETTINGS` used as fallback if DB settings row doesn't exist.

## Auth

Cookie-based, single password. `DASHBOARD_PASSWORD` env var. No user accounts.  
`/api/settings` GET is public (needed by confirmation page to get `driver_phone`). PUT requires the cookie.

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_GOOGLE_MAPS_KEY   # used client-side by LocationInput (Autocomplete)
GOOGLE_MAPS_API_KEY            # used server-side by /api/price (Distance Matrix)
DASHBOARD_PASSWORD
```

## Supabase tables

- `rides` — all ride requests
- `settings` — single row (`id = 1`) with pricing config and driver phone

Status constraint: `CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled'))`

## Notable patterns

- `LocationInput` uses `@googlemaps/js-api-loader` v2 — params are `key`/`v`, not `apiKey`/`version`. Uses `defaultValue` (not controlled), so it won't re-render on prop changes.
- All sorting and filtering happens client-side in the dashboard after a single `GET /api/rides` fetch on mount.
- Status order for dashboard sorting: pending → accepted → completed → cancelled → rejected.
