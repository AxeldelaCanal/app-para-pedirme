'use client'

import { useEffect } from 'react'

export default function PWAFix() {
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && document.body.childElementCount === 0) {
        window.location.reload()
      }
    }

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pageshow', handlePageShow)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [])

  return null
}
