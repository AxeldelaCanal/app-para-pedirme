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
  const [destination, setDestination] = useState<Location | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [newPrice, setNewPrice] = useState<number | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [locationsChanged, setLocationsChanged] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetch(`/api/rides/${id}`)
      .then(r => r.json())
      .then((data: Ride) => {
        if (data.status !== 'pending' && data.status !== 'accepted') {
          setError('Este pedido ya no está disponible.')
        }
        setRide(data)
        setOrigin({ address: data.origin, lat: data.origin_lat, lng: data.origin_lng })
        setDestination({ address: data.destination, lat: data.destination_lat, lng: data.destination_lng })
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

  const handleDestinationChange = useCallback((loc: Location) => {
    setDestination(loc)
    setLocationsChanged(true)
    setNewPrice(null)
  }, [])

  async function recalculate() {
    if (!origin || !destination) return
    setRecalculating(true)
    try {
      const params = new URLSearchParams({
        originLat: String(origin.lat),
        originLng: String(origin.lng),
        destLat: String(destination.lat),
        destLng: String(destination.lng),
      })
      const res = await fetch(`/api/price?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewPrice(data.price_ars)
      // Guardamos distancia y duración para el save
      setRide(prev => prev ? { ...prev, distance_km: data.distance_km, duration_min: data.duration_min } : prev)
    } catch {
      setError('No se pudo recalcular el precio.')
    } finally {
      setRecalculating(false)
    }
  }

  const canSave = (() => {
    if (!date || !time) return false
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
    if (!origin || !destination) return
    setSaving(true)
    setError('')
    try {
      const isAccepted = ride?.status === 'accepted'
      const changes = {
        scheduled_at: new Date(`${date}T${time}`).toISOString(),
        origin: origin.address,
        origin_lat: origin.lat,
        origin_lng: origin.lng,
        destination: destination.address,
        destination_lat: destination.lat,
        destination_lng: destination.lng,
        ...(newPrice !== null && {
          price_ars: newPrice,
          distance_km: ride?.distance_km,
          duration_min: ride?.duration_min,
        }),
      }

      const body = isAccepted
        ? { pending_changes: changes }
        : { ...changes, status: 'pending' }

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

              {/* Ubicaciones */}
              {origin && (
                <LocationInput
                  label="Punto de partida"
                  placeholder="Ej: Av. Colón 1234, Mar del Plata"
                  value={origin.address}
                  onChange={handleOriginChange}
                  showCurrentLocation
                />
              )}
              {destination && (
                <LocationInput
                  label="Destino"
                  placeholder="Ej: Shopping Los Gallegos"
                  value={destination.address}
                  onChange={handleDestinationChange}
                />
              )}

              {/* Recalcular precio si cambiaron las ubicaciones */}
              {locationsChanged && newPrice === null && (
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
