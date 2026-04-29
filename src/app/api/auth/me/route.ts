import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import { getDriverId } from '@/lib/auth'
import bcrypt from 'bcryptjs'

export async function GET() {
  const driverId = await getDriverId()
  if (!driverId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data, error } = await supabase
    .from('drivers')
    .select('id, name, slug, email, phone')
    .eq('id', driverId)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Driver no encontrado' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const driverId = await getDriverId()
  if (!driverId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { currentPassword, newPassword, newEmail } = await req.json()

  const { data: driver } = await supabase
    .from('drivers')
    .select('password_hash')
    .eq('id', driverId)
    .single()

  if (!driver || !(await bcrypt.compare(currentPassword, driver.password_hash))) {
    return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 401 })
  }

  if (newEmail) {
    const { error } = await supabase
      .from('drivers')
      .update({ email: newEmail.toLowerCase() })
      .eq('id', driverId)
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Ese email ya está en uso' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (newPassword) {
    const password_hash = await bcrypt.hash(newPassword, 10)
    const { error } = await supabase.from('drivers').update({ password_hash }).eq('id', driverId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
}

export async function DELETE() {
  const driverId = await getDriverId()
  if (!driverId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Eliminar rides y settings del driver antes de borrar el driver
  await supabase.from('rides').delete().eq('driver_id', driverId)
  await supabase.from('settings').delete().eq('driver_id', driverId)
  const { error } = await supabase.from('drivers').delete().eq('id', driverId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const res = NextResponse.json({ ok: true })
  res.cookies.delete('driver_id')
  return res
}
