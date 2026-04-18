'use client'

import { useEffect } from 'react'

export default function PWAFix() {
  useEffect(() => {
    const THRESHOLD_MS = 30_000

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        localStorage.setItem('pwa_hidden_at', String(Date.now()))
      } else {
        const hiddenAt = localStorage.getItem('pwa_hidden_at')
        if (hiddenAt && Date.now() - Number(hiddenAt) > THRESHOLD_MS) {
          localStorage.removeItem('pwa_hidden_at')
          window.location.reload()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return null
}
