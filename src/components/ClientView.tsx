'use client'

import { useState } from 'react'
import BookingForm from './BookingForm'
import DriverSection from './DriverSection'

type Tab = 'reservar' | 'chofer'

export default function ClientView({ driverSlug }: { driverSlug: string }) {
  const [tab, setTab] = useState<Tab>('reservar')

  return (
    <>
      <div className="relative -mt-6 px-4 pb-32">
        {tab === 'reservar' ? (
          <div className="max-w-md mx-auto bg-white rounded-3xl shadow-2xl p-6 overflow-hidden">
            <BookingForm driverSlug={driverSlug} />
          </div>
        ) : (
          <DriverSection />
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700/50 safe-bottom">
        <div className="flex max-w-md mx-auto">
          <button
            onClick={() => setTab('reservar')}
            className={`flex-1 flex flex-col items-center gap-1 py-3.5 text-xs font-medium transition-colors ${
              tab === 'reservar' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={tab === 'reservar' ? 2.5 : 1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            Reservar
          </button>

          <div className="w-px bg-slate-700/50 my-2" />

          <button
            onClick={() => setTab('chofer')}
            className={`flex-1 flex flex-col items-center gap-1 py-3.5 text-xs font-medium transition-colors ${
              tab === 'chofer' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={tab === 'chofer' ? 2.5 : 1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Soy chofer
          </button>
        </div>
      </nav>
    </>
  )
}
