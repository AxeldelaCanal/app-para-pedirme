import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getDriverId } from '@/lib/auth'

export async function POST(req: Request) {
  const driverId = await getDriverId()
  if (!driverId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const subscription = await req.json()

  const { error } = await supabase
    .from('settings')
    .upsert({ driver_id: driverId, push_subscription: subscription }, { onConflict: 'driver_id' })

  if (error) {
    console.error('[push POST] upsert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
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
