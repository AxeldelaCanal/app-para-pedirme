'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function VerifyEmailTokenPage() {
  const router = useRouter()
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async res => {
      if (res.ok) {
        setStatus('ok')
        setTimeout(() => router.push('/dashboard'), 2000)
      } else {
        const d = await res.json()
        setErrorMsg(d.error ?? 'Error al verificar')
        setStatus('error')
      }
    })
  }, [token, router])

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-6">
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <p className="text-slate-400 text-sm">Verificando tu email...</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Email verificado</h1>
              <p className="mt-2 text-slate-400 text-sm">Redirigiendo al panel...</p>
            </div>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Link inválido</h1>
              <p className="mt-2 text-slate-400 text-sm">{errorMsg}</p>
            </div>
            <Link href="/registro" className="text-emerald-400 text-sm font-medium">
              Volver a registrarse
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
