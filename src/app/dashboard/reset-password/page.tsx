import Link from 'next/link'

export default function ResetPasswordIndex() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-5 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Link inválido</h1>
        <p className="text-sm text-gray-500">
          Este link no es válido o ya fue usado. Pedí uno nuevo.
        </p>
        <Link
          href="/dashboard/forgot-password"
          className="w-full rounded-xl bg-emerald-500 py-3.5 font-semibold text-white text-center"
        >
          Pedir nuevo link
        </Link>
      </div>
    </main>
  )
}
