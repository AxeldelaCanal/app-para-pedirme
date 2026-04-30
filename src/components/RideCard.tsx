'use client'

import { useState, useRef } from 'react'
import type { Ride, RideStatus, PendingChanges } from '@/types'
import { detectConflict } from '@/lib/scheduling'
import SlideButton from './SlideButton'

interface Props {
  ride: Ride
  acceptedRides: Ride[]
  onStatusChange: (id: string, status: RideStatus) => void
  onRideUpdate: (id: string, updates: Partial<Ride>) => void
  onDelete: (id: string) => void
}

const STATUS_LABEL: Record<RideStatus, string> = {
  pending: 'Pendiente',
  accepted: 'En curso',
  rejected: 'Rechazado',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

const STATUS_COLOR: Record<RideStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  accepted: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
}

const SWIPE_THRESHOLD = 90

export default function RideCard({ ride, acceptedRides, onStatusChange, onRideUpdate, onDelete }: Props) {
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [conflictState, setConflictState] = useState<{ suggestedAt?: Date } | null>(null)
  const navKey = `navStep-${ride.id}`
  const [navStep, setNavStep] = useState<'navigate' | 'arrived'>(() =>
    typeof window !== 'undefined'
      ? (localStorage.getItem(navKey) as 'navigate' | 'arrived') ?? 'navigate'
      : 'navigate'
  )
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const swipeStartRef = useRef<number | null>(null)

  const dests = ride.destinations?.length
    ? ride.destinations
    : [{ address: ride.destination, lat: ride.destination_lat, lng: ride.destination_lng }]

  const scheduledDate = new Date(ride.scheduled_at)
  const dateStr = scheduledDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeStr = scheduledDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  // ── Swipe (solo pending) ───────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    if (ride.status !== 'pending') return
    swipeStartRef.current = e.touches[0].clientX
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (swipeStartRef.current === null) return
    const dx = e.touches[0].clientX - swipeStartRef.current
    setSwipeX(dx)
  }

  function handleTouchEnd() {
    if (swipeStartRef.current === null) return
    swipeStartRef.current = null
    if (swipeX > SWIPE_THRESHOLD) handleAccept()
    else if (swipeX < -SWIPE_THRESHOLD) updateStatus('rejected')
    setSwipeX(0)
  }

  // ── WhatsApp ───────────────────────────────────────────────────────────
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
      : `Hola ${ride.client_name} 😔 Lamentablemente no voy a poder tomar tu viaje del ${dateStr} a las ${timeStr}.\n\nTe recomiendo reagendar para otro horario o día. ¡Disculpá los inconvenientes!`
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
  }

  // ── Pending changes ────────────────────────────────────────────────────
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

      if (action === 'accept_changes') {
        const phone = `54${updated.client_phone.replace(/\D/g, '')}`
        const updatedDests = updated.destinations?.length
          ? updated.destinations
          : [{ address: updated.destination }]
        const routeText = updatedDests.length === 1
          ? `🏁 Destino: ${updatedDests[0].address}`
          : updatedDests.map((d: { address: string }, i: number) =>
              i === updatedDests.length - 1
                ? `🏁 Destino final: ${d.address}`
                : `🔵 Parada ${i + 1}: ${d.address}`
            ).join('\n')
        const sd = new Date(updated.scheduled_at)
        const ds = sd.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
        const ts = sd.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
        const msg = `¡Hola ${updated.client_name}! ✅ Acepté los cambios a tu viaje del ${ds} a las ${ts}.\n📍 Origen: ${updated.origin}\n${routeText}\n💰 Total: $${updated.price_ars.toLocaleString('es-AR')}`
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
      }
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
    if (conflict) { setConflictState({ suggestedAt }); return }
    updateStatus('accepted')
  }

  function navUrl(lat: number, lng: number) {
    const app = localStorage.getItem('nav_app') ?? 'waze'
    if (app === 'gmaps') {
      const ua = navigator.userAgent
      if (/iPhone|iPad|iPod/i.test(ua)) return `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`
      if (/Android/i.test(ua)) return `google.navigation:q=${lat},${lng}`
      return `https://maps.google.com/maps?daddr=${lat},${lng}&directionsmode=driving`
    }
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
  }

  // ── Nav step persistence ───────────────────────────────────────────────
  function setPersistedNavStep(step: 'navigate' | 'arrived') {
    setNavStep(step)
    if (step === 'arrived') localStorage.setItem(navKey, 'arrived')
    else localStorage.removeItem(navKey)
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

  async function handleGoBack() {
    const current = ride.current_stop_index
    if (navStep === 'arrived') { setPersistedNavStep('navigate'); return }
    if (current !== null) {
      setLoading(true)
      try {
        const prev = current === 0 ? null : current - 1
        await fetch(`/api/rides/${ride.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_stop_index: prev }),
        })
        onRideUpdate(ride.id, { current_stop_index: prev })
        setPersistedNavStep('arrived')
      } finally {
        setLoading(false)
      }
    }
  }

  async function handleNavButton() {
    if (navStep === 'navigate') {
      const current = ride.current_stop_index
      const target = current === null
        ? { lat: ride.origin_lat, lng: ride.origin_lng }
        : dests[current] ?? null
      if (target) window.open(navUrl(target.lat, target.lng), '_blank')
      setPersistedNavStep('arrived')
      return
    }
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
        setConfirmComplete(true)
        setPersistedNavStep('navigate')
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
      setPersistedNavStep('navigate')
    } finally {
      setLoading(false)
    }
  }

  const isSwipingRight = swipeX > 20
  const isSwipingLeft = swipeX < -20

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Swipe hints */}
      {ride.status === 'pending' && (
        <>
          <div className={`absolute inset-0 bg-emerald-500 flex items-center pl-5 transition-opacity duration-150 ${isSwipingRight ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-white font-bold text-sm">✓ Aceptar</span>
          </div>
          <div className={`absolute inset-0 bg-red-500 flex items-center justify-end pr-5 transition-opacity duration-150 ${isSwipingLeft ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-white font-bold text-sm">Rechazar ✗</span>
          </div>
        </>
      )}

      {/* Card */}
      <div
        className="relative rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm flex flex-col gap-3"
        style={{ transform: `translateX(${swipeX}px)`, transition: swipeX === 0 ? 'transform 0.25s ease' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header: horario + status */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{timeStr}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              ${ride.price_ars.toLocaleString('es-AR')}
            </span>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[ride.status]}`}>
              {STATUS_LABEL[ride.status]}
            </span>
          </div>
        </div>

        {/* Cliente */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
              {ride.client_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{ride.client_name}</p>
            <a href={`tel:${ride.client_phone}`} className="text-xs text-emerald-600 dark:text-emerald-400">
              {ride.client_phone}
            </a>
          </div>
        </div>

        {/* Ruta */}
        <div className="flex flex-col gap-1.5 text-sm bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5">
          <div className="flex gap-2 items-start">
            <span className="mt-0.5 text-emerald-500 shrink-0 text-xs">●</span>
            <span className="text-gray-700 dark:text-gray-300 text-xs">{ride.origin.split(',')[0]}</span>
          </div>
          {dests.map((d, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className={`mt-0.5 shrink-0 text-xs ${i === dests.length - 1 ? 'text-red-400' : 'text-blue-400'}`}>
                {i === dests.length - 1 ? '■' : '◎'}
              </span>
              <span className="text-gray-700 dark:text-gray-300 text-xs">{d.address.split(',')[0]}</span>
            </div>
          ))}
        </div>

        {/* Meta */}
        <div className="flex gap-3 text-xs text-gray-400 dark:text-gray-500">
          <span>📏 {ride.distance_km.toFixed(1)} km</span>
          <span>⏱ {Math.round(ride.duration_min)} min</span>
        </div>

        {/* Notas */}
        {ride.notes && (
          <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2 border border-gray-100 dark:border-gray-700">
            📝 {ride.notes}
          </p>
        )}

        {/* Cambios propuestos */}
        {ride.pending_changes && (() => {
          const pc = ride.pending_changes
          const diffs: { label: string; value: string }[] = []

          if (pc.scheduled_at && pc.scheduled_at !== ride.scheduled_at) {
            const d = new Date(pc.scheduled_at)
            diffs.push({
              label: 'Horario',
              value: `${d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
            })
          }
          if (pc.origin && pc.origin !== ride.origin) {
            diffs.push({ label: 'Origen', value: pc.origin.split(',')[0] })
          }
          const pcDestAddrs = pc.destinations?.map(d => d.address).join('|') ?? ''
          const rideDestAddrs = dests.map(d => d.address).join('|')
          if (pcDestAddrs && pcDestAddrs !== rideDestAddrs) {
            diffs.push({ label: 'Paradas', value: pc.destinations!.map(d => d.address.split(',')[0]).join(' → ') })
          }
          if (pc.price_ars && pc.price_ars !== ride.price_ars) {
            diffs.push({ label: 'Precio', value: `$${pc.price_ars.toLocaleString('es-AR')}` })
          }

          return (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 px-4 py-3 flex flex-col gap-2.5">
            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">El cliente propuso cambios</p>
            <div className="flex flex-col gap-1.5 text-xs">
              {diffs.map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-amber-700 dark:text-amber-400 font-medium">{label}</span>
                  <span className="text-amber-900 dark:text-amber-200 font-semibold text-right">{value}</span>
                </div>
              ))}
              {diffs.length === 0 && (
                <span className="text-amber-700 dark:text-amber-400">Sin cambios detectados</span>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => handlePendingChanges('reject_changes')} disabled={loading}
                className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 disabled:opacity-40">
                Rechazar
              </button>
              <button onClick={() => handlePendingChanges('accept_changes')} disabled={loading}
                className="flex-1 rounded-xl bg-emerald-500 py-2 text-xs font-semibold text-white disabled:opacity-40">
                Aceptar cambios
              </button>
            </div>
          </div>
          )
        })()}

        {/* Navegación */}
        {ride.status === 'accepted' && !confirmComplete && (
          <div className="flex flex-col gap-2">
            <SlideButton
              label={navButtonLabel()}
              variant={navStep === 'navigate' ? 'teal' : 'amber'}
              onConfirm={handleNavButton}
              disabled={loading}
            />
            {(navStep === 'arrived' || ride.current_stop_index !== null) && (
              <SlideButton
                label="Volver ←"
                variant="gray"
                reversed
                onConfirm={handleGoBack}
                disabled={loading}
              />
            )}
          </div>
        )}

        {/* Confirmación de cobro */}
        {confirmComplete && (
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700 px-4 py-4 flex flex-col gap-3">
            <div className="text-center">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium uppercase tracking-wide mb-1">Monto a cobrar</p>
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">${ride.price_ars.toLocaleString('es-AR')}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setConfirmComplete(false); setNavStep('arrived') }}
                className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
                Cancelar
              </button>
              <button onClick={() => { setConfirmComplete(false); updateStatus('completed') }} disabled={loading}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                Cobré — completar
              </button>
            </div>
          </div>
        )}

        {/* Conflicto */}
        {conflictState && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-3 py-3 flex flex-col gap-2">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Posible superposición con otro viaje
              {conflictState.suggestedAt && (
                <> — horario sugerido: {conflictState.suggestedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</>
              )}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConflictState(null)}
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Cancelar
              </button>
              {conflictState.suggestedAt && (
                <a
                  href={`https://wa.me/54${ride.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Hola ${ride.client_name}, puedo llevarte pero el horario disponible sería a las ${conflictState.suggestedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}. ¿Te viene bien?`
                  )}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 rounded-lg bg-[#25D366] py-2 text-xs font-semibold text-white text-center">
                  Sugerir horario
                </a>
              )}
              <button onClick={() => { setConflictState(null); updateStatus('accepted') }} disabled={loading}
                className="flex-1 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-white disabled:opacity-40">
                Aceptar igual
              </button>
            </div>
          </div>
        )}

        {/* Footer acciones */}
        <div className="flex items-center justify-end border-t border-gray-100 dark:border-gray-800 pt-3 gap-2">
          {confirmDelete ? (
            <>
              <button onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Cancelar
              </button>
              <button onClick={deleteRide} disabled={loading}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                Confirmar
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(true)} disabled={loading}
                className="rounded-lg border border-gray-100 dark:border-gray-800 p-1.5 text-gray-400 dark:text-gray-500 disabled:opacity-40">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              {ride.status === 'pending' && (
                <>
                  <button onClick={() => updateStatus('rejected')} disabled={loading}
                    className="rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 disabled:opacity-40">
                    Rechazar
                  </button>
                  <button onClick={handleAccept} disabled={loading}
                    className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                    Aceptar
                  </button>
                </>
              )}

              {(ride.status === 'accepted' || ride.status === 'rejected' || ride.status === 'completed') && (
                <a href={buildWaLink(ride.status)} target="_blank" rel="noopener noreferrer"
                  className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white">
                  WhatsApp
                </a>
              )}

              {ride.status === 'cancelled' && (
                <a
                  href={`https://wa.me/54${ride.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${ride.client_name}, vi que cancelaste el viaje. ¿Puedo ayudarte en algo?`)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white">
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
