'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function RegistroPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', slug: '', email: '', password: '', phone: '' })
  const [slugManual, setSlugManual] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleNameChange(value: string) {
    setForm(f => ({
      ...f,
      name: value,
      slug: slugManual ? f.slug : toSlug(value),
    }))
  }

  function handleSlugChange(value: string) {
    setSlugManual(true)
    setForm(f => ({ ...f, slug: toSlug(value) || value.toLowerCase() }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Error al registrarse')
      setLoading(false)
      return
    }

    router.push('/dashboard/verify-email')
  }

  const slugValid = /^[a-z0-9-]+$/.test(form.slug)
  const canSubmit = form.name && slugValid && form.email && form.password.length >= 6

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Crear cuenta</h1>
          <p className="mt-2 text-slate-400 text-sm">Tu propio link de reservas en minutos</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-gray-900">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tu nombre</label>
            <input
              type="text"
              placeholder="Juan Pérez"
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Tu link de reservas</label>
            <input
              type="text"
              placeholder="juan-perez"
              value={form.slug}
              onChange={e => handleSlugChange(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            {form.slug && (
              <p className={`text-xs mt-0.5 ${slugValid ? 'text-emerald-600' : 'text-red-500'}`}>
                {slugValid
                  ? `${APP_URL}/${form.slug}`
                  : 'Solo letras minúsculas, números y guiones'}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              placeholder="juan@email.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Contraseña</label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              type="tel"
              placeholder="2235304242"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full rounded-xl bg-emerald-500 py-3.5 font-semibold text-white disabled:opacity-40 mt-1"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <p className="text-center text-sm text-gray-500">
            ¿Ya tenés cuenta?{' '}
            <Link href="/dashboard/login" className="text-emerald-600 font-medium">
              Ingresá
            </Link>
          </p>
        </form>
      </div>
    </main>
  )
}
