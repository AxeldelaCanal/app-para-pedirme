import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getDriverId } from '@/lib/auth'
import { sendPush } from '@/lib/push'
import { emailNuevoPedido } from '@/lib/email'
import type { Ride } from '@/types'

export async function GET() {
  const driverId = await getDriverId()
  if (!driverId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('rides')
    .select('*')
    .eq('driver_id', driverId)
    .order('scheduled_at', { ascending: true })

  if (error) {
    console.error('[rides GET]', error)
    return NextResponse.json([], { status: 200 })
  }
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  try {
    const body: Omit<Ride, 'id' | 'status' | 'created_at'> & { driver_slug: string } = await req.json()
    const { driver_slug, ...rideData } = body

    // Resolver driver_id a partir del slug
    const { data: driver, error: driverErr } = await supabase
      .from('drivers')
      .select('id')
      .eq('slug', driver_slug)
      .single()

    if (driverErr || !driver) {
      return NextResponse.json({ error: 'Chofer no encontrado' }, { status: 404 })
    }

    const { data, error } = await supabase
      .from('rides')
      .insert({ ...rideData, driver_id: driver.id, status: 'pending' })
      .select()
      .single()

    if (error) {
      console.error('[rides POST] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: settingsRow } = await supabase
      .from('settings')
      .select('push_subscription')
      .eq('driver_id', driver.id)
      .single()

    if (driver_slug !== 'demo') {
      if (settingsRow?.push_subscription) {
        const dests = data.destinations?.length ? data.destinations : [{ address: data.destination }]
        const lastDest = dests[dests.length - 1].address
        await sendPush(settingsRow.push_subscription as Parameters<typeof sendPush>[0], {
          title: 'Nuevo pedido 🚗',
          body: `${data.client_name} · ${data.origin.split(',')[0]} → ${lastDest.split(',')[0]}`,
          tag: 'new-ride',
        })
      }

      await emailNuevoPedido(data)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('[rides POST] Unexpected error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
