'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import RideCard from '@/components/RideCard'
import { supabase } from '@/lib/supabase'
import type { Ride, RideStatus, Settings } from '@/types'
import { DEFAULT_SETTINGS } from '@/lib/pricing'
import { haversineKm } from '@/lib/scheduling'

type Filter = 'all' | RideStatus
type Period = 'today' | 'week' | 'month' | 'all'

function periodRange(period: Period): { start: Date; end: Date } | null {
  const now = new Date()
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    return { start, end }
  }
  if (period === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    return { start, end }
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return { start, end }
  }
  return null
}

export default function Dashboard() {
  const router = useRouter()
  const [rides, setRides] = useState<Ride[]>([])
  const [filter, setFilter] = useState<Filter>('pending')
  const [period, setPeriod] = useState<Period>('all')
  const [settings, setSettings] = useState<Omit<Settings, 'id' | 'updated_at'>>(DEFAULT_SETTINGS)
  const [showSettings, setShowSettings] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null)
  const [search, setSearch] = useState('')
  const [sortByProximity, setSortByProximity] = useState(false)

  const fetchRides = useCallback(async () => {
    const res = await fetch('/api/rides')
    if (!res.ok) return
    setRides(await res.json())
    setLoading(false)
  }, [])

  async function requestNotifications() {
    const permission = await Notification.requestPermission()
    setNotifPermission(permission)
  }

  useEffect(() => {
    fetchRides() // eslint-disable-line react-hooks/set-state-in-effect
    fetch('/api/settings').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setSettings(d)
    })
    if ('Notification' in window) {
      setNotifPermission(Notification.permission)
    }

    const channel = supabase
      .channel('rides-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'rides' },
        (payload) => {
          const newRide = payload.new as Ride
          setRides(prev => {
            if (prev.find(r => r.id === newRide.id)) return prev
            return [newRide, ...prev]
          })
          if (Notification.permission === 'granted') {
            const dests = newRide.destinations?.length ? newRide.destinations : [{ address: newRide.destination }]
            const lastDest = dests[dests.length - 1].address
            new Notification('Nuevo pedido 🚗', {
              body: `${newRide.client_name} · ${newRide.origin.split(',')[0]} → ${lastDest.split(',')[0]}`,
              icon: '/favicon.ico',
            })
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rides' },
        async (payload) => {
          const partial = payload.new as Ride
          // Re-fetchear el ride completo para garantizar que JSONB (pending_changes, destinations) estén presentes
          const res = await fetch(`/api/rides/${partial.id}`)
          const updated: Ride = res.ok ? await res.json() : partial
          setRides(prev => prev.map(r => r.id === updated.id ? updated : r))
          if (Notification.permission === 'granted' && updated.status === 'cancelled') {
            new Notification('Viaje cancelado ❌', {
              body: `${updated.client_name} canceló su viaje`,
              icon: '/favicon.ico',
            })
          }
          if (Notification.permission === 'granted' && updated.status === 'pending') {
            new Notification('Pedido modificado 🕐', {
              body: `${updated.client_name} cambió su viaje`,
              icon: '/favicon.ico',
            })
          }
          if (Notification.permission === 'granted' && updated.pending_changes) {
            new Notification('Cliente propuso cambios ✏️', {
              body: `${updated.client_name} modificó un viaje aceptado`,
              icon: '/favicon.ico',
            })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchRides])

  function handleStatusChange(id: string, status: RideStatus) {
    setRides(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    // Al aceptar un viaje, ir directo al tab "En curso"
    if (status === 'accepted') setFilter('accepted')
  }

  function handleRideUpdate(id: string, updates: Partial<Ride>) {
    setRides(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r))
  }

  function handleDelete(id: string) {
    setRides(prev => prev.filter(r => r.id !== id))
  }

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/dashboard/login')
  }

  async function saveSettings() {
    setSavingSettings(true)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSavingSettings(false)
    setShowSettings(false)
  }

  const STATUS_ORDER: Record<RideStatus, number> = { pending: 0, accepted: 1, completed: 2, cancelled: 3, rejected: 4 }

  const range = periodRange(period)
  const byPeriod = range
    ? rides.filter(r => { const d = new Date(r.scheduled_at); return d >= range.start && d < range.end })
    : rides

  const sorted = (() => {
    const base = [...byPeriod].sort((a, b) => {
      const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      if (sd !== 0) return sd
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    })

    if (!sortByProximity) return base

    const lastAccepted = [...rides]
      .filter(r => r.status === 'accepted')
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0]

    if (!lastAccepted) return base

    const lastDests = lastAccepted.destinations?.length
      ? lastAccepted.destinations
      : [{ address: lastAccepted.destination, lat: lastAccepted.destination_lat, lng: lastAccepted.destination_lng }]
    const lastDest = lastDests[lastDests.length - 1]

    return base.sort((a, b) => {
      // Solo reordena pendientes; el resto mantiene su posición relativa
      if (a.status !== 'pending' || b.status !== 'pending') return 0
      const aOrigin = { address: a.origin, lat: a.origin_lat, lng: a.origin_lng }
      const bOrigin = { address: b.origin, lat: b.origin_lat, lng: b.origin_lng }
      return haversineKm(lastDest, aOrigin) - haversineKm(lastDest, bOrigin)
    })
  })()

  const byStatus = filter === 'all' ? sorted : sorted.filter(r => r.status === filter)
  const filtered = search.trim()
    ? byStatus.filter(r => r.client_name.toLowerCase().includes(search.toLowerCase()))
    : byStatus

  const acceptedRides = rides.filter(r => r.status === 'accepted')
  const pendingCount = rides.filter(r => r.status === 'pending').length
  const hasActiveFilters = period !== 'all' || sortByProximity

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-gray-900">Mis pedidos</h1>
          {pendingCount > 0 && (
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
              {pendingCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {notifPermission !== null && notifPermission !== 'granted' && (
            <button
              onClick={requestNotifications}
              className="rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-700"
            >
              Activar alertas
            </button>
          )}
          <button
            onClick={() => setShowFilters(s => !s)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              hasActiveFilters
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                : 'border-gray-200 text-gray-700'
            }`}
          >
            Filtros{hasActiveFilters ? ' ·' : ''}
          </button>
          <button
            onClick={() => setShowSettings(s => !s)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700"
          >
            Tarifas
          </button>
          <button
            onClick={logout}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700"
          >
            Salir
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white border-b border-gray-100 px-4 py-4">
          <h2 className="font-semibold text-gray-900 mb-3 text-sm">Configurar tarifas (ARS)</h2>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['base_fare', 'Tarifa base'],
                ['price_per_km', 'Por km'],
                ['price_per_min', 'Por minuto'],
                ['booking_fee', 'Cargo reserva'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-gray-500">{label}</label>
                <input
                  type="number"
                  value={settings[key]}
                  onChange={e => setSettings(s => ({ ...s, [key]: Number(e.target.value) }))}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-xs text-gray-500">Tu teléfono (para cancelaciones)</label>
            <input
              type="tel"
              placeholder="2235304242"
              value={settings.driver_phone ?? ''}
              onChange={e => setSettings(s => ({ ...s, driver_phone: e.target.value }))}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {savingSettings ? 'Guardando...' : 'Guardar tarifas'}
          </button>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-100 px-4 py-4 flex flex-col gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">Período</p>
            <div className="flex gap-2 flex-wrap">
              {([
                ['today', 'Hoy'],
                ['week', 'Esta semana'],
                ['month', 'Este mes'],
                ['all', 'Todo'],
              ] as const).map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    period === p
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-gray-200 text-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-2 font-medium">Ordenar por</p>
            <button
              onClick={() => setSortByProximity(s => !s)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                sortByProximity
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-700'
              }`}
            >
              Proximidad
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      {!loading && (() => {
        const done = byPeriod.filter(r => r.status === 'completed')
        const confirmed = byPeriod.filter(r => r.status === 'accepted')
        const cancelled = byPeriod.filter(r => r.status === 'cancelled')
        const earnedTotal = done.reduce((s, r) => s + r.price_ars, 0)
        const projectedTotal = confirmed.reduce((s, r) => s + r.price_ars, 0)
        const lostTotal = cancelled.reduce((s, r) => s + r.price_ars, 0)
        const allCount = done.length + confirmed.length
        const avg = allCount ? Math.round((earnedTotal + projectedTotal) / allCount) : 0
        const periodLabel = period === 'today' ? 'Hoy' : period === 'week' ? 'Semana' : period === 'month' ? 'Mes' : 'Total'
        return (
          <div className="mx-4 mt-3 flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                <p className="text-xs text-gray-400 mb-1">{periodLabel}</p>
                <p className="font-bold text-gray-900 text-sm">${earnedTotal.toLocaleString('es-AR')}</p>
                {projectedTotal > 0 && (
                  <p className="text-xs text-emerald-500">+${projectedTotal.toLocaleString('es-AR')}</p>
                )}
              </div>
              <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Completados</p>
                <p className="font-bold text-gray-900 text-sm">{done.length}</p>
                {confirmed.length > 0 && (
                  <p className="text-xs text-emerald-500">+{confirmed.length} conf.</p>
                )}
              </div>
              <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
                <p className="text-xs text-gray-400 mb-1">Promedio</p>
                <p className="font-bold text-gray-900 text-sm">${avg.toLocaleString('es-AR')}</p>
              </div>
            </div>
            {lostTotal > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-2.5 flex justify-between items-center">
                <p className="text-xs text-red-400">Perdido por cancelaciones ({cancelled.length})</p>
                <p className="text-sm font-bold text-red-400">-${lostTotal.toLocaleString('es-AR')}</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* Status filters */}
      <div className="px-4 pt-4 flex gap-2 overflow-x-auto pb-1">
        {(['pending', 'accepted', 'completed', 'cancelled', 'rejected', 'all'] as const).map(f => {
          const label = f === 'pending' ? 'Pendientes'
            : f === 'accepted' ? 'En curso'
            : f === 'completed' ? 'Completados'
            : f === 'cancelled' ? 'Cancelados'
            : f === 'rejected' ? 'Rechazados'
            : 'Todos'
          const activeCount = f === 'accepted' ? acceptedRides.length : 0
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white border border-gray-200 text-gray-700'
              }`}
            >
              {label}
              {activeCount > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  filter === f ? 'bg-white text-emerald-600' : 'bg-emerald-500 text-white'
                }`}>
                  {activeCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="px-4 pt-3">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      {/* List */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-center text-gray-400 py-10 text-sm">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-10 text-sm">No hay pedidos aquí</p>
        ) : (
          filtered.map(ride => (
            <RideCard
              key={ride.id}
              ride={ride}
              acceptedRides={acceptedRides}
              onStatusChange={handleStatusChange}
              onRideUpdate={handleRideUpdate}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </main>
  )
}
