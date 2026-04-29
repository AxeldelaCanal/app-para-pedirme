import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { getDriverId } from '@/lib/auth'
import { DEFAULT_SETTINGS } from '@/lib/pricing'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')

  if (slug) {
    const { data: driver } = await supabase
      .from('drivers')
      .select('id, phone')
      .eq('slug', slug)
      .single()

    if (!driver) return NextResponse.json({ error: 'Chofer no encontrado' }, { status: 404 })

    const { data } = await supabase
      .from('settings')
      .select('*')
      .eq('driver_id', driver.id)
      .single()

    // Si no hay fila de settings, devolver defaults con el teléfono del driver
    return NextResponse.json(data ?? { ...DEFAULT_SETTINGS, driver_phone: driver.phone })
  }

  const driverId = await getDriverId()
  if (!driverId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data } = await supabase
    .from('settings')
    .select('*')
    .eq('driver_id', driverId)
    .single()

  return NextResponse.json(data ?? DEFAULT_SETTINGS)
}

export async function PUT(req: Request) {
  const driverId = await getDriverId()
  if (!driverId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const payload = { ...body, driver_id: driverId, updated_at: new Date().toISOString() }

  // Verificar si ya existe la fila
  const { data: existing } = await supabase
    .from('settings')
    .select('id')
    .eq('driver_id', driverId)
    .single()

  const { data, error } = existing
    ? await supabase.from('settings').update(payload).eq('driver_id', driverId).select().single()
    : await supabase.from('settings').insert(payload).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
