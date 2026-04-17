import type { Settings } from '@/types'

// Defaults based on Uber MDP rates (configurable from dashboard)
// UberX MDP + 10% (servicio directo)
// 3.9km/11min → $4520 | 29.6km/37min → $21160
export const DEFAULT_SETTINGS: Omit<Settings, 'id' | 'updated_at'> = {
  base_fare: 770,
  price_per_km: 519,
  price_per_min: 127,
  booking_fee: 330,
  driver_phone: '2235304242',
}

export function calculatePrice(
  distanceKm: number,
  durationMin: number,
  settings: Omit<Settings, 'id' | 'updated_at'>
): number {
  const raw =
    settings.base_fare +
    distanceKm * settings.price_per_km +
    durationMin * settings.price_per_min +
    settings.booking_fee

  // Round to nearest $10
  return Math.round(raw / 10) * 10
}
