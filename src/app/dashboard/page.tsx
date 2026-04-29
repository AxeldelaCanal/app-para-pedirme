'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import RideCard from '@/components/RideCard'
import InstallButton from '@/components/InstallButton'
import { supabase } from '@/lib/supabase'
import type { Ride, RideStatus, Settings, Driver } from '@/types'
import { DEFAULT_SETTINGS } from '@/lib/pricing'
import { haversineKm } from '@/lib/scheduling'

const QRCodeSVG = dynamic(() => import('qrcode.react').then(m => m.QRCodeSVG), { ssr: false })

async function svgElementToPngBlob(svgEl: SVGSVGElement): Promise<Blob> {
  const serialized = new XMLSerializer().serializeToString(svgEl)
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('canvas toBlob failed')), 'image/png')
    }
    img.onerror = reject
    img.src = url
  })
}

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
  const [driver, setDriver] = useState<Pick<Driver, 'name' | 'slug' | 'email'> | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' })
  const [passwordError, setPasswordError] = useState('')
  const [passwordOk, setPasswordOk] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' })
  const [emailError, setEmailError] = useState('')
  const [emailOk, setEmailOk] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [loading, setLoading] = useState(true)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const [search, setSearch] = useState('')
  const [sortByProximity, setSortByProximity] = useState(false)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    setDarkMode(localStorage.getItem('darkMode') === 'true')
  }, [])

  function toggleDark() {
    setDarkMode(d => {
      const next = !d
      localStorage.setItem('darkMode', String(next))
      return next
    })
  }

  const prevRidesRef = useRef<Ride[]>([])
  const qrWrapperRef = useRef<HTMLDivElement>(null)

  async function shareQR(url: string) {
    const svgEl = qrWrapperRef.current?.querySelector('svg')
    if (svgEl && navigator.canShare) {
      try {
        const blob = await svgElementToPngBlob(svgEl as SVGSVGElement)
        const file = new File([blob], 'qr-reservas.png', { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: `Reservá tu viaje: ${url}` })
          return
        }
      } catch { /* fallback */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`Reservá tu viaje: ${url}`)}`, '_blank')
  }

  function urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4)
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = window.atob(b64)
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
  }

  const fetchRides = useCallback(async () => {
    const res = await fetch('/api/rides')
    if (!res.ok) return
    const fresh: Ride[] = await res.json()

    if (Notification.permission === 'granted' && prevRidesRef.current.length > 0) {
      fresh.forEach(r => {
        const prev = prevRidesRef.current.find(p => p.id === r.id)

        // Nuevo pedido
        if (!prev) {
          new Notification('Nuevo pedido 🚗', {
            body: `${r.client_name} · ${r.origin.split(',')[0]} → ${r.destination.split(',')[0]}`,
            icon: '/favicon.svg',
          })
          return
        }

        // Cambios propuestos
        if (r.pending_changes && !prev.pending_changes) {
          new Notification('Cliente propuso cambios ✏️', {
            body: `${r.client_name} modificó un viaje aceptado`,
            icon: '/favicon.svg',
          })
        }

        // Cancelación
        if (r.status === 'cancelled' && prev.status !== 'cancelled') {
          new Notification('Viaje cancelado ❌', {
            body: `${r.client_name} canceló su viaje`,
            icon: '/favicon.svg',
          })
        }

        // Volvió a pendiente (editó horario/lugar)
        if (r.status === 'pending' && prev.status === 'accepted') {
          new Notification('Pedido modificado 🕐', {
            body: `${r.client_name} cambió su viaje`,
            icon: '/favicon.svg',
          })
        }
      })
    }

    prevRidesRef.current = fresh
    setRides(fresh)
    setLoading(false)
  }, [])

  async function registerPushSubscription(): Promise<{ ok: boolean; error?: string }> {
    if (!('serviceWorker' in navigator)) return { ok: false, error: 'Tu navegador no soporta Service Workers.' }
    if (!('PushManager' in window)) return { ok: false, error: 'Tu navegador no soporta Push Notifications.' }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      const vapidKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim()
      if (!vapidKey) return { ok: false, error: 'VAPID key no configurada. Contactá al administrador.' }

      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      })

      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[push] /api/push falló:', res.status, err)
        return { ok: false, error: `Error al guardar suscripción: ${err.error ?? res.status}` }
      }
      return { ok: true }
    } catch (err) {
      console.error('[push] Error registrando suscripción:', err)
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: `Error al suscribirse: ${msg}` }
    }
  }

  async function requestNotifications() {
    const permission = await Notification.requestPermission()
    setNotifPermission(permission)
    if (permission === 'granted') {
      const result = await registerPushSubscription()
      if (!result.ok) alert(result.error)
    }
  }

  useEffect(() => {
    fetchRides() // eslint-disable-line react-hooks/set-state-in-effect
    fetch('/api/settings').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setSettings(d)
    })
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => {
      if (d) setDriver({ name: d.name, slug: d.slug, email: d.email })
    })
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
    setIsIOS(ios)
    setIsStandalone(standalone)

    if ('Notification' in window) {
      setNotifPermission(Notification.permission)
      if (Notification.permission === 'granted' && 'serviceWorker' in navigator) {
        // Auto-registrar suscripción push en cada carga para asegurar que esté guardada en DB
        registerPushSubscription()
      }
    }

    const poll = setInterval(fetchRides, 10_000);

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

    return () => { supabase.removeChannel(channel); clearInterval(poll) }
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

  async function changeEmail() {
    setEmailError('')
    setEmailOk(false)
    if (!emailForm.newEmail || !emailForm.currentPassword) return
    setSavingEmail(true)
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: emailForm.currentPassword, newEmail: emailForm.newEmail }),
    })
    setSavingEmail(false)
    if (res.ok) {
      setEmailOk(true)
      setDriver(d => d ? { ...d, email: emailForm.newEmail } : d)
      setEmailForm({ newEmail: '', currentPassword: '' })
    } else {
      const d = await res.json()
      setEmailError(d.error ?? 'Error al cambiar el email')
    }
  }

  async function changePassword() {
    setPasswordError('')
    setPasswordOk(false)
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('Las contraseñas nuevas no coinciden')
      return
    }
    if (passwordForm.next.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    setSavingPassword(true)
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: passwordForm.current, newPassword: passwordForm.next }),
    })
    setSavingPassword(false)
    if (res.ok) {
      setPasswordOk(true)
      setPasswordForm({ current: '', next: '', confirm: '' })
    } else {
      const d = await res.json()
      setPasswordError(d.error ?? 'Error al cambiar la contraseña')
    }
  }

  async function deleteAccount() {
    setDeletingAccount(true)
    const res = await fetch('/api/auth/me', { method: 'DELETE' })
    if (res.ok) {
      router.push('/')
    } else {
      setDeletingAccount(false)
      setConfirmDeleteAccount(false)
    }
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

  function groupByDate(rides: Ride[]): { label: string; rides: Ride[] }[] {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowStart = new Date(todayStart.getTime() + 86_400_000)
    const weekEnd = new Date(todayStart.getTime() + 7 * 86_400_000)

    const groups = [
      { label: 'Hoy', rides: rides.filter(r => { const d = new Date(r.scheduled_at); return d >= todayStart && d < tomorrowStart }) },
      { label: 'Mañana', rides: rides.filter(r => { const d = new Date(r.scheduled_at); return d >= tomorrowStart && d < new Date(tomorrowStart.getTime() + 86_400_000) }) },
      { label: 'Esta semana', rides: rides.filter(r => { const d = new Date(r.scheduled_at); return d >= new Date(tomorrowStart.getTime() + 86_400_000) && d < weekEnd }) },
      { label: 'Más adelante', rides: rides.filter(r => new Date(r.scheduled_at) >= weekEnd) },
      { label: 'Anteriores', rides: rides.filter(r => new Date(r.scheduled_at) < todayStart) },
    ]
    return groups.filter(g => g.rides.length > 0)
  }

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
    <div className={darkMode ? 'dark' : ''}>
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 safe-bottom">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-10 safe-top">
        <div className="flex items-center gap-2 min-w-0">
          {driver?.slug && (
            <a
              href={`/${driver.slug}`}
              className="rounded-lg border border-gray-200 dark:border-gray-700 w-9 h-9 flex items-center justify-center text-gray-500 dark:text-gray-400 shrink-0"
              aria-label="Volver a la app"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </a>
          )}
          <h1 className="font-bold text-gray-900 dark:text-white truncate">Mis pedidos</h1>
          {pendingCount > 0 && (
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white shrink-0">
              {pendingCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <InstallButton className="rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 inline-flex items-center gap-1.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800" />
          <button onClick={toggleDark}
            className="rounded-lg border border-gray-200 dark:border-gray-700 w-9 h-9 flex items-center justify-center text-gray-700 dark:text-gray-300">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button
            onClick={() => { setShowFilters(s => !s); setShowMenu(false) }}
            className={`rounded-lg border w-9 h-9 flex items-center justify-center text-base font-bold transition-colors ${
              hasActiveFilters ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
            }`}>
            {hasActiveFilters ? '≡·' : '≡'}
          </button>
          <button
            onClick={() => setShowMenu(s => !s)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 w-9 h-9 flex items-center justify-center text-gray-700 dark:text-gray-300">
            ⚙
          </button>
        </div>
      </header>

      {/* Menú desplegable */}
      {showMenu && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex flex-wrap gap-2">
          <button onClick={() => { setShowQR(s => !s); setShowMenu(false) }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            QR
          </button>
          {notifPermission === 'granted' && (
            <button onClick={async () => {
              setShowMenu(false)
              // Intentar registrar primero por si la suscripción no está en DB
              const reg = await registerPushSubscription()
              if (!reg.ok) {
                alert(`No se pudo registrar el dispositivo:\n\n${reg.error}`)
                return
              }
              const res = await fetch('/api/push/test', { method: 'POST' })
              const d = await res.json()
              if (!res.ok) alert(`Error al enviar notificación:\n\n${d.error}`)
              else alert('✅ Notificación enviada. ¿La recibiste?')
            }}
              className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              🔔 Probar
            </button>
          )}
          <button onClick={() => { setShowSettings(s => !s); setShowMenu(false) }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Tarifas
          </button>
          <button onClick={() => { setShowAccount(s => !s); setShowMenu(false) }}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Cuenta
          </button>
          <button onClick={logout}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400">
            Salir
          </button>
        </div>
      )}

      {/* QR Panel */}
      {showQR && driver && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-5 flex flex-col items-center gap-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Tu link de reservas</p>
          <QRCodeSVG
            value={`${typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')}/${driver.slug}`}
            size={180}
            bgColor={darkMode ? '#111827' : '#ffffff'}
            fgColor={darkMode ? '#ffffff' : '#0f172a'}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center break-all">
            {typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')}/{driver.slug}
          </p>
          <button
            onClick={() => navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')}/${driver.slug}`)}
            className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Copiar link
          </button>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-4">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Configurar tarifas (ARS)</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['base_fare', 'price_per_km', 'price_per_min', 'booking_fee'] as const).map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  {key === 'base_fare' ? 'Tarifa base' : key === 'price_per_km' ? 'Por km' : key === 'price_per_min' ? 'Por minuto' : 'Cargo reserva'}
                </label>
                <input type="number" value={settings[key]}
                  onChange={e => setSettings(s => ({ ...s, [key]: Number(e.target.value) }))}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1 mt-3">
            <label className="text-xs text-gray-500 dark:text-gray-400">Tu teléfono (para cancelaciones)</label>
            <input type="tel" placeholder="2235304242" value={settings.driver_phone ?? ''}
              onChange={e => setSettings(s => ({ ...s, driver_phone: e.target.value }))}
              className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
          </div>
          <button onClick={saveSettings} disabled={savingSettings}
            className="mt-3 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
            {savingSettings ? 'Guardando...' : 'Guardar tarifas'}
          </button>
        </div>
      )}

      {/* Account Panel */}
      {showAccount && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-4 flex flex-col gap-5">
          {/* Email actual */}
          {driver?.email && (
            <div className="flex flex-col gap-1">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Email actual</p>
              <p className="text-sm text-gray-900 dark:text-white font-medium">{driver.email}</p>
            </div>
          )}

          {/* Cambiar email */}
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Cambiar email</h2>
            <input type="email" placeholder="Nuevo email"
              value={emailForm.newEmail}
              onChange={e => setEmailForm(f => ({ ...f, newEmail: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <input type="password" placeholder="Contraseña actual (para confirmar)"
              value={emailForm.currentPassword}
              onChange={e => setEmailForm(f => ({ ...f, currentPassword: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            {emailError && <p className="text-xs text-red-500">{emailError}</p>}
            {emailOk && <p className="text-xs text-emerald-600 font-medium">Email actualizado correctamente</p>}
            <button onClick={changeEmail} disabled={savingEmail || !emailForm.newEmail || !emailForm.currentPassword}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              {savingEmail ? 'Guardando...' : 'Actualizar email'}
            </button>
          </div>

          {/* Cambiar contraseña */}
          <div className="flex flex-col gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Cambiar contraseña</h2>
            {(['current', 'next', 'confirm'] as const).map((field) => (
              <input key={field} type="password"
                placeholder={field === 'current' ? 'Contraseña actual' : field === 'next' ? 'Nueva contraseña' : 'Repetir nueva contraseña'}
                value={passwordForm[field]}
                onChange={e => setPasswordForm(f => ({ ...f, [field]: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
            ))}
            {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
            {passwordOk && <p className="text-xs text-emerald-600 font-medium">Contraseña actualizada correctamente</p>}
            <button onClick={changePassword} disabled={savingPassword || !passwordForm.current || !passwordForm.next || !passwordForm.confirm}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              {savingPassword ? 'Guardando...' : 'Actualizar contraseña'}
            </button>
          </div>

          {/* Zona de peligro */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <h2 className="font-semibold text-red-600 text-sm mb-2">Zona de peligro</h2>
            {!confirmDeleteAccount ? (
              <button onClick={() => setConfirmDeleteAccount(true)}
                className="w-full rounded-xl border border-red-200 dark:border-red-900 py-2.5 text-sm font-semibold text-red-600">
                Eliminar mi cuenta
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-red-500">Esto elimina tu cuenta y todos tus viajes. No tiene vuelta atrás.</p>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDeleteAccount(false)}
                    className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300">
                    Cancelar
                  </button>
                  <button onClick={deleteAccount} disabled={deletingAccount}
                    className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
                    {deletingAccount ? 'Eliminando...' : 'Sí, eliminar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-4 flex flex-col gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Período</p>
            <div className="flex gap-2 flex-wrap">
              {(['today', 'week', 'month', 'all'] as const).map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    period === p ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                  {p === 'today' ? 'Hoy' : p === 'week' ? 'Esta semana' : p === 'month' ? 'Este mes' : 'Todo'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Ordenar por</p>
            <button onClick={() => setSortByProximity(s => !s)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                sortByProximity ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
              Proximidad
            </button>
          </div>
        </div>
      )}

      {/* Banner de notificaciones */}
      {notifPermission !== null && notifPermission !== 'granted' && (
        <div className={`mx-4 mt-3 rounded-2xl px-4 py-3 flex items-start gap-3 ${
          notifPermission === 'denied'
            ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900'
            : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900'
        }`}>
          <span className="text-xl shrink-0 mt-0.5">
            {notifPermission === 'denied' ? '🔕' : '🔔'}
          </span>
          <div className="flex-1 min-w-0">
            {notifPermission === 'denied' ? (
              <>
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">Notificaciones bloqueadas</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  {isIOS
                    ? 'Ir a Configuración del iPhone → Safari → Notificaciones para habilitarlas.'
                    : 'Habilitarlas desde la configuración del navegador (ícono 🔒 en la barra de dirección).'}
                </p>
              </>
            ) : isIOS && !isStandalone ? (
              <>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Instalá la app para activar notificaciones</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  En iPhone solo funcionan desde la app instalada.<br />
                  Safari → <strong>Compartir</strong> → <strong>Agregar a inicio</strong> → abrí la app desde ahí.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Activá las notificaciones</p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">Para recibir alertas de nuevos pedidos aunque tengas el panel cerrado.</p>
                <button
                  onClick={requestNotifications}
                  className="mt-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Activar ahora
                </button>
              </>
            )}
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
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 text-center shadow-sm">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{periodLabel}</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm">${earnedTotal.toLocaleString('es-AR')}</p>
                {projectedTotal > 0 && <p className="text-xs text-emerald-500">+${projectedTotal.toLocaleString('es-AR')}</p>}
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 text-center shadow-sm">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Completados</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm">{done.length}</p>
                {confirmed.length > 0 && <p className="text-xs text-emerald-500">+{confirmed.length} conf.</p>}
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-3 text-center shadow-sm">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Promedio</p>
                <p className="font-bold text-gray-900 dark:text-white text-sm">${avg.toLocaleString('es-AR')}</p>
              </div>
            </div>
            {lostTotal > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-2xl px-4 py-2.5 flex justify-between items-center">
                <p className="text-xs text-red-400">Perdido por cancelaciones ({cancelled.length})</p>
                <p className="text-sm font-bold text-red-400">-${lostTotal.toLocaleString('es-AR')}</p>
              </div>
            )}
          </div>
        )
      })()}

      {/* Status filters */}
      <div className="px-4 pt-4 flex gap-2 overflow-x-auto pb-1">
        {(['pending', 'accepted', 'completed', 'all', 'rejected', 'cancelled'] as const).map(f => {
          const label = f === 'pending' ? 'Pendientes' : f === 'accepted' ? 'En curso' : f === 'completed' ? 'Completados' : f === 'cancelled' ? 'Cancelados' : f === 'rejected' ? 'Rechazados' : 'Todos'
          const pendingChangesCount = acceptedRides.filter(r => r.pending_changes).length
          const badgeCount = f === 'accepted' ? acceptedRides.length : f === 'pending' ? pendingCount : 0
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
              {label}
              {badgeCount > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${filter === f ? 'bg-white text-emerald-600' : 'bg-emerald-500 text-white'}`}>
                  {badgeCount}
                </span>
              )}
              {f === 'accepted' && pendingChangesCount > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-xs font-bold bg-amber-400 text-white">{pendingChangesCount} ✏️</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="px-4 pt-3">
        <input type="text" placeholder="Buscar por nombre..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 placeholder:text-gray-400 dark:placeholder:text-gray-500"
        />
      </div>

      {/* List con agrupación por fecha */}
      <div className="px-4 py-4 flex flex-col gap-3">
        {loading ? (
          <p className="text-center text-gray-400 py-10 text-sm">Cargando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-gray-500 py-10 text-sm">No hay pedidos aquí</p>
        ) : (
          groupByDate(filtered).map(group => (
            <div key={group.label} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                <span className="text-xs text-gray-400 dark:text-gray-500">{group.rides.length}</span>
              </div>
              {group.rides.map(ride => (
                <RideCard
                  key={ride.id}
                  ride={ride}
                  acceptedRides={acceptedRides}
                  onStatusChange={handleStatusChange}
                  onRideUpdate={handleRideUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ))
        )}
      </div>
      {/* Botón flotante QR */}
      {driver && (
        <>
          <button
            onClick={() => setShowQR(s => !s)}
            className="fixed bottom-6 right-4 z-40 w-14 h-14 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center text-white"
            aria-label="Ver QR"
          >
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
            </svg>
          </button>

          {showQR && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-6" onClick={() => setShowQR(false)}>
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 w-full max-w-sm flex flex-col items-center gap-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Tu link de reservas</p>
                <div ref={qrWrapperRef}>
                  <QRCodeSVG
                    value={`${typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')}/${driver.slug}`}
                    size={200}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center break-all">
                  {typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')}/{driver.slug}
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${driver.slug}`)}
                    className="flex-1 rounded-2xl border border-gray-200 dark:border-gray-700 py-3 text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Copiar link
                  </button>
                  <button
                    onClick={() => shareQR(`${window.location.origin}/${driver.slug}`)}
                    className="flex-1 rounded-2xl bg-[#25D366] py-3 text-sm font-semibold text-white"
                  >
                    Compartir
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
    </div>
  )
}
