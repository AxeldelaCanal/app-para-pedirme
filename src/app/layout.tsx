import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Pedí tu viaje',
    template: '%s · Pedí tu viaje',
  },
  description: 'Reservá tu viaje con precio fijo. Confirmación directa por WhatsApp.',
  icons: {
    icon: '/favicon.svg',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geist.className} bg-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
