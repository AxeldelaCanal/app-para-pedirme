import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getDriverId } from '@/lib/auth'
import { sendPush } from '@/lib/push'

export async function POST() {
  const driverId = await getDriverId()
  if (!driverId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data: settings } = await supabase
    .from('settings')
    .select('push_subscription')
    .eq('driver_id', driverId)
    .single()

  if (!settings?.push_subscription) {
    return NextResponse.json({ error: 'No hay suscripción push registrada. Activá las notificaciones primero.' }, { status: 400 })
  }

  const { expired } = await sendPush(settings.push_subscription as Parameters<typeof sendPush>[0], {
    title: '✅ Notificaciones funcionando',
    body: 'Si ves esto, las push están activas.',
    tag: 'test',
  })

  if (expired) {
    await supabase.from('settings').update({ push_subscription: null }).eq('driver_id', driverId)
    return NextResponse.json({ error: 'La suscripción expiró. Recargá el dashboard para renovarla.' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
