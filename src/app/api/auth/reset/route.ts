import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { emailResetPassword } from '@/lib/email'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, email')
    .eq('email', email.toLowerCase())
    .single()

  // Responder ok aunque no exista el email (no revelar si está registrado)
  if (!driver) return NextResponse.json({ ok: true })

  const token = crypto.randomUUID()
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  await supabase
    .from('drivers')
    .update({ reset_token: token, reset_token_expires_at: expires })
    .eq('id', driver.id)

  // Usar el origen de la request para que funcione tanto en local como en producción
  const origin = new URL(req.url).origin
  const resetLink = `${origin}/dashboard/reset-password/${token}`

  console.log('[reset] Link:', resetLink) // útil para probar en local
  await emailResetPassword(driver.email, resetLink)

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const { token, newPassword } = await req.json()
  if (!token || !newPassword) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })
  if (newPassword.length < 6) return NextResponse.json({ error: 'Mínimo 6 caracteres' }, { status: 400 })

  const { data: driver } = await supabase
    .from('drivers')
    .select('id, reset_token_expires_at')
    .eq('reset_token', token)
    .single()

  if (!driver) return NextResponse.json({ error: 'Link inválido o ya usado' }, { status: 400 })

  if (new Date(driver.reset_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'El link expiró. Pedí uno nuevo.' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(newPassword, 10)
  await supabase
    .from('drivers')
    .update({ password_hash, reset_token: null, reset_token_expires_at: null })
    .eq('id', driver.id)

  return NextResponse.json({ ok: true })
}
