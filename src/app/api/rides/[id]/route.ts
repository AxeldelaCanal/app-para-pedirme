import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { RideStatus } from '@/types'

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
  } = await req.json()

  const { data, error } = await supabase
    .from('rides')
    .update(body)
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
