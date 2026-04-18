import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'

export async function POST(req: Request) {
  const cookieStore = await cookies()
  if (!cookieStore.get('dashboard_auth')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const subscription = await req.json()

  const { error } = await supabase
    .from('settings')
    .update({ push_subscription: subscription })
    .eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const cookieStore = await cookies()
  if (!cookieStore.get('dashboard_auth')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { error } = await supabase
    .from('settings')
    .update({ push_subscription: null })
    .eq('id', 1)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
