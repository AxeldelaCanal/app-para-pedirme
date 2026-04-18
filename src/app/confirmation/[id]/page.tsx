'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { use } from 'react'
import type { Ride } from '@/types'

type CancelState = 'idle' | 'confirming' | 'loading' | 'done'

export default function Confirmation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [ride, setRide] = useState<Ride | null>(null)
  const [cancelState, setCancelState] = useState<CancelState>('idle')
  const [driverPhone, setDriverPhone] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/rides/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(setRide)
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.driver_phone) setDriverPhone(d.driver_phone) })
  }, [id])

  async function cancelRide() {
    setCancelState('loading')
    await fetch(`/api/rides/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    setCancelState('done')

    if (driverPhone && ride) {
      const scheduledDate = new Date(ride.scheduled_at)
      const dateStr = scheduledDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
      const timeStr = scheduledDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      const phone = `54${driverPhone.replace(/\D/g, '')}`
      const msg = `Hola, soy ${ride.client_name}. Necesito cancelar mi viaje del ${dateStr} a las ${timeStr}. Disculpá los inconvenientes.`
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    }
  }

  const canCancel = ride && (ride.status === 'pending' || ride.status === 'accepted')
  const dests = ride?.destinations?.length
    ? ride.destinations
    : ride ? [{ address: ride.destination, lat: ride.destination_lat, lng: ride.destination_lng }] : []

  if (cancelState === 'done') {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-3xl p-8 text-center flex flex-col items-center gap-6 shadow-2xl">
            <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-12 h-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Viaje cancelado</h1>
              <p className="mt-2 text-gray-500 text-sm leading-relaxed">
                Tu cancelación fue registrada. Si se abrió WhatsApp, enviá el mensaje para avisar al conductor.
              </p>
            </div>
            <Link href="/" className="w-full rounded-2xl bg-slate-900 py-4 font-semibold text-white text-center">
              Hacer un nuevo pedido
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl p-8 text-center flex flex-col items-center gap-6 shadow-2xl">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-emerald-50 flex items-center justify-center">
              <svg className="w-12 h-12 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">¡Pedido enviado!</h1>
            <p className="mt-2 text-gray-500 text-sm leading-relaxed">
              Recibimos tu solicitud. Te confirmamos el viaje por WhatsApp a la brevedad.
            </p>
          </div>

          {ride && (
            <div className="w-full bg-gray-50 rounded-2xl px-4 py-3 flex flex-col gap-2 text-sm border border-gray-100">
              <div className="flex gap-2 items-start">
                <span className="text-emerald-500 shrink-0 mt-0.5">↑</span>
                <span className="text-gray-700">{ride.origin.split(',')[0]}</span>
              </div>
              {dests.map((d, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className={`shrink-0 mt-0.5 ${i === dests.length - 1 ? 'text-red-400' : 'text-blue-400'}`}>
                    {i === dests.length - 1 ? '↓' : '◎'}
                  </span>
                  <span className="text-gray-700 truncate">{d.address.split(',')[0]}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1 border-t border-gray-200 text-xs text-gray-500">
                <span>
                  {new Date(ride.scheduled_at).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' · '}
                  {new Date(ride.scheduled_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-semibold text-gray-900">${ride.price_ars.toLocaleString('es-AR')}</span>
              </div>
            </div>
          )}

          <div className="w-full bg-emerald-50 rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <p className="text-sm text-emerald-800 font-medium">Te escribimos por WhatsApp en minutos</p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <Link
              href={`/editar/${id}`}
              className="w-full rounded-2xl border-2 border-slate-200 py-4 font-semibold text-slate-700 text-center"
            >
              Modificar viaje
            </Link>
            <Link
              href="/"
              className="w-full rounded-2xl bg-slate-900 py-4 font-semibold text-white text-center"
            >
              Hacer otro pedido
            </Link>

            {canCancel && (
              cancelState === 'confirming' ? (
                <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                  <p className="text-sm text-gray-600">¿Seguro que querés cancelar el viaje?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCancelState('idle')}
                      className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm font-semibold text-gray-600"
                    >
                      No, mantener
                    </button>
                    <button
                      onClick={cancelRide}
                      className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-semibold text-white"
                    >
                      Sí, cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCancelState('confirming')}
                  className="w-full rounded-2xl border border-red-200 py-3 text-sm font-semibold text-red-500"
                >
                  Cancelar viaje
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
