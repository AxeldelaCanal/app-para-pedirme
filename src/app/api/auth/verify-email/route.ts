import { NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 })

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, email_verification_token_expires_at')
    .eq('email_verification_token', token)
    .eq('email_verified', false)
    .single()

  if (!driver) {
    return NextResponse.json({ error: 'Link inválido o ya usado' }, { status: 400 })
  }

  if (new Date(driver.email_verification_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'El link expiró. Creá tu cuenta nuevamente.' }, { status: 400 })
  }

  await supabase
    .from('drivers')
    .update({ email_verified: true, email_verification_token: null, email_verification_token_expires_at: null })
    .eq('id', driver.id)

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
