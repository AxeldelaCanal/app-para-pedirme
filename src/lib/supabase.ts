import { createClient } from '@supabase/supabase-js'
import type { Ride, Settings } from '@/types'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, anonKey)

export type Database = {
  rides: Ride
  settings: Settings
}
