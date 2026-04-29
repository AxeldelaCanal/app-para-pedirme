import { createClient } from '@supabase/supabase-js'
import type { Ride, Settings } from '@/types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY ?? anonKey)

export type Database = {
  rides: Ride
  settings: Settings
}
