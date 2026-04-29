import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { email, password, remember = true } = await req.json()

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, password_hash, email_verified')
    .eq('email', email.toLowerCase())
    .single()

  if (!driver || !(await bcrypt.compare(password, driver.password_hash))) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  if (driver.email_verified === false) {
    return NextResponse.json({ error: 'Verificá tu email antes de ingresar. Revisá tu casilla de correo.', unverified: true }, { status: 403 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('driver_id', driver.id, {
    httpOnly: true,
    sameSite: 'strict',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete('driver_id')
  return res
}
