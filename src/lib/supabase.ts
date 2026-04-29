import { createClient } from '@supabase/supabase-js'
import type { Ride, Settings } from '@/types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Cliente público — usa anon key, respeta RLS. Solo para uso client-side.
export const supabase = createClient(url, anonKey)

// Cliente admin — usa service role key, bypasea RLS. Solo usar en API routes (server-side).
export const supabaseAdmin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? anonKey)

export type Database = {
  rides: Ride
  settings: Settings
}
