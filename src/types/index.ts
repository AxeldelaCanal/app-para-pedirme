export type RideStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled'

export interface Driver {
  id: string
  name: string
  slug: string
  email: string
  phone?: string
  created_at: string
}

export interface Ride {
  id: string
  client_name: string
  client_phone: string
  origin: string
  origin_lat: number
  origin_lng: number
  destination: string
  destination_lat: number
  destination_lng: number
  destinations: Location[]
  current_stop_index: number | null
  scheduled_at: string
  distance_km: number
  duration_min: number
  price_ars: number
  status: RideStatus
  notes?: string
  created_at: string
  pending_changes?: PendingChanges | null
}

export interface PendingChanges {
  scheduled_at?: string
  origin?: string
  origin_lat?: number
  origin_lng?: number
  destination?: string
  destination_lat?: number
  destination_lng?: number
  destinations?: Location[]
  price_ars?: number
  distance_km?: number
  duration_min?: number
}

export interface Settings {
  id: number
  base_fare: number
  price_per_km: number
  price_per_min: number
  booking_fee: number
  driver_phone?: string
  push_subscription?: PushSubscriptionJSON | null
  updated_at: string
}

export interface PriceEstimate {
  distance_km: number
  duration_min: number
  price_ars: number
}

export interface Location {
  address: string
  lat: number
  lng: number
}
