'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const { token } = useParams<{ token: string }>()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/reset', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: password }),
    })
    setLoading(false)
    if (res.ok) {
      setDone(true)
      setTimeout(() => router.push('/dashboard/login'), 2000)
    } else {
      const d = await res.json()
      setError(d.error ?? 'Error al restablecer la contraseña')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-gray-500">
            {done ? '¡Listo! Redirigiendo...' : 'Elegí una contraseña nueva'}
          </p>
        </div>

        {done ? (
          <p className="text-sm text-center text-emerald-600 font-medium">
            Contraseña actualizada correctamente
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              autoFocus
            />
            <input
              type="password"
              placeholder="Repetir contraseña"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full rounded-xl bg-emerald-500 py-3.5 font-semibold text-white disabled:opacity-40"
            >
              {loading ? 'Guardando...' : 'Guardar contraseña'}
            </button>
            <p className="text-center text-sm text-gray-500">
              <Link href="/dashboard/login" className="text-emerald-600 font-medium">
                Volver al inicio de sesión
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
