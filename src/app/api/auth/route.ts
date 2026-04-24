import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, password_hash')
    .eq('email', email.toLowerCase())
    .single()

  if (!driver || !(await bcrypt.compare(password, driver.password_hash))) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('driver_id', driver.id, {
    httpOnly: true,
    sameSite: 'strict',
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
