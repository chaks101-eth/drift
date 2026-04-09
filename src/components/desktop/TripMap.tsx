'use client'

import { useEffect, useRef } from 'react'
import type { ItineraryItem, ItemMetadata } from '@/stores/trip-store'

// Leaflet types
type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap
  remove: () => void
  fitBounds: (bounds: [number, number][], options?: { padding?: [number, number]; maxZoom?: number }) => void
}
type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker
  bindPopup: (html: string) => LeafletMarker
  remove: () => void
}

interface Props {
  items: ItineraryItem[]
  className?: string
  height?: string
  center?: [number, number]
  zoom?: number
}

export default function TripMap({ items, className = '', height = '400px', center, zoom = 12 }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<LeafletMap | null>(null)
  const markersRef = useRef<LeafletMarker[]>([])

  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return

    let cancelled = false

    async function initMap() {
      // Dynamic import to avoid SSR issues
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')

      if (cancelled || !mapRef.current) return

      // Gather points from items
      const points: Array<{ lat: number; lng: number; item: ItineraryItem }> = []
      for (const item of items) {
        const meta = (item.metadata || {}) as ItemMetadata
        const lat = meta.lat as number | undefined
        const lng = meta.lng as number | undefined
        if (lat && lng) {
          points.push({ lat, lng, item })
        }
      }

      const mapCenter: [number, number] = center || (points.length > 0 ? [points[0].lat, points[0].lng] : [0, 0])

      // Create map
      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current, {
          center: mapCenter,
          zoom,
          zoomControl: true,
          scrollWheelZoom: true,
        }) as unknown as LeafletMap

        // Dark tile layer (CartoDB dark matter)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
        }).addTo(mapInstance.current as unknown as L.Map)
      }

      // Clear old markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      // Category → color map
      const colors: Record<string, string> = {
        flight: '#c8a44e',
        hotel: '#4ecdc4',
        activity: '#c8a44e',
        food: '#f0a500',
      }

      // Add pins
      const latLngs: [number, number][] = []
      for (let i = 0; i < points.length; i++) {
        const { lat, lng, item } = points[i]
        const color = colors[item.category] || '#c8a44e'

        const icon = L.divIcon({
          html: `<div style="
            background: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid #08080c;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #08080c;
            font-weight: bold;
            font-size: 10px;
            font-family: 'Playfair Display', serif;
          ">${i + 1}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
          className: 'drift-map-marker',
        })

        const marker = L.marker([lat, lng], { icon })
          .addTo(mapInstance.current as unknown as L.Map)
          .bindPopup(`
            <div style="font-family: Inter, sans-serif; min-width: 180px;">
              <div style="font-family: 'Playfair Display', serif; font-size: 14px; color: #f0efe8; margin-bottom: 4px;">${item.name}</div>
              <div style="font-size: 10px; color: #7a7a85;">${item.detail || ''}</div>
              ${item.price ? `<div style="font-size: 11px; color: #c8a44e; font-weight: 600; margin-top: 6px;">${item.price}</div>` : ''}
            </div>
          `) as unknown as LeafletMarker

        markersRef.current.push(marker)
        latLngs.push([lat, lng])
      }

      // Fit bounds if multiple points
      if (latLngs.length > 1 && mapInstance.current) {
        mapInstance.current.fitBounds(latLngs, { padding: [30, 30], maxZoom: 14 })
      } else if (latLngs.length === 1 && mapInstance.current) {
        mapInstance.current.setView(latLngs[0], 13)
      }
    }

    initMap()

    return () => {
      cancelled = true
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }
    }
  }, [items, center, zoom])

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] ${className}`} style={{ height }}>
      <div ref={mapRef} className="h-full w-full" style={{ background: '#08080c' }} />
    </div>
  )
}
