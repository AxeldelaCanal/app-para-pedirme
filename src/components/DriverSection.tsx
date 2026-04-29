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

type View = 'login' | 'register'

export default function DriverSection() {
  const router = useRouter()
  const [view, setView] = useState<View>('login')

  const [loginForm, setLoginForm] = useState({ email: '', password: '', remember: true })
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const [regForm, setRegForm] = useState({ name: '', slug: '', email: '', password: '', phone: '' })
  const [slugManual, setSlugManual] = useState(false)
  const [regError, setRegError] = useState('')
  const [regLoading, setRegLoading] = useState(false)
  const [regDone, setRegDone] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginForm.email, password: loginForm.password, remember: loginForm.remember }),
    })
    if (res.ok) {
      router.push('/dashboard')
    } else {
      const d = await res.json()
      setLoginError(d.error ?? 'Email o contraseña incorrectos')
      setLoginLoading(false)
    }
  }

  function handleNameChange(value: string) {
    setRegForm(f => ({ ...f, name: value, slug: slugManual ? f.slug : toSlug(value) }))
  }

  function handleSlugChange(value: string) {
    setSlugManual(true)
    setRegForm(f => ({ ...f, slug: toSlug(value) || value.toLowerCase() }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setRegLoading(true)
    setRegError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regForm),
    })
    const data = await res.json()
    if (!res.ok) {
      setRegError(data.error ?? 'Error al registrarse')
      setRegLoading(false)
      return
    }
    setRegDone(true)
    setRegLoading(false)
  }

  const slugValid = /^[a-z0-9-]+$/.test(regForm.slug)
  const canRegister = regForm.name && slugValid && regForm.email && regForm.password.length >= 6

  const inputCls = 'w-full rounded-xl bg-slate-700/50 border border-slate-600/50 px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30'

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-slate-800/80 border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-700/50">
          <h2 className="text-white font-bold text-lg">Área de choferes</h2>
          <p className="text-slate-400 text-sm mt-0.5">Accedé o creá tu cuenta para gestionar pedidos</p>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-slate-700/50">
          {(['login', 'register'] as const).map(v => (
            <button
              key={v}
              onClick={() => { setView(v); setLoginError(''); setRegError('') }}
              className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                view === v
                  ? 'text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {v === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {view === 'login' ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input
                type="email"
                placeholder="Email"
                value={loginForm.email}
                onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                className={inputCls}
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Contraseña"
                value={loginForm.password}
                onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                className={inputCls}
                autoComplete="current-password"
              />
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={loginForm.remember}
                  onChange={e => setLoginForm(f => ({ ...f, remember: e.target.checked }))}
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                />
                <span className="text-slate-300 text-sm">Mantener sesión iniciada</span>
              </label>
              {loginError && <p className="text-xs text-red-400 text-center">{loginError}</p>}
              <button
                type="submit"
                disabled={loginLoading || !loginForm.email || !loginForm.password}
                className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
              >
                {loginLoading ? 'Ingresando...' : 'Ingresar al panel'}
              </button>
              <p className="text-center text-xs text-slate-400">
                <Link href="/dashboard/forgot-password" className="text-emerald-400 hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </p>
            </form>
          ) : regDone ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">¡Cuenta creada!</p>
                <p className="text-slate-400 text-sm mt-1 leading-relaxed">
                  Te mandamos un link de verificación a tu email.<br />
                  Hacé clic en el link para activar tu cuenta.
                </p>
              </div>
              <p className="text-slate-500 text-xs">Revisá también la carpeta de spam.</p>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Tu nombre completo"
                value={regForm.name}
                onChange={e => handleNameChange(e.target.value)}
                className={inputCls}
              />
              <div className="flex flex-col gap-1">
                <input
                  type="text"
                  placeholder="Tu link (ej: juan-perez)"
                  value={regForm.slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  className={inputCls}
                />
                {regForm.slug && (
                  <p className={`text-xs px-1 ${slugValid ? 'text-emerald-400' : 'text-red-400'}`}>
                    {slugValid ? `${APP_URL}/${regForm.slug}` : 'Solo letras minúsculas, números y guiones'}
                  </p>
                )}
              </div>
              <input
                type="email"
                placeholder="Email"
                value={regForm.email}
                onChange={e => setRegForm(f => ({ ...f, email: e.target.value }))}
                className={inputCls}
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Contraseña (mín. 6 caracteres)"
                value={regForm.password}
                onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))}
                className={inputCls}
                autoComplete="new-password"
              />
              <input
                type="tel"
                placeholder="Teléfono (opcional)"
                value={regForm.phone}
                onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))}
                className={inputCls}
              />
              {regError && <p className="text-xs text-red-400 text-center">{regError}</p>}
              <button
                type="submit"
                disabled={!canRegister || regLoading}
                className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-semibold text-white disabled:opacity-40 transition-opacity mt-1"
              >
                {regLoading ? 'Creando cuenta...' : 'Crear cuenta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
