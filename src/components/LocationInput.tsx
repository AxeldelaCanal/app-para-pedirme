'use client'

import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import type { Location } from '@/types'

interface Props {
  label: string
  placeholder: string
  value: string
  onChange: (loc: Location) => void
  showCurrentLocation?: boolean
}

let initialized = false

function initMaps() {
  if (!initialized) {
    setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!, v: 'weekly' })
    initialized = true
  }
}

export default function LocationInput({ label, placeholder, value, onChange, showCurrentLocation }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    let autocomplete: google.maps.places.Autocomplete

    initMaps()
    importLibrary('places').then(() => {
      if (!inputRef.current) return

      const mdpBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(-38.15, -57.75),
        new google.maps.LatLng(-37.85, -57.45)
      )

      autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'ar' },
        bounds: mdpBounds,
        strictBounds: false,
        types: ['geocode', 'establishment'],
        fields: ['formatted_address', 'geometry'],
      })

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place.geometry?.location) return
        onChange({
          address: place.formatted_address ?? '',
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        })
      })
    })

    return () => {
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete)
    }
  }, [onChange])

  async function useCurrentLocation() {
    if (!navigator.geolocation) return
    setLocating(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      )
      const { latitude: lat, longitude: lng } = pos.coords

      initMaps()
      await importLibrary('geocoding')
      const geocoder = new google.maps.Geocoder()
      const result = await geocoder.geocode({ location: { lat, lng } })

      if (result.results[0]) {
        const address = result.results[0].formatted_address
        if (inputRef.current) inputRef.current.value = address
        onChange({ address, lat, lng })
      }
    } catch {
      // silently fail — user can type manually
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {showCurrentLocation && (
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="flex items-center gap-1 text-xs text-emerald-600 font-medium disabled:opacity-50"
          >
            {locating ? (
              'Buscando...'
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                Mi ubicación
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        defaultValue={value}
        placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
    </div>
  )
}
