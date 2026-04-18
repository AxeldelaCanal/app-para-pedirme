'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Ride, Location } from '@/types'

const LocationInput = dynamic(() => import('@/components/LocationInput'), { ssr: false })

export default function EditarPedido() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [ride, setRide] = useState<Ride | null>(null)
  const [origin, setOrigin] = useState<Location | null>(null)
  const [destinations, setDestinations] = useState<Location[]>([])
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [newPrice, setNewPrice] = useState<number | null>(null)
  const [newDistKm, setNewDistKm] = useState<number | null>(null)
  const [newDurMin, setNewDurMin] = useState<number | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [locationsChanged, setLocationsChanged] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const today = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

  useEffect(() => {
    fetch(`/api/rides/${id}`)
      .then(r => r.json())
      .then((data: Ride) => {
        if (data.status !== 'pending' && data.status !== 'accepted') {
          setError('Este pedido ya no está disponible.')
        }
        setRide(data)
        setOrigin({ address: data.origin, lat: data.origin_lat, lng: data.origin_lng })
        const dests = data.destinations?.length
          ? data.destinations
          : [{ address: data.destination, lat: data.destination_lat, lng: data.destination_lng }]
        setDestinations(dests)
        const d = new Date(data.scheduled_at)
        setDate(d.toISOString().split('T')[0])
        setTime(d.toTimeString().slice(0, 5))
        setLoading(false)
      })
      .catch(() => { setError('No se encontró el pedido.'); setLoading(false) })
  }, [id])

  const handleOriginChange = useCallback((loc: Location) => {
    setOrigin(loc)
    setLocationsChanged(true)
    setNewPrice(null)
  }, [])

  function handleDestChange(i: number, loc: Location) {
    setDestinations(prev => {
      const next = [...prev]
      next[i] = loc
      return next
    })
    setLocationsChanged(true)
    setNewPrice(null)
  }

  function addDestination() {
    setDestinations(prev => [...prev, { address: '', lat: 0, lng: 0 }])
    setLocationsChanged(true)
    setNewPrice(null)
  }

  function removeDestination(i: number) {
    setDestinations(prev => prev.filter((_, j) => j !== i))
    setLocationsChanged(true)
    setNewPrice(null)
  }

  const allDestsValid = destinations.length > 0 && destinations.every(d => d.address && d.lat !== 0)

  async function recalculate() {
    if (!origin || !allDestsValid) return
    setRecalculating(true)
    setError('')
    try {
      const waypoints = [
        { lat: origin.lat, lng: origin.lng },
        ...destinations.map(d => ({ lat: d.lat, lng: d.lng })),
      ]
      const params = new URLSearchParams({ waypoints: JSON.stringify(waypoints) })
      const res = await fetch(`/api/price?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewPrice(data.price_ars)
      setNewDistKm(data.distance_km)
      setNewDurMin(data.duration_min)
    } catch {
      setError('No se pudo recalcular el precio.')
    } finally {
      setRecalculating(false)
    }
  }

  const canSave = (() => {
    if (!date || !time || !origin || !allDestsValid) return false
    if (locationsChanged && newPrice === null) return false
    const selected = new Date(`${date}T${time}`)
    const minTime = new Date()
    minTime.setMinutes(minTime.getMinutes() + 30)
    return selected >= minTime
  })()

  const timeError = (() => {
    if (!date || !time) return ''
    const selected = new Date(`${date}T${time}`)
    const minTime = new Date()
    minTime.setMinutes(minTime.getMinutes() + 30)
    return selected < minTime ? 'El viaje debe ser con al menos 30 minutos de anticipación' : ''
  })()

  const canEdit = ride?.status === 'pending' || ride?.status === 'accepted'

  async function save() {
    if (!origin || !allDestsValid) return
    setSaving(true)
    setError('')
    try {
      const isAccepted = ride?.status === 'accepted'
      const isInProgress = ride?.current_stop_index !== null && ride?.current_stop_index !== undefined
      const lastDest = destinations[destinations.length - 1]
      const changes = {
        scheduled_at: new Date(`${date}T${time}`).toISOString(),
        origin: origin.address,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination: lastDest.address,
        destination_lat: lastDest.lat,
        destination_lng: lastDest.lng,
        destinations,
        ...(newPrice !== null && {
          price_ars: newPrice,
          distance_km: newDistKm ?? ride?.distance_km,
          duration_min: newDurMin ?? ride?.duration_min,
        }),
      }

      const body = isAccepted && !isInProgress
        ? { pending_changes: changes }
        : { ...changes, ...(isAccepted ? {} : { status: 'pending' }) }

      const res = await fetch(`/api/rides/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error al guardar')
      router.push(`/confirmation/${id}`)
    } catch {
      setError('No se pudo guardar el cambio. Intentá de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  function destLabel(i: number) {
    if (destinations.length === 1) return 'Destino'
    if (i === destinations.length - 1) return 'Destino final'
    return `Parada ${i + 1}`
  }

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-1">Modificar pedido</p>
            <h1 className="text-2xl font-bold text-gray-900">Editá tu viaje</h1>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 py-4 text-center">Cargando...</p>
          ) : error && !ride ? (
            <p className="text-sm text-red-500 text-center py-4">{error}</p>
          ) : (
            <>
              {error && <p className="text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-3">{error}</p>}

              {/* Origen */}
              {origin && (
                <LocationInput
                  label="Punto de partida"
                  placeholder="Ej: Av. Colón 1234, Mar del Plata"
                  value={origin.address}
                  onChange={handleOriginChange}
                  showCurrentLocation
                />
              )}

              {/* Destinos */}
              {destinations.map((dest, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <LocationInput
                      label={destLabel(i)}
                      placeholder="Ej: Shopping Los Gallegos"
                      value={dest.address}
                      onChange={loc => handleDestChange(i, loc)}
                    />
                  </div>
                  {destinations.length > 1 && (
                    <button
                      onClick={() => removeDestination(i)}
                      className="mb-1 p-2 text-gray-400 hover:text-red-400 transition-colors rounded-lg border border-gray-200"
                      aria-label="Eliminar destino"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={addDestination}
                className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium self-start"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Agregar parada
              </button>

              {/* Recalcular precio */}
              {locationsChanged && newPrice === null && allDestsValid && (
                <button
                  onClick={recalculate}
                  disabled={recalculating}
                  className="w-full rounded-xl border-2 border-emerald-400 py-3 text-sm font-semibold text-emerald-600 disabled:opacity-40"
                >
                  {recalculating ? 'Calculando...' : 'Recalcular precio →'}
                </button>
              )}

              {newPrice !== null && (
                <div className="bg-emerald-50 rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-emerald-700">Precio actualizado</span>
                  <span className="font-bold text-emerald-700">${newPrice.toLocaleString('es-AR')}</span>
                </div>
              )}

              {/* Fecha y hora */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Fecha</label>
                <input
                  type="date"
                  min={today}
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Hora</label>
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
                />
                {timeError && <p className="text-xs text-red-500">{timeError}</p>}
              </div>

              {canEdit && (
                <button
                  onClick={save}
                  disabled={!canSave || saving}
                  className="w-full rounded-2xl bg-slate-900 py-4 font-semibold text-white disabled:opacity-30"
                >
                  {saving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
