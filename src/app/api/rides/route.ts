import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendPush } from '@/lib/push'
import { emailNuevoPedido } from '@/lib/email'
import type { Ride } from '@/types'

export async function GET() {
  const { data, error } = await supabase
    .from('rides')
    .select('*')
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  try {
    const body: Omit<Ride, 'id' | 'status' | 'created_at'> = await req.json()

    const { data, error } = await supabase
      .from('rides')
      .insert({ ...body, status: 'pending' })
      .select()
      .single()

    if (error) {
      console.error('[rides POST] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Notificar al conductor vía push si tiene suscripción activa
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('push_subscription')
      .eq('id', 1)
      .single()

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

    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('[rides POST] Unexpected error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
