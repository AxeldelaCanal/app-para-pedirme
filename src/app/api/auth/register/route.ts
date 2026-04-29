import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DEFAULT_SETTINGS } from '@/lib/pricing'
import { emailVerificacion } from '@/lib/email'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const { name, slug, email, password, phone } = await req.json()

  if (!name || !slug || !email || !password) {
    return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json({ error: 'El slug solo puede tener letras minúsculas, números y guiones' }, { status: 400 })
  }

  const password_hash = await bcrypt.hash(password, 10)

  const verificationToken = crypto.randomUUID()
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { data: driver, error } = await supabase
    .from('drivers')
    .insert({
      name,
      slug,
      email: email.toLowerCase(),
      password_hash,
      phone: phone || null,
      email_verified: false,
      email_verification_token: verificationToken,
      email_verification_token_expires_at: verificationExpires,
    })
    .select('id, slug')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'El email o slug ya está registrado' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('settings').insert({
    driver_id: driver.id,
    driver_phone: phone || null,
    base_fare: DEFAULT_SETTINGS.base_fare,
    price_per_km: DEFAULT_SETTINGS.price_per_km,
    price_per_min: DEFAULT_SETTINGS.price_per_min,
    booking_fee: DEFAULT_SETTINGS.booking_fee,
    updated_at: new Date().toISOString(),
  })

  const origin = new URL(req.url).origin
  const verifyLink = `${origin}/dashboard/verify-email/${verificationToken}`
  console.log('[register] Verify link:', verifyLink)
  await emailVerificacion(email.toLowerCase(), verifyLink)

  return NextResponse.json({ ok: true, requiresVerification: true })
}
