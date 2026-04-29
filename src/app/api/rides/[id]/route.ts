import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendPush } from '@/lib/push'
import { emailCancelacion, emailCambiosPropuestos, emailPedidoModificado } from '@/lib/email'
import type { RideStatus, PendingChanges } from '@/types'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { data, error } = await supabase.from('rides').select('*').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body: {
    status?: RideStatus
    action?: 'accept_changes' | 'reject_changes'
    scheduled_at?: string
    origin?: string
    origin_lat?: number
    origin_lng?: number
    destination?: string
    destination_lat?: number
    destination_lng?: number
    destinations?: { address: string; lat: number; lng: number }[]
    current_stop_index?: number | null
    distance_km?: number
    duration_min?: number
    price_ars?: number
    pending_changes?: PendingChanges | null
  } = await req.json()

  if (body.action === 'accept_changes') {
    const { data: ride, error: fetchErr } = await supabase
      .from('rides').select('pending_changes').eq('id', id).single()
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 404 })

    const changes = ride.pending_changes as PendingChanges | null
    if (!changes) return NextResponse.json({ error: 'No hay cambios pendientes' }, { status: 400 })

    const { data, error } = await supabase
      .from('rides')
      .update({ ...changes, pending_changes: null })
      .eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (body.action === 'reject_changes') {
    const { data, error } = await supabase
      .from('rides')
      .update({ pending_changes: null })
      .eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { action: _, ...update } = body
  const { data, error } = await supabase
    .from('rides')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const needsPush =
    body.status === 'cancelled' ||
    (body.pending_changes != null) ||
    (body.status === 'pending' && (body.origin || body.scheduled_at || body.destinations))

  if (needsPush && data.driver_id) {
    const [{ data: settingsRow }, { data: driverRow }] = await Promise.all([
      supabase.from('settings').select('push_subscription').eq('driver_id', data.driver_id).single(),
      supabase.from('drivers').select('email').eq('id', data.driver_id).single(),
    ])

    const driverEmail = driverRow?.email
    if (settingsRow?.push_subscription) {
      const sub = settingsRow.push_subscription as Parameters<typeof sendPush>[0]
      let pushResult = { expired: false }

      if (body.status === 'cancelled') {
        pushResult = await sendPush(sub, {
          title: 'Viaje cancelado ❌',
          body: `${data.client_name} canceló su viaje`,
          tag: 'cancelled',
        })
        await emailCancelacion(data, driverEmail)
      } else if (body.pending_changes != null) {
        pushResult = await sendPush(sub, {
          title: 'Cliente propuso cambios ✏️',
          body: `${data.client_name} modificó un viaje aceptado`,
          tag: 'pending-changes',
        })
        await emailCambiosPropuestos(data, driverEmail)
      } else if (body.status === 'pending') {
        pushResult = await sendPush(sub, {
          title: 'Pedido modificado 🕐',
          body: `${data.client_name} cambió su viaje`,
          tag: 'modified',
        })
        await emailPedidoModificado(data, driverEmail)
      }

      if (pushResult.expired) {
        await supabase.from('settings').update({ push_subscription: null }).eq('driver_id', data.driver_id)
      }
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await supabase.from('rides').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
