'use client'

import { useState } from 'react'
import type { Ride, RideStatus, PendingChanges } from '@/types'
import { detectConflict } from '@/lib/scheduling'

interface Props {
  ride: Ride
  acceptedRides: Ride[]
  onStatusChange: (id: string, status: RideStatus) => void
  onRideUpdate: (id: string, updates: Partial<Ride>) => void
  onDelete: (id: string) => void
}

const STATUS_LABEL: Record<RideStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const STATUS_COLOR: Record<RideStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function RideCard({ ride, acceptedRides, onStatusChange, onRideUpdate, onDelete }: Props) {
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [conflictState, setConflictState] = useState<{ suggestedAt?: Date } | null>(null)
  const [navStep, setNavStep] = useState<'navigate' | 'arrived'>('navigate')
  const [confirmComplete, setConfirmComplete] = useState(false)

  const dests = ride.destinations?.length
    ? ride.destinations
    : [{ address: ride.destination, lat: ride.destination_lat, lng: ride.destination_lng }]

  const scheduledDate = new Date(ride.scheduled_at)
  const dateStr = scheduledDate.toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
  const timeStr = scheduledDate.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit',
  })

  function buildWaLink(status: RideStatus) {
    const phone = `54${ride.client_phone.replace(/\D/g, '')}`
    const cancelLink = `${window.location.origin}/confirmation/${ride.id}`
    const routeText = dests.length === 1
      ? `🏁 Destino: ${dests[0].address}`
      : dests.map((d, i) =>
          i === dests.length - 1
            ? `🏁 Destino final: ${d.address}`
            : `🔵 Parada ${i + 1}: ${d.address}`
        ).join('\n')

    const msg = status === 'accepted'
      ? `¡Hola ${ride.client_name}! ✅ Confirmé tu viaje para el ${dateStr} a las ${timeStr}.\n📍 Origen: ${ride.origin}\n${routeText}\n💰 Total: $${ride.price_ars.toLocaleString('es-AR')}\n\nTe espero puntual. Cualquier consulta escribime acá.\n\n🔗 Si necesitás cancelar o modificar: ${cancelLink}`
      : `Hola ${ride.client_name} 😔 Lamentablemente no voy a poder tomar tu viaje del ${dateStr} a las ${timeStr}.\n\nTe recomiendo reagendar para otro horario o día — con gusto te llevo cuando pueda. ¡Disculpá los inconvenientes!`
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
  }

  async function handlePendingChanges(action: 'accept_changes' | 'reject_changes') {
    setLoading(true)
    try {
      const res = await fetch(`/api/rides/${ride.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const updated = await res.json()
      onRideUpdate(ride.id, updated)
    } finally {
      setLoading(false)
    }
  }

  function diffLabel(key: keyof PendingChanges, value: unknown): string {
    if (key === 'scheduled_at') {
      const d = new Date(value as string)
      return `${d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
    }
    if (key === 'price_ars') return `$${(value as number).toLocaleString('es-AR')}`
    if (key === 'origin') return (value as string).split(',')[0]
    if (key === 'destination') return (value as string).split(',')[0]
    return String(value)
  }

  async function deleteRide() {
    setLoading(true)
    await fetch(`/api/rides/${ride.id}`, { method: 'DELETE' })
    onDelete(ride.id)
  }

  async function updateStatus(status: RideStatus) {
    setLoading(true)
    try {
      await fetch(`/api/rides/${ride.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      onStatusChange(ride.id, status)
      if (status === 'accepted' || status === 'rejected') {
        window.open(buildWaLink(status), '_blank')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleAccept() {
    const { conflict, suggestedAt } = detectConflict(ride, acceptedRides)
    if (conflict) {
      setConflictState({ suggestedAt })
      return
    }
    updateStatus('accepted')
  }

  function wazeUrl(lat: number, lng: number) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
  }

  function navButtonLabel(): string {
    const current = ride.current_stop_index
    if (navStep === 'navigate') {
      if (current === null) return 'Ir a buscar cliente'
      if (current >= dests.length - 1) return 'Llevar al destino final'
      return `Llevar a Parada ${current + 1}`
    } else {
      if (current === null) return 'Llegué al cliente'
      if (current >= dests.length - 1) return 'Llegué — completar viaje'
      return `Llegué a Parada ${current + 1}`
    }
  }

  async function handleNavButton() {
    if (navStep === 'navigate') {
      const current = ride.current_stop_index
      const target = current === null
        ? { lat: ride.origin_lat, lng: ride.origin_lng }
        : dests[current] ?? null
      if (target) window.open(wazeUrl(target.lat, target.lng), '_blank')
      setNavStep('arrived')
      return
    }

    // navStep === 'arrived' → avanzar al siguiente tramo
    const current = ride.current_stop_index
    setLoading(true)
    try {
      if (current === null) {
        await fetch(`/api/rides/${ride.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_stop_index: 0 }),
        })
        onRideUpdate(ride.id, { current_stop_index: 0 })
      } else if (current >= dests.length - 1) {
        // Antes de completar → pedir confirmación de cobro
        setConfirmComplete(true)
        setNavStep('navigate')
        return
      } else {
        const next = current + 1
        await fetch(`/api/rides/${ride.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_stop_index: next }),
        })
        onRideUpdate(ride.id, { current_stop_index: next })
      }
      setNavStep('navigate')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">{ride.client_name}</p>
          <a href={`tel:${ride.client_phone}`} className="text-sm text-emerald-600 font-medium">
            {ride.client_phone}
          </a>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[ride.status]}`}>
          {STATUS_LABEL[ride.status]}
        </span>
      </div>

      {/* Ruta */}
      <div className="flex flex-col gap-1.5 text-sm">
        <div className="flex gap-2 items-start">
          <span className="mt-0.5 text-emerald-500 shrink-0">↑</span>
          <span className="text-gray-700">{ride.origin.split(',')[0]}</span>
        </div>
        {dests.map((d, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className={`mt-0.5 shrink-0 ${i === dests.length - 1 ? 'text-red-400' : 'text-blue-400'}`}>
              {i === dests.length - 1 ? '↓' : '◎'}
            </span>
            <span className="text-gray-700">{d.address.split(',')[0]}</span>
          </div>
        ))}
      </div>

      {/* Meta */}
      <div className="flex gap-3 text-xs text-gray-500 flex-wrap">
        <span>📅 {dateStr} · {timeStr}</span>
        <span>📏 {ride.distance_km.toFixed(1)} km</span>
        <span>⏱ {Math.round(ride.duration_min)} min</span>
      </div>

      {/* Notas */}
      {ride.notes && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
          📝 {ride.notes}
        </p>
      )}

      {/* Cambios propuestos por el cliente */}
      {ride.pending_changes && (
        <div className="rounded-xl bg-amber-50 border-2 border-amber-300 px-4 py-3 flex flex-col gap-2.5">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">El cliente propuso cambios</p>
          <div className="flex flex-col gap-1.5 text-xs">
            {(Object.entries(ride.pending_changes) as [keyof PendingChanges, unknown][])
              .filter(([k]) => ['scheduled_at', 'origin', 'destination', 'price_ars'].includes(k))
              .map(([key, val]) => {
                const labels: Partial<Record<keyof PendingChanges, string>> = {
                  scheduled_at: 'Horario',
                  origin: 'Origen',
                  destination: 'Destino',
                  price_ars: 'Precio',
                }
                return (
                  <div key={key} className="flex justify-between gap-2">
                    <span className="text-amber-700 font-medium">{labels[key]}</span>
                    <span className="text-amber-900 font-semibold text-right">{diffLabel(key, val)}</span>
                  </div>
                )
              })}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handlePendingChanges('reject_changes')}
              disabled={loading}
              className="flex-1 rounded-xl border border-gray-200 py-2 text-xs font-semibold text-gray-600 disabled:opacity-40"
            >
              Rechazar
            </button>
            <button
              onClick={() => handlePendingChanges('accept_changes')}
              disabled={loading}
              className="flex-1 rounded-xl bg-emerald-500 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Aceptar cambios
            </button>
          </div>
        </div>
      )}

      {/* Navegación — botón único que alterna entre navegar y confirmar llegada */}
      {ride.status === 'accepted' && !confirmComplete && (
        <button
          onClick={handleNavButton}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
            navStep === 'navigate'
              ? 'bg-[#09d3ac] text-white'
              : 'bg-amber-50 border-2 border-amber-300 text-amber-800'
          }`}
        >
          {navStep === 'navigate' && (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.54 6.63C19.29 4.1 16.89 2.25 14 2.03V2h-4v.03C7.11 2.25 4.71 4.1 3.46 6.63A9.95 9.95 0 002 12c0 1.74.45 3.37 1.23 4.79L2 22l5.21-1.23A9.956 9.956 0 0012 22c5.52 0 10-4.48 10-10 0-1.94-.56-3.74-1.46-5.37zM12 20c-1.49 0-2.89-.41-4.09-1.12l-.29-.17-3.09.73.74-3.02-.19-.31A7.947 7.947 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
          )}
          {navStep === 'arrived' && <span className="text-base">✓</span>}
          {navButtonLabel()}
        </button>
      )}

      {/* Confirmación de cobro */}
      {confirmComplete && (
        <div className="rounded-xl bg-emerald-50 border-2 border-emerald-300 px-4 py-4 flex flex-col gap-3">
          <div className="text-center">
            <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide mb-1">Monto a cobrar</p>
            <p className="text-3xl font-bold text-emerald-700">${ride.price_ars.toLocaleString('es-AR')}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setConfirmComplete(false); setNavStep('arrived') }}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600"
            >
              Cancelar
            </button>
            <button
              onClick={() => { setConfirmComplete(false); updateStatus('completed') }}
              disabled={loading}
              className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Cobré — completar
            </button>
          </div>
        </div>
      )}

      {/* Aviso de conflicto */}
      {conflictState && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-3 flex flex-col gap-2">
          <p className="text-xs font-semibold text-amber-800">
            Posible superposición con otro viaje
            {conflictState.suggestedAt && (
              <> — horario sugerido: {conflictState.suggestedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</>
            )}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConflictState(null)}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-semibold text-gray-600"
            >
              Cancelar
            </button>
            {conflictState.suggestedAt && (
              <a
                href={`https://wa.me/54${ride.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Hola ${ride.client_name}, puedo llevarte pero el horario disponible sería a las ${conflictState.suggestedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}. ¿Te viene bien?`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg bg-[#25D366] py-2 text-xs font-semibold text-white text-center"
              >
                Sugerir horario
              </a>
            )}
            <button
              onClick={() => { setConflictState(null); updateStatus('accepted') }}
              disabled={loading}
              className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Aceptar igual
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-lg font-bold text-emerald-600">${ride.price_ars.toLocaleString('es-AR')}</span>

        <div className="flex gap-2">
          {confirmDelete ? (
            <>
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600">
                Cancelar
              </button>
              <button onClick={deleteRide} disabled={loading} className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                Confirmar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(true)} disabled={loading} className="rounded-lg border border-gray-100 p-1.5 text-gray-400 disabled:opacity-40">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              {ride.status === 'pending' && (
                <>
                  <button onClick={() => updateStatus('rejected')} disabled={loading} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40">
                    Rechazar
                  </button>
                  <button onClick={handleAccept} disabled={loading} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                    Aceptar
                  </button>
                </>
              )}

              {ride.status === 'accepted' && (
                <a href={buildWaLink('accepted')} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white">
                  WhatsApp
                </a>
              )}

              {(ride.status === 'rejected' || ride.status === 'completed') && (
                <a href={buildWaLink(ride.status)} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white">
                  WhatsApp
                </a>
              )}

              {ride.status === 'cancelled' && (
                <a
                  href={`https://wa.me/54${ride.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${ride.client_name}, vi que cancelaste el viaje. ¿Puedo ayudarte en algo?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Contactar
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
