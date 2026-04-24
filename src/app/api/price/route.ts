import { NextResponse } from 'next/server'
import { calculatePrice, DEFAULT_SETTINGS } from '@/lib/pricing'
import { supabase } from '@/lib/supabase'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const waypointsParam = searchParams.get('waypoints')
  const slug = searchParams.get('slug')

  let points: Array<{ lat: number; lng: number }>

  if (waypointsParam) {
    try {
      points = JSON.parse(waypointsParam)
    } catch {
      return NextResponse.json({ error: 'waypoints inválidos' }, { status: 400 })
    }
  } else {
    const originLat = parseFloat(searchParams.get('originLat') ?? '')
    const originLng = parseFloat(searchParams.get('originLng') ?? '')
    const destLat = parseFloat(searchParams.get('destLat') ?? '')
    const destLng = parseFloat(searchParams.get('destLng') ?? '')
    if ([originLat, originLng, destLat, destLng].some(isNaN)) {
      return NextResponse.json({ error: 'Coordenadas inválidas' }, { status: 400 })
    }
    points = [{ lat: originLat, lng: originLng }, { lat: destLat, lng: destLng }]
  }

  if (points.length < 2) {
    return NextResponse.json({ error: 'Se necesitan al menos 2 puntos' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  let totalDistanceKm = 0
  let totalDurationMin = 0

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${from.lat},${from.lng}&destinations=${to.lat},${to.lng}&mode=driving&language=es&key=${apiKey}`
    const gmRes = await fetch(url)
    const gmData = await gmRes.json()
    if (gmData.status !== 'OK' || gmData.rows[0].elements[0].status !== 'OK') {
      return NextResponse.json({ error: 'No se pudo calcular la ruta' }, { status: 422 })
    }
    const el = gmData.rows[0].elements[0]
    totalDistanceKm += el.distance.value / 1000
    totalDurationMin += el.duration.value / 60
  }

  let settings = DEFAULT_SETTINGS

  if (slug) {
    const { data: driver } = await supabase
      .from('drivers')
      .select('id')
      .eq('slug', slug)
      .single()

    if (driver) {
      const { data: driverSettings } = await supabase
        .from('settings')
        .select('*')
        .eq('driver_id', driver.id)
        .single()

      if (driverSettings) settings = driverSettings
    }
  }

  const price = calculatePrice(totalDistanceKm, totalDurationMin, settings)

  return NextResponse.json({ distance_km: totalDistanceKm, duration_min: totalDurationMin, price_ars: price })
}
