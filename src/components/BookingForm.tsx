'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import type { Location, PriceEstimate } from '@/types'

const LocationInput = dynamic(() => import('./LocationInput'), { ssr: false })

type Step = 1 | 2 | 3 | 4

interface FormState {
  origin: Location | null
  destinations: (Location | null)[]
  asap: boolean
  date: string
  time: string
  name: string
  phone: string
  notes: string
}

function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const EMPTY: FormState = {
  origin: null,
  destinations: [null],
  asap: false,
  date: localToday(),
  time: '',
  name: '',
  phone: '',
  notes: '',
}

export default function BookingForm({ driverSlug }: { driverSlug: string }) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const setOrigin = useCallback((loc: Location) => setForm(f => ({ ...f, origin: loc })), [])

  function setDestinationAt(i: number, loc: Location) {
    setForm(f => {
      const next = [...f.destinations]
      next[i] = loc
      return { ...f, destinations: next }
    })
  }

  function addStop() {
    setForm(f => ({ ...f, destinations: [...f.destinations, null] }))
  }

  function removeStop(i: number) {
    setForm(f => ({ ...f, destinations: f.destinations.filter((_, j) => j !== i) }))
  }

  // Step 2: auto-fetch price when arriving
  useEffect(() => {
    if (step !== 2) return
    if (!form.origin || form.destinations.some(d => !d)) return
    const validDests = form.destinations as Location[]
    setLoading(true)
    setError('')
    const waypoints = [
      { lat: form.origin.lat, lng: form.origin.lng },
      ...validDests.map(d => ({ lat: d.lat, lng: d.lng })),
    ]
    const params = new URLSearchParams({ waypoints: JSON.stringify(waypoints), slug: driverSlug })
    fetch(`/api/price?${params}`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error)
        setEstimate(data)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error al calcular el precio'))
      .finally(() => setLoading(false))
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirm() {
    if (!form.origin || form.destinations.some(d => !d) || !estimate) return
    const validDests = form.destinations as Location[]
    const finalDest = validDests[validDests.length - 1]
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_slug: driverSlug,
          client_name: form.name,
          client_phone: form.phone,
          origin: form.origin.address,
          origin_lat: form.origin.lat,
          origin_lng: form.origin.lng,
          destination: finalDest.address,
          destination_lat: finalDest.lat,
          destination_lng: finalDest.lng,
          destinations: validDests,
          scheduled_at: form.asap ? new Date().toISOString() : new Date(`${form.date}T${form.time}`).toISOString(),
          distance_km: estimate.distance_km,
          duration_min: estimate.duration_min,
          price_ars: estimate.price_ars,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/${driverSlug}/confirmation/${data.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al confirmar el pedido')
    } finally {
      setLoading(false)
    }
  }

  const validDests = form.destinations.filter(Boolean) as Location[]
  const canStep1 = !!form.origin && form.destinations.length > 0 && validDests.length === form.destinations.length
  const canDateTime = form.asap || !!(form.date && form.time)
  const timeError = ''

  const isValidArgPhone = (p: string) => /^(11|15|2\d{2,3}|3\d{2,3})\d{6,8}$/.test(p.replace(/\D/g, ''))
  const canStep4 = form.name.trim().length > 1 && isValidArgPhone(form.phone)

  function destLabel(i: number, total: number) {
    if (total === 1) return 'Destino'
    if (i === total - 1) return 'Destino final'
    return `Parada ${i + 1}`
  }

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Progreso */}
      <div className="flex gap-1.5 mb-7">
        {([1, 2, 3, 4] as Step[]).map(s => (
          <div key={s} className="flex-1">
            <div className={`h-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-emerald-500' : 'bg-gray-100'}`} />
          </div>
        ))}
      </div>

      {/* Paso 1 — Ubicaciones */}
      {step === 1 && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-1">Paso 1 de 4</p>
            <h2 className="text-2xl font-bold text-gray-900">¿A dónde vas?</h2>
          </div>

          <LocationInput
            label="Punto de partida"
            placeholder="Ej: Av. Colón 1234, Mar del Plata"
            value={form.origin?.address ?? ''}
            onChange={setOrigin}
            showCurrentLocation
          />

          <div className="flex flex-col gap-3">
            {form.destinations.map((dest, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <LocationInput
                    label={destLabel(i, form.destinations.length)}
                    placeholder="Ej: Shopping Los Gallegos"
                    value={dest?.address ?? ''}
                    onChange={loc => setDestinationAt(i, loc)}
                  />
                </div>
                {form.destinations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStop(i)}
                    className="mb-1 p-2 text-gray-400 hover:text-red-400 transition-colors rounded-lg border border-gray-200"
                    aria-label="Eliminar parada"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addStop}
              className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium self-start"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Agregar parada
            </button>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!canStep1}
            className="mt-2 w-full rounded-2xl bg-slate-900 py-4 font-semibold text-white disabled:opacity-30 transition-opacity"
          >
            Continuar →
          </button>
        </div>
      )}

      {/* Paso 2 — Precio */}
      {step === 2 && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-1">Paso 2 de 4</p>
            <h2 className="text-2xl font-bold text-gray-900">Tu precio</h2>
          </div>

          {loading && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center text-sm text-gray-400">
              Calculando precio...
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          {estimate && !loading && (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 flex flex-col gap-3 text-sm">
              <Row label="Origen" value={form.origin?.address ?? ''} />
              {form.destinations.map((d, i) => (
                <Row key={i} label={destLabel(i, form.destinations.length)} value={d?.address ?? ''} />
              ))}
              <Row label="Distancia" value={`${estimate.distance_km.toFixed(1)} km`} />
              <Row label="Duración estimada" value={`${Math.round(estimate.duration_min)} min`} />
              <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                <span className="font-semibold text-gray-700">Total estimado</span>
                <span className="text-2xl font-bold text-slate-900">${estimate.price_ars.toLocaleString('es-AR')}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 rounded-2xl border border-gray-200 py-4 font-semibold text-gray-600">
              ← Atrás
            </button>
            <button
              onClick={() => setStep(3)}
              disabled={!estimate || loading}
              className="flex-1 rounded-2xl bg-slate-900 py-4 font-semibold text-white disabled:opacity-30"
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* Paso 3 — Fecha y hora */}
      {step === 3 && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-1">Paso 3 de 4</p>
            <h2 className="text-2xl font-bold text-gray-900">¿Cuándo?</h2>
          </div>
          {estimate && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 flex justify-between items-center text-sm">
              <span className="text-emerald-700">Total estimado</span>
              <span className="font-bold text-emerald-700">${estimate.price_ars.toLocaleString('es-AR')}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, asap: !f.asap }))}
            className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
              form.asap
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              form.asap ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
            }`}>
              {form.asap && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            Lo antes posible
          </button>

          {!form.asap && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Fecha</label>
                <input
                  type="date"
                  min={localToday()}
                  max={`${new Date().getFullYear() + 1}-12-31`}
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Hora</label>
                <input
                  type="time"
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </>
          )}
          {timeError && <p className="text-xs text-red-500">{timeError}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 rounded-2xl border border-gray-200 py-4 font-semibold text-gray-600">
              ← Atrás
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!canDateTime}
              className="flex-1 rounded-2xl bg-slate-900 py-4 font-semibold text-white disabled:opacity-30"
            >
              Continuar →
            </button>
          </div>
        </div>
      )}

      {/* Paso 4 — Datos de contacto + confirmar */}
      {step === 4 && estimate && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-1">Paso 4 de 4</p>
            <h2 className="text-2xl font-bold text-gray-900">Tus datos</h2>
          </div>

          <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 flex justify-between items-center">
            <span className="text-sm text-emerald-700">Total estimado</span>
            <span className="text-xl font-bold text-emerald-700">${estimate.price_ars.toLocaleString('es-AR')}</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Nombre completo</label>
            <input
              type="text"
              placeholder="Juan Pérez"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Teléfono</label>
            <input
              type="tel"
              placeholder="2236000000"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            {form.phone.length >= 8 && !isValidArgPhone(form.phone) && (
              <p className="text-xs text-red-500">Ingresá un teléfono argentino válido (ej: 2236000000)</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Aclaraciones <span className="text-gray-400 font-normal">(opcional)</span></label>
            <textarea
              placeholder="Ej: Soy la del portón azul, necesito silla para bebé..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="flex-1 rounded-2xl border border-gray-200 py-4 font-semibold text-gray-600">
              ← Atrás
            </button>
            <button
              onClick={confirm}
              disabled={!canStep4 || loading}
              className="flex-1 rounded-2xl bg-slate-900 py-4 font-semibold text-white disabled:opacity-30"
            >
              {loading ? 'Enviando...' : 'Confirmar pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right">{value}</span>
    </div>
  )
}
