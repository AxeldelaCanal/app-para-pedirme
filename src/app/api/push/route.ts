import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getDriverId } from '@/lib/auth'

export async function POST(req: Request) {
  const driverId = await getDriverId()
  if (!driverId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const subscription = await req.json()

  const { data: updated, error } = await supabase
    .from('settings')
    .update({ push_subscription: subscription })
    .eq('driver_id', driverId)
    .select('driver_id')

  if (error) {
    console.error('[push POST] update error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!updated?.length) {
    const { error: insertError } = await supabase
      .from('settings')
      .insert({ driver_id: driverId, push_subscription: subscription })
    if (insertError) {
      console.error('[push POST] insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
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
