import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BookingForm from '@/components/BookingForm'
import InstallButton from '@/components/InstallButton'

export default async function DriverPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const { data: driver } = await supabase
    .from('drivers')
    .select('name')
    .eq('slug', slug)
    .single()

  if (!driver) notFound()

  return (
    <main className="min-h-screen bg-slate-950 safe-bottom">
      <div className="relative overflow-hidden px-6 pt-14 pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent" />
        <div className="relative max-w-md mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-xs font-medium">Servicio activo</span>
            </div>
            <InstallButton />
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Reservá con<br />
            <span className="text-emerald-400">{driver.name}</span>
          </h1>
          <p className="mt-3 text-slate-400 text-sm leading-relaxed">
            Precio fijo, sin sorpresas.<br />Confirmación directa por WhatsApp.
          </p>
        </div>
      </div>

      <div className="relative -mt-6 px-4 pb-10">
        <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-6">
          <BookingForm driverSlug={slug} />
        </div>
      </div>
    </main>
  )
}
