# App para Pedirme

A multi-driver ride booking platform built for independent drivers who want their own direct booking system — no Uber, no middleman. Clients book via a personal link, the driver manages everything from a mobile-first PWA dashboard.

**Live:** [app-para-pedirme.vercel.app](https://app-para-pedirme.vercel.app)

---

## How it works

Each driver gets a unique booking URL (`/{slug}`). Clients open the link, fill a 4-step form, and the driver receives an instant push notification + email. The driver accepts or rejects from the dashboard, and WhatsApp messages are auto-generated for client communication.

```
Client opens /{slug}
  → 4-step booking form (locations → price → date → contact)
  → POST /api/rides
  → Push notification + email to driver
  → Driver accepts/rejects from dashboard
  → WhatsApp deep link opens with pre-filled message
```

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + RLS) |
| Maps | Google Maps JS API v2 + Distance Matrix API |
| Drag & drop | @dnd-kit |
| Email | Resend |
| Push | Web Push (VAPID) |
| Hosting | Vercel |

---

## Project structure

```
src/
├── app/
│   ├── [slug]/                  # Client-facing booking surface
│   │   ├── page.tsx             # Booking form
│   │   ├── confirmation/[id]/   # Ride summary + cancel/edit
│   │   └── editar/[id]/         # Edit ride (drag-to-reorder stops)
│   ├── dashboard/               # Driver dashboard (auth-protected)
│   ├── registro/                # Driver sign-up
│   └── api/
│       ├── auth/                # Login, register, me, reset
│       ├── rides/               # CRUD + status transitions
│       ├── price/               # Distance Matrix → price estimate
│       ├── push/                # Push subscription management
│       └── settings/            # Per-driver pricing config
├── components/
│   ├── BookingForm.tsx          # 4-step booking wizard
│   ├── RideCard.tsx             # Dashboard ride card + navigation
│   ├── LocationInput.tsx        # Google Places Autocomplete
│   └── SlideButton.tsx          # Swipe-to-confirm button
└── lib/
    ├── auth.ts                  # getDriverId() — reads driver_id cookie
    ├── pricing.ts               # calculatePrice() — rounds to nearest $10
    ├── scheduling.ts            # detectConflict() — Haversine gap check
    ├── email.ts                 # Resend templates
    └── push.ts                  # Web Push sender
```

---

## Database schema

```sql
drivers     id uuid PK, name, slug UNIQUE, email UNIQUE,
            password_hash, phone, created_at

rides       id uuid PK, driver_id → drivers,
            client_name, client_phone,
            origin, origin_lat, origin_lng,
            destination, destination_lat, destination_lng,  -- mirrors last stop (backwards compat)
            destinations jsonb,                              -- canonical: [{address, lat, lng}]
            current_stop_index int,                         -- null = not started
            scheduled_at, distance_km, duration_min,
            price_ars, status, notes,
            pending_changes jsonb,                           -- client-proposed edits on accepted rides
            created_at

settings    driver_id → drivers,
            base_fare, price_per_km, price_per_min, booking_fee,
            driver_phone, push_subscription jsonb,
            updated_at
```

RLS is enabled on all tables. `anon` role can INSERT rides. All other mutations go through the service role via server-side API routes.

---

## Key flows

### Booking

The 4-step form fetches a price estimate on step 2 via `/api/price`, which calls Google's Distance Matrix API server-side using the driver's fare settings. Supports multi-stop rides with drag-to-reorder. The "Lo antes posible" toggle skips date/time input and books for the current moment.

### Pending changes

When a client edits an **accepted** ride that hasn't started yet (`current_stop_index === null`), the payload is stored in `rides.pending_changes` instead of applied directly. The driver sees a diff banner in the dashboard showing only the fields that actually changed — date, origin, stops, or price. On accept, fields are merged and `pending_changes` is nullified. On reject, only `pending_changes` is cleared.

If the ride is already in progress (`current_stop_index !== null`), changes are applied immediately — no approval needed.

### Driver navigation

Multi-stop rides are navigated step by step using Waze deep links. `current_stop_index` tracks the driver's progress: `null` = heading to pick up client, `0` = first stop, etc. The `SlideButton` component prevents accidental taps with a swipe-to-confirm gesture.

### Conflict detection

On ride accept, `detectConflict()` estimates travel time from the last destination of any accepted ride to the origin of the new one (Haversine distance ÷ 40 km/h + 10-minute buffer). On conflict, the driver can send a WhatsApp message suggesting an alternative time.

### Notifications

Two parallel channels triggered server-side on every ride event:

- **Email** (Resend) — instant delivery, no device setup required
- **Web Push** (VAPID) — requires driver to grant permission from the dashboard. Service Worker at `public/sw.js` suppresses the notification if the app window is focused, to avoid duplicates with the foreground polling loop

The dashboard uses both 10-second polling **and** Supabase Realtime. Realtime handles instant delivery; polling is the fallback. JSONB columns (`pending_changes`, `destinations`) are re-fetched via `GET /api/rides/[id]` after a Realtime event because the payload doesn't reliably include full JSONB diffs in production.

---

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
```

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_KEY=         # Places Autocomplete (client-side)
GOOGLE_MAPS_API_KEY=                 # Distance Matrix (server-side)
RESEND_API_KEY=
NOTIFICATION_EMAIL=
NEXT_PUBLIC_APP_URL=                 # e.g. https://app-para-pedirme.vercel.app
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=                         # mailto:you@example.com
```

---

## Deployment

Vercel deploys automatically on push to `main`. Set all environment variables in the Vercel dashboard before the first deploy.

**First-time database setup:**

1. Run migrations in order in the Supabase SQL editor:
   - `supabase/migrations/001_multi_stop.sql`
   - `supabase/migrations/002_multi_driver.sql`
2. Register your driver account at `/registro`
3. If you have existing rides from a pre-multi-driver setup, backfill them:

```sql
UPDATE rides
SET driver_id = (SELECT id FROM drivers WHERE slug = 'your-slug')
WHERE driver_id IS NULL;

UPDATE settings
SET driver_id = (SELECT id FROM drivers WHERE slug = 'your-slug')
WHERE driver_id IS NULL;
```

---

## PWA

Two separate manifests handle the correct "Add to Home Screen" `start_url` on Android:

- `public/manifest.json` → `start_url: "/"` — client booking page
- `public/manifest-dashboard.json` → `start_url: "/dashboard"` — driver dashboard

> **iOS Web Push:** only works when the PWA is installed to the home screen, with notification permission granted from within the installed app — not from Safari.
