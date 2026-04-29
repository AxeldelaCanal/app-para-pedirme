export default function VerifyEmailPendingPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Verificá tu email</h1>
          <p className="mt-2 text-slate-400 text-sm leading-relaxed">
            Te mandamos un link de verificación a tu casilla.<br />
            Hacé clic en el link para activar tu cuenta.
          </p>
        </div>
        <p className="text-slate-500 text-xs">Si no lo encontrás, revisá la carpeta de spam.</p>
      </div>
    </main>
  )
}
