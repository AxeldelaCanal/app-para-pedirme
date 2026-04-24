'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    setSent(true)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Restablecer contraseña</h1>
          <p className="mt-1 text-sm text-gray-500">
            {sent ? 'Revisá tu correo' : 'Ingresá tu email y te enviamos un link'}
          </p>
        </div>

        {sent ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-center text-gray-600">
              Si el email está registrado, vas a recibir un link para restablecer tu contraseña. El link es válido por 1 hora.
            </p>
            <Link
              href="/dashboard/login"
              className="w-full rounded-xl border border-gray-200 py-3.5 text-sm font-semibold text-gray-700 text-center"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-xl bg-emerald-500 py-3.5 font-semibold text-white disabled:opacity-40"
            >
              {loading ? 'Enviando...' : 'Enviar link'}
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
