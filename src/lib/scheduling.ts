import type { Location, Ride } from '@/types'

export function haversineKm(a: Location, b: Location): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(h))
}

// Estimación sin API: 40 km/h promedio urbano
export function estimatedTravelMin(a: Location, b: Location): number {
  return (haversineKm(a, b) / 40) * 60
}

export function detectConflict(
  newRide: Ride,
  acceptedRides: Ride[]
): { conflict: boolean; gapMin: number; suggestedAt?: Date } {
  const newStart = new Date(newRide.scheduled_at).getTime()

  // Viajes aceptados que terminan antes del inicio del nuevo
  const before = acceptedRides
    .filter(r => new Date(r.scheduled_at).getTime() < newStart)
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())

  if (before.length === 0) return { conflict: false, gapMin: Infinity }

  const last = before[0]
  const lastEndMs = new Date(last.scheduled_at).getTime() + last.duration_min * 60_000

  const dests = last.destinations?.length ? last.destinations : [
    { address: last.destination, lat: last.destination_lat, lng: last.destination_lng },
  ]
  const lastDest = dests[dests.length - 1]
  const newOrigin: Location = { address: newRide.origin, lat: newRide.origin_lat, lng: newRide.origin_lng }

  const travelMin = estimatedTravelMin(lastDest, newOrigin)
  const gapMin = (newStart - lastEndMs) / 60_000 - travelMin

  if (gapMin >= 0) return { conflict: false, gapMin }

  // Buffer de 10 min sobre el tiempo de viaje entre destinos
  const suggestedAt = new Date(lastEndMs + (travelMin + 10) * 60_000)
  return { conflict: true, gapMin, suggestedAt }
}
