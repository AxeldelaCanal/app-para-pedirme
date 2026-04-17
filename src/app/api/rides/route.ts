import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import type { Ride } from '@/types'

export async function GET() {
  const { data, error } = await supabase
    .from('rides')
    .select('*')
    .order('scheduled_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  try {
    const body: Omit<Ride, 'id' | 'status' | 'created_at'> = await req.json()

    const { data, error } = await supabase
      .from('rides')
      .insert({ ...body, status: 'pending' })
      .select()
      .single()

    if (error) {
      console.error('[rides POST] Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    console.error('[rides POST] Unexpected error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
