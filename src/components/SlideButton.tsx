'use client'

import { useState, useRef, useCallback, useLayoutEffect } from 'react'

interface Props {
  label: string
  onConfirm: () => void
  variant?: 'teal' | 'amber' | 'gray'
  reversed?: boolean
  disabled?: boolean
}

const VARIANTS = {
  teal:  { track: 'bg-[#09d3ac]', thumb: 'bg-white', label: 'text-white' },
  amber: { track: 'bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-600', thumb: 'bg-amber-400', label: 'text-amber-800 dark:text-amber-200' },
  gray:  { track: 'bg-gray-200 dark:bg-gray-700', thumb: 'bg-gray-500 dark:bg-gray-400', label: 'text-gray-600 dark:text-gray-300' },
}

const THUMB_SIZE = 44
const CONFIRM_RATIO = 0.72

export default function SlideButton({ label, onConfirm, variant = 'teal', reversed = false, disabled = false }: Props) {
  // `drag` = cuánto se arrastró el thumb desde su posición inicial (0 = sin mover)
  const [drag, setDrag] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [trackWidth, setTrackWidth] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef<number | null>(null)
  const v = VARIANTS[variant]

  useLayoutEffect(() => {
    if (!trackRef.current) return
    setTrackWidth(trackRef.current.offsetWidth)
  }, [])

  const maxDrag = useCallback(() => {
    return (trackWidth || trackRef.current?.offsetWidth || 300) - THUMB_SIZE - 8
  }, [trackWidth])

  function onTouchStart(e: React.TouchEvent) {
    if (disabled || confirmed) return
    startXRef.current = e.touches[0].clientX
  }

  function onTouchMove(e: React.TouchEvent) {
    if (startXRef.current === null) return
    const dx = e.touches[0].clientX - startXRef.current
    // Normal: drag a la derecha (dx > 0). Reversed: drag a la izquierda (dx < 0)
    const raw = reversed ? -dx : dx
    setDrag(Math.max(0, Math.min(raw, maxDrag())))
  }

  function onTouchEnd() {
    if (startXRef.current === null) return
    startXRef.current = null

    if (drag >= maxDrag() * CONFIRM_RATIO) {
      setConfirmed(true)
      setDrag(maxDrag())
      setTimeout(() => {
        onConfirm()
        setDrag(0)
        setConfirmed(false)
      }, 200)
    } else {
      setDrag(0)
    }
  }

  function onClick() {
    if (disabled) return
    onConfirm()
  }

  // Posición del thumb: normal empieza en 0 y va a la derecha; reversed empieza en maxDrag y va a la izquierda
  const thumbX = reversed ? maxDrag() - drag : drag
  const progress = drag / (maxDrag() || 1)
  const isSnapping = drag === 0 && !confirmed

  return (
    <div
      ref={trackRef}
      className={`relative w-full rounded-xl px-1 py-1 flex items-center overflow-hidden select-none ${v.track} ${disabled ? 'opacity-40' : ''}`}
      style={{ minHeight: THUMB_SIZE + 8 }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onClick={onClick}
    >
      {/* Label centrado, desaparece al deslizar */}
      <span
        className={`absolute inset-0 flex items-center justify-center text-sm font-semibold pointer-events-none transition-opacity ${v.label}`}
        style={{ opacity: Math.max(0, 1 - progress * 1.5) }}
      >
        {label}
      </span>

      {/* Thumb */}
      <div
        className={`${v.thumb} rounded-lg flex items-center justify-center shadow-sm shrink-0 z-10`}
        style={{
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          transform: `translateX(${thumbX}px)`,
          transition: isSnapping ? 'transform 0.25s ease' : 'none',
        }}
      >
        <span className="text-lg font-bold">{reversed ? '←' : '→'}</span>
      </div>
    </div>
  )
}
