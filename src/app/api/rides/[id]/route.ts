import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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

  // Aceptar cambios propuestos: aplicar pending_changes al ride y limpiar
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

  // Rechazar cambios: solo limpiar pending_changes
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
