import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { getDriverId } from '@/lib/auth'

export async function POST(req: Request) {
  const driverId = await getDriverId()
  if (!driverId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const subscription = await req.json()

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  console.log(`[push POST] driverId=${driverId} hasServiceKey=${!!serviceKey} keyPrefix=${serviceKey?.slice(0, 10)}`)

  const { data, error } = await supabase
    .from('settings')
    .update({ push_subscription: subscription })
    .eq('driver_id', driverId)
    .select('driver_id')

  console.log(`[push POST] update result: rowsAffected=${data?.length ?? 0} error=${error?.message ?? 'none'}`)

  if (error) {
    console.error('[push POST] update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, rowsAffected: data?.length ?? 0 })
}

export async function DELETE() {
  const driverId = await getDriverId()
  if (!driverId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { error } = await supabase
    .from('settings')
    .update({ push_subscription: null })
    .eq('driver_id', driverId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
