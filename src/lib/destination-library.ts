// Pre-seeded destination library — instant vibe-based matching without LLM calls
// Each destination tagged with vibes, country, tagline, and a high-quality image URL
// Updated: April 2026

export interface LibraryDestination {
  city: string
  country: string
  vibes: string[]
  tagline: string
  image_url: string
  isDomestic: boolean // relative to India (primary user base)
}

// ─── DOMESTIC (India) — 60 destinations ────────────────────────

const DOMESTIC: LibraryDestination[] = [
  // Beach
  { city: 'Goa', country: 'India', vibes: ['beach', 'party', 'foodie'], tagline: 'India\'s party coast — beaches by day, clubs by night', image_url: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&q=85', isDomestic: true },
  { city: 'Gokarna', country: 'India', vibes: ['beach', 'backpacker', 'spiritual'], tagline: 'Goa\'s quieter cousin — temples meet untouched beaches', image_url: 'https://images.unsplash.com/photo-1590050752117-238cb20e10a0?w=800&q=85', isDomestic: true },
  { city: 'Varkala', country: 'India', vibes: ['beach', 'wellness', 'backpacker'], tagline: 'Clifftop cafes overlooking the Arabian Sea', image_url: 'https://images.unsplash.com/photo-1590050751120-e37e6e8dbcf0?w=800&q=85', isDomestic: true },
  { city: 'Pondicherry', country: 'India', vibes: ['beach', 'culture', 'foodie'], tagline: 'French Quarter vibes meets Tamil soul food', image_url: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800&q=85', isDomestic: true },
  { city: 'Andaman Islands', country: 'India', vibes: ['beach', 'adventure', 'nature'], tagline: 'Crystal waters and untouched coral — India\'s best-kept secret', image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=85', isDomestic: true },
  { city: 'Lakshadweep', country: 'India', vibes: ['beach', 'luxury', 'nature'], tagline: 'India\'s Maldives — pristine atolls with zero crowds', image_url: 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800&q=85', isDomestic: true },
  { city: 'Alleppey', country: 'India', vibes: ['beach', 'romance', 'nature'], tagline: 'Houseboat through Kerala\'s backwaters at sunset', image_url: 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800&q=85', isDomestic: true },
  // Adventure
  { city: 'Manali', country: 'India', vibes: ['adventure', 'nature', 'backpacker'], tagline: 'Snow peaks, river rafting, and mountain passes', image_url: 'https://images.unsplash.com/photo-1626621338535-ab2a5cce608f?w=800&q=85', isDomestic: true },
  { city: 'Rishikesh', country: 'India', vibes: ['adventure', 'spiritual', 'wellness'], tagline: 'White-water rafting meets yoga on the Ganges', image_url: 'https://images.unsplash.com/photo-1592385725584-05839d3d2739?w=800&q=85', isDomestic: true },
  { city: 'Leh Ladakh', country: 'India', vibes: ['adventure', 'nature', 'backpacker'], tagline: 'The roof of the world — Khardung La, Pangong, Nubra', image_url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800&q=85', isDomestic: true },
  { city: 'Spiti Valley', country: 'India', vibes: ['adventure', 'nature', 'hidden'], tagline: 'India\'s cold desert — monasteries and moonscapes', image_url: 'https://images.unsplash.com/photo-1585516482738-0b2e6e5b5da7?w=800&q=85', isDomestic: true },
  { city: 'Coorg', country: 'India', vibes: ['adventure', 'nature', 'wellness'], tagline: 'Coffee plantations and misty waterfalls in Karnataka', image_url: 'https://images.unsplash.com/photo-1596402184320-417e7178b2cd?w=800&q=85', isDomestic: true },
  { city: 'Meghalaya', country: 'India', vibes: ['adventure', 'nature', 'hidden'], tagline: 'Living root bridges and the wettest place on Earth', image_url: 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?w=800&q=85', isDomestic: true },
  // Spiritual
  { city: 'Varanasi', country: 'India', vibes: ['spiritual', 'culture', 'foodie'], tagline: 'The oldest living city — ghats, aartis, and street food', image_url: 'https://images.unsplash.com/photo-1561361513-2d000a50f0dc?w=800&q=85', isDomestic: true },
  { city: 'Amritsar', country: 'India', vibes: ['spiritual', 'foodie', 'culture'], tagline: 'Golden Temple, Wagah Border, and the best food in India', image_url: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&q=85', isDomestic: true },
  { city: 'Dharamshala', country: 'India', vibes: ['spiritual', 'wellness', 'nature'], tagline: 'Home of the Dalai Lama — Tibetan culture in the Himalayas', image_url: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&q=85', isDomestic: true },
  { city: 'Bodh Gaya', country: 'India', vibes: ['spiritual', 'culture', 'hidden'], tagline: 'Where Buddha attained enlightenment — the holiest Buddhist site', image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=85', isDomestic: true },
  // City
  { city: 'Mumbai', country: 'India', vibes: ['city', 'foodie', 'party'], tagline: 'Maximum city — street food, nightlife, and Bollywood', image_url: 'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=800&q=85', isDomestic: true },
  { city: 'Delhi', country: 'India', vibes: ['city', 'culture', 'foodie'], tagline: 'Old Delhi chaos meets New Delhi grandeur', image_url: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&q=85', isDomestic: true },
  { city: 'Bangalore', country: 'India', vibes: ['city', 'foodie', 'party'], tagline: 'Craft beer capital with the best weather in India', image_url: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800&q=85', isDomestic: true },
  { city: 'Kolkata', country: 'India', vibes: ['city', 'culture', 'foodie'], tagline: 'The city of joy — literary cafes, colonial architecture, street food', image_url: 'https://images.unsplash.com/photo-1558431382-27e303142255?w=800&q=85', isDomestic: true },
  { city: 'Hyderabad', country: 'India', vibes: ['city', 'foodie', 'culture'], tagline: 'Biryani capital with Charminar and tech-city buzz', image_url: 'https://images.unsplash.com/photo-1572427841249-2f88a3b2fcf0?w=800&q=85', isDomestic: true },
  // Romance
  { city: 'Udaipur', country: 'India', vibes: ['romance', 'luxury', 'culture'], tagline: 'City of Lakes — palatial stays and sunset boat rides', image_url: 'https://images.unsplash.com/photo-1595658658481-d53d3f999875?w=800&q=85', isDomestic: true },
  { city: 'Jaipur', country: 'India', vibes: ['culture', 'romance', 'shopping'], tagline: 'Pink City — forts, palaces, and bazaars in every shade', image_url: 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800&q=85', isDomestic: true },
  { city: 'Munnar', country: 'India', vibes: ['romance', 'nature', 'wellness'], tagline: 'Tea gardens and misty mornings in Kerala\'s highlands', image_url: 'https://images.unsplash.com/photo-1611911813383-67d5c293f1a4?w=800&q=85', isDomestic: true },
  // Nature
  { city: 'Shimla', country: 'India', vibes: ['nature', 'romance', 'family'], tagline: 'Colonial hill station with toy train and mountain views', image_url: 'https://images.unsplash.com/photo-1597074866923-dc0589150142?w=800&q=85', isDomestic: true },
  { city: 'Ooty', country: 'India', vibes: ['nature', 'romance', 'family'], tagline: 'Queen of hill stations — botanical gardens and Nilgiri tea', image_url: 'https://images.unsplash.com/photo-1585544314038-a0b16b15ef1a?w=800&q=85', isDomestic: true },
  { city: 'Darjeeling', country: 'India', vibes: ['nature', 'culture', 'backpacker'], tagline: 'Himalayan sunrises, tea estates, and the toy train', image_url: 'https://images.unsplash.com/photo-1544634076-28a79c5951e3?w=800&q=85', isDomestic: true },
  { city: 'Kodaikanal', country: 'India', vibes: ['nature', 'romance', 'hidden'], tagline: 'Princess of hill stations — misty lakes and forest trails', image_url: 'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=800&q=85', isDomestic: true },
  { city: 'Jim Corbett', country: 'India', vibes: ['nature', 'adventure', 'family'], tagline: 'Tiger country — India\'s oldest national park', image_url: 'https://images.unsplash.com/photo-1549366021-9f761d450615?w=800&q=85', isDomestic: true },
  // Luxury
  { city: 'Jodhpur', country: 'India', vibes: ['luxury', 'culture', 'romance'], tagline: 'The Blue City — Mehrangarh Fort and heritage havelis', image_url: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?w=800&q=85', isDomestic: true },
  { city: 'Jaisalmer', country: 'India', vibes: ['luxury', 'adventure', 'culture'], tagline: 'Golden City — desert safaris and sandstone palaces', image_url: 'https://images.unsplash.com/photo-1609866138210-84bb689f3c61?w=800&q=85', isDomestic: true },
  // Wellness
  { city: 'Kerala Backwaters', country: 'India', vibes: ['wellness', 'nature', 'romance'], tagline: 'Ayurveda retreats and houseboat journeys', image_url: 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800&q=85', isDomestic: true },
  // Foodie
  { city: 'Lucknow', country: 'India', vibes: ['foodie', 'culture', 'city'], tagline: 'City of Nawabs — the kebab and biryani capital', image_url: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&q=85', isDomestic: true },
  { city: 'Ahmedabad', country: 'India', vibes: ['foodie', 'culture', 'city'], tagline: 'UNESCO heritage city with the best Gujarati thali', image_url: 'https://images.unsplash.com/photo-1609947017136-9daf32a5eb75?w=800&q=85', isDomestic: true },
  // Hidden
  { city: 'Hampi', country: 'India', vibes: ['hidden', 'culture', 'backpacker'], tagline: 'Ancient ruins scattered across a surreal boulder landscape', image_url: 'https://images.unsplash.com/photo-1590050752117-238cb20e10a0?w=800&q=85', isDomestic: true },
  { city: 'Orchha', country: 'India', vibes: ['hidden', 'culture', 'nature'], tagline: 'Forgotten Mughal city — palatial ruins with zero tourists', image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=85', isDomestic: true },
  { city: 'Ziro Valley', country: 'India', vibes: ['hidden', 'nature', 'culture'], tagline: 'Apatani tribal homeland — music festival and rice paddies', image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=85', isDomestic: true },
  { city: 'Tawang', country: 'India', vibes: ['hidden', 'spiritual', 'nature'], tagline: 'India\'s largest monastery in Arunachal\'s mountains', image_url: 'https://images.unsplash.com/photo-1585544314038-a0b16b15ef1a?w=800&q=85', isDomestic: true },
  // Family
  { city: 'Mysore', country: 'India', vibes: ['family', 'culture', 'foodie'], tagline: 'Palace city — heritage, sandalwood, and Mysore pak', image_url: 'https://images.unsplash.com/photo-1600100397608-e4b89e46e76e?w=800&q=85', isDomestic: true },
  { city: 'Nainital', country: 'India', vibes: ['family', 'nature', 'romance'], tagline: 'Lake town in the Kumaon hills — boating and mountain views', image_url: 'https://images.unsplash.com/photo-1585544314038-a0b16b15ef1a?w=800&q=85', isDomestic: true },
]

// ─── INTERNATIONAL — 60 destinations ────────────────────────────

const INTERNATIONAL: LibraryDestination[] = [
  // Beach
  { city: 'Bali', country: 'Indonesia', vibes: ['beach', 'spiritual', 'foodie'], tagline: 'Temple sunsets, rice terraces, and the best nasi goreng', image_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800&q=85', isDomestic: false },
  { city: 'Maldives', country: 'Maldives', vibes: ['beach', 'luxury', 'romance'], tagline: 'Overwater villas on crystal-clear atolls', image_url: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=85', isDomestic: false },
  { city: 'Phuket', country: 'Thailand', vibes: ['beach', 'party', 'adventure'], tagline: 'Thailand\'s biggest island — from Patong parties to hidden coves', image_url: 'https://images.unsplash.com/photo-1589394815804-964ed0be2eb5?w=800&q=85', isDomestic: false },
  { city: 'Krabi', country: 'Thailand', vibes: ['beach', 'adventure', 'nature'], tagline: 'Limestone cliffs, island hopping, and emerald pools', image_url: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800&q=85', isDomestic: false },
  { city: 'Zanzibar', country: 'Tanzania', vibes: ['beach', 'culture', 'hidden'], tagline: 'Spice island — Stone Town alleys and turquoise shores', image_url: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&q=85', isDomestic: false },
  { city: 'Boracay', country: 'Philippines', vibes: ['beach', 'party', 'backpacker'], tagline: 'White Beach perfection — powder sand meets nightlife', image_url: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=85', isDomestic: false },
  // Adventure
  { city: 'Queenstown', country: 'New Zealand', vibes: ['adventure', 'nature', 'luxury'], tagline: 'Bungee jumping capital with Milford Sound at your doorstep', image_url: 'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?w=800&q=85', isDomestic: false },
  { city: 'Interlaken', country: 'Switzerland', vibes: ['adventure', 'nature', 'luxury'], tagline: 'Paragliding over the Alps between two lakes', image_url: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800&q=85', isDomestic: false },
  { city: 'Cappadocia', country: 'Turkey', vibes: ['adventure', 'romance', 'culture'], tagline: 'Hot air balloons over fairy chimneys at sunrise', image_url: 'https://images.unsplash.com/photo-1526888935184-a82d2a4b7e67?w=800&q=85', isDomestic: false },
  { city: 'Iceland', country: 'Iceland', vibes: ['adventure', 'nature', 'hidden'], tagline: 'Northern lights, glaciers, and volcanic hot springs', image_url: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=800&q=85', isDomestic: false },
  // City
  { city: 'Tokyo', country: 'Japan', vibes: ['city', 'foodie', 'culture'], tagline: 'Where ancient temples hide between neon skyscrapers', image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=85', isDomestic: false },
  { city: 'Bangkok', country: 'Thailand', vibes: ['city', 'foodie', 'party'], tagline: 'Street food heaven with temples, markets, and rooftop bars', image_url: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&q=85', isDomestic: false },
  { city: 'Singapore', country: 'Singapore', vibes: ['city', 'foodie', 'luxury'], tagline: 'Garden city — hawker centers to Marina Bay Sands', image_url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800&q=85', isDomestic: false },
  { city: 'Dubai', country: 'UAE', vibes: ['city', 'luxury', 'shopping'], tagline: 'Superlatives everywhere — tallest, biggest, most expensive', image_url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=85', isDomestic: false },
  { city: 'Istanbul', country: 'Turkey', vibes: ['city', 'culture', 'foodie'], tagline: 'Where East meets West — bazaars, mosques, and meze', image_url: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=800&q=85', isDomestic: false },
  { city: 'New York', country: 'USA', vibes: ['city', 'culture', 'foodie'], tagline: 'The city that never sleeps — Broadway, pizza, Central Park', image_url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&q=85', isDomestic: false },
  // Romance
  { city: 'Paris', country: 'France', vibes: ['romance', 'culture', 'foodie'], tagline: 'The city of love — croissants, Seine walks, and Montmartre', image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=85', isDomestic: false },
  { city: 'Santorini', country: 'Greece', vibes: ['romance', 'beach', 'luxury'], tagline: 'White-washed cliffs, blue domes, and Aegean sunsets', image_url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&q=85', isDomestic: false },
  { city: 'Venice', country: 'Italy', vibes: ['romance', 'culture', 'luxury'], tagline: 'Gondola rides through floating palaces', image_url: 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?w=800&q=85', isDomestic: false },
  { city: 'Maldives', country: 'Maldives', vibes: ['romance', 'luxury', 'beach'], tagline: 'Private island dinners under a million stars', image_url: 'https://images.unsplash.com/photo-1573843981267-be1999ff37cd?w=800&q=85', isDomestic: false },
  // Luxury
  { city: 'Zurich', country: 'Switzerland', vibes: ['luxury', 'nature', 'city'], tagline: 'Swiss precision — lake views, chocolate, and alpine escapes', image_url: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=800&q=85', isDomestic: false },
  { city: 'Monaco', country: 'Monaco', vibes: ['luxury', 'city', 'romance'], tagline: 'Casino royale — yachts, Formula 1, and Michelin stars', image_url: 'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=800&q=85', isDomestic: false },
  // Culture
  { city: 'Rome', country: 'Italy', vibes: ['culture', 'foodie', 'romance'], tagline: 'The Eternal City — Colosseum, pasta, and piazza life', image_url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800&q=85', isDomestic: false },
  { city: 'Kyoto', country: 'Japan', vibes: ['culture', 'spiritual', 'nature'], tagline: 'Ancient temples, geisha districts, and bamboo groves', image_url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=85', isDomestic: false },
  { city: 'Marrakech', country: 'Morocco', vibes: ['culture', 'shopping', 'foodie'], tagline: 'Souks, riads, and tagine in the Red City', image_url: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=800&q=85', isDomestic: false },
  { city: 'Prague', country: 'Czech Republic', vibes: ['culture', 'city', 'romance'], tagline: 'Gothic spires, cobblestone lanes, and the cheapest beer in Europe', image_url: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800&q=85', isDomestic: false },
  // Nature
  { city: 'Chiang Mai', country: 'Thailand', vibes: ['nature', 'culture', 'wellness'], tagline: 'Mountain temples, night markets, and elephant sanctuaries', image_url: 'https://images.unsplash.com/photo-1528181304800-259b08848526?w=800&q=85', isDomestic: false },
  { city: 'Queenstown', country: 'New Zealand', vibes: ['nature', 'adventure', 'luxury'], tagline: 'Lord of the Rings landscapes — fiords and mountains', image_url: 'https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?w=800&q=85', isDomestic: false },
  { city: 'Da Nang', country: 'Vietnam', vibes: ['nature', 'beach', 'foodie'], tagline: 'Golden Bridge, marble mountains, and banh mi on the beach', image_url: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?w=800&q=85', isDomestic: false },
  // Wellness
  { city: 'Ubud', country: 'Indonesia', vibes: ['wellness', 'spiritual', 'nature'], tagline: 'Eat Pray Love territory — yoga, rice terraces, and healing', image_url: 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=800&q=85', isDomestic: false },
  { city: 'Ko Samui', country: 'Thailand', vibes: ['wellness', 'beach', 'luxury'], tagline: 'Thai island wellness — detox retreats and coconut beaches', image_url: 'https://images.unsplash.com/photo-1537956965359-7573183d1f57?w=800&q=85', isDomestic: false },
  // Foodie
  { city: 'Hanoi', country: 'Vietnam', vibes: ['foodie', 'culture', 'backpacker'], tagline: 'Pho at dawn, egg coffee at noon, beer hoi at dusk', image_url: 'https://images.unsplash.com/photo-1557750255-c76072a7aad1?w=800&q=85', isDomestic: false },
  { city: 'Lisbon', country: 'Portugal', vibes: ['foodie', 'culture', 'city'], tagline: 'Pastéis de nata, fado music, and tram 28 through the hills', image_url: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800&q=85', isDomestic: false },
  // Party
  { city: 'Pattaya', country: 'Thailand', vibes: ['party', 'beach', 'city'], tagline: 'Thailand\'s party city — Walking Street and island day trips', image_url: 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?w=800&q=85', isDomestic: false },
  { city: 'Ibiza', country: 'Spain', vibes: ['party', 'beach', 'luxury'], tagline: 'The world\'s clubbing capital — superclubs meet hidden coves', image_url: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800&q=85', isDomestic: false },
  // Backpacker
  { city: 'Siem Reap', country: 'Cambodia', vibes: ['backpacker', 'culture', 'adventure'], tagline: 'Angkor Wat at sunrise — temple kingdom on a shoestring', image_url: 'https://images.unsplash.com/photo-1539650116574-8efeb43e2750?w=800&q=85', isDomestic: false },
  { city: 'Colombo', country: 'Sri Lanka', vibes: ['backpacker', 'culture', 'beach'], tagline: 'Gateway to Sri Lanka — colonial charm and curry rice', image_url: 'https://images.unsplash.com/photo-1586276393635-5ecd8a851acc?w=800&q=85', isDomestic: false },
  // Shopping
  { city: 'Hong Kong', country: 'China', vibes: ['shopping', 'city', 'foodie'], tagline: 'Dim sum, harbour views, and Temple Street Night Market', image_url: 'https://images.unsplash.com/photo-1536599018102-9f803c029b81?w=800&q=85', isDomestic: false },
  { city: 'Seoul', country: 'South Korea', vibes: ['shopping', 'city', 'foodie'], tagline: 'K-pop, Korean BBQ, and Myeongdong shopping frenzy', image_url: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=800&q=85', isDomestic: false },
  // Hidden
  { city: 'Luang Prabang', country: 'Laos', vibes: ['hidden', 'spiritual', 'nature'], tagline: 'Monks at dawn, Mekong sunsets, and Kuang Si Falls', image_url: 'https://images.unsplash.com/photo-1539367628448-4bc5c9d171c8?w=800&q=85', isDomestic: false },
  { city: 'Tbilisi', country: 'Georgia', vibes: ['hidden', 'foodie', 'culture'], tagline: 'Wine country with sulfur baths and a bohemian Old Town', image_url: 'https://images.unsplash.com/photo-1565008576549-57569a49371d?w=800&q=85', isDomestic: false },
  // Family
  { city: 'Sydney', country: 'Australia', vibes: ['family', 'beach', 'city'], tagline: 'Opera House, Bondi Beach, and koalas in the wild', image_url: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800&q=85', isDomestic: false },
  { city: 'Dubai', country: 'UAE', vibes: ['family', 'luxury', 'adventure'], tagline: 'Theme parks, desert safaris, and Atlantis water slides', image_url: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?w=800&q=85', isDomestic: false },
]

// ─── Matching Engine ─────────────────────────────────────────────

const ALL_DESTINATIONS = [...DOMESTIC, ...INTERNATIONAL]

/**
 * Find destinations matching user vibes from the pre-seeded library.
 * Returns up to `count` destinations, balanced between domestic and international.
 * Scoring: number of matching vibes / total user vibes.
 */
export function matchDestinations(params: {
  vibes: string[]
  originCountry?: string | null
  count?: number
}): (LibraryDestination & { match: number })[] {
  const { vibes, originCountry, count = 8 } = params
  if (!vibes.length) return ALL_DESTINATIONS.slice(0, count).map(d => ({ ...d, match: 50 }))

  // Score each destination by vibe overlap
  const scored = ALL_DESTINATIONS.map(dest => {
    const overlap = dest.vibes.filter(v => vibes.includes(v)).length
    const match = vibes.length > 0 ? Math.round((overlap / vibes.length) * 100) : 50
    return { ...dest, match }
  }).filter(d => d.match > 0)

  // Sort by match score
  scored.sort((a, b) => b.match - a.match)

  // If we know the origin country, determine domestic
  const isDomesticFn = originCountry === 'India'
    ? (d: LibraryDestination) => d.isDomestic
    : (_d: LibraryDestination) => false // non-Indian users: all international

  const domestic = scored.filter(d => isDomesticFn(d))
  const international = scored.filter(d => !isDomesticFn(d))

  // Balance: up to half from each
  const half = Math.ceil(count / 2)
  const picked = [
    ...domestic.slice(0, half),
    ...international.slice(0, half),
  ].sort((a, b) => b.match - a.match).slice(0, count)

  return picked
}
