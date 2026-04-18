import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Panel del conductor',
  description: 'Panel de control para gestionar pedidos de viaje.',
  manifest: '/manifest-dashboard.json',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children
}
