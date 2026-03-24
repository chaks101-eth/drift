'use client'

import { useState } from 'react'
import Image from 'next/image'

const trendingDestinations = [
  { name: 'Bali', price: '$1,200', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80' },
  { name: 'Tokyo', price: '$1,800', image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80' },
  { name: 'Barcelona', price: '$1,400', image: 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400&q=80' },
  { name: 'Marrakech', price: '$900', image: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=400&q=80' },
  { name: 'Santorini', price: '$1,600', image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=400&q=80' },
  { name: 'New York', price: '$2,100', image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=80' },
]

const categories = [
  { name: 'Beaches', icon: '🏖️' },
  { name: 'Mountains', icon: '⛰️' },
  { name: 'Cities', icon: '🏙️' },
  { name: 'Food & Wine', icon: '🍷' },
  { name: 'Adventure', icon: '🧗' },
  { name: 'Cultural', icon: '🏛️' },
  { name: 'Wellness', icon: '🧘' },
  { name: 'Nightlife', icon: '🌃' },
]

export default function ExploreTab() {
  const [search, setSearch] = useState('')

  return (
    <div className="px-5 pb-28 pt-2">
      {/* Header */}
      <h1 className="text-[22px] font-semibold text-drift-text mb-1">Explore</h1>
      <p className="text-[13px] text-drift-text3 mb-5">Discover your next adventure</p>

      {/* Search bar */}
      <div className="relative mb-7">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-drift-text3"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search destinations..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-drift-card border border-drift-border2 rounded-xl pl-10 pr-4 py-3 text-[14px] text-drift-text placeholder:text-drift-text3 outline-none focus:border-drift-gold/40 transition-colors"
        />
      </div>

      {/* Trending Destinations */}
      <div className="mb-7">
        <h2 className="text-[15px] font-semibold text-drift-text mb-3">Trending Destinations</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 scrollbar-hide">
          {trendingDestinations.map((dest) => (
            <div
              key={dest.name}
              className="flex-shrink-0 w-[140px] rounded-xl overflow-hidden bg-drift-card border border-drift-border2 cursor-pointer active:scale-[0.97] transition-transform"
            >
              <div className="relative w-full h-[100px]">
                <Image
                  src={dest.image}
                  alt={dest.name}
                  fill
                  className="object-cover"
                  sizes="140px"
                />
              </div>
              <div className="p-2.5">
                <div className="text-[13px] font-medium text-drift-text">{dest.name}</div>
                <div className="text-[11px] text-drift-text3 mt-0.5">
                  From <span className="text-drift-gold font-medium">{dest.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div>
        <h2 className="text-[15px] font-semibold text-drift-text mb-3">Categories</h2>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((cat) => (
            <div
              key={cat.name}
              className="flex items-center gap-3 bg-drift-card border border-drift-border2 rounded-xl px-4 py-3.5 cursor-pointer active:scale-[0.97] transition-transform"
            >
              <span className="text-[22px]">{cat.icon}</span>
              <span className="text-[13px] font-medium text-drift-text">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
