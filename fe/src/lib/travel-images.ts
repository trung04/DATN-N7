const images = {
  coast: '/images/da-nang-coast.webp',
  highlands: '/images/da-lat-pines.webp',
  oldTown: '/images/hoi-an-lanterns.webp',
  heritage: '/images/hue-citadel.webp',
  food: '/images/vietnamese-food.webp',
} as const

export function travelImage(city: string, kind: 'destination' | 'hotel' | 'restaurant' = 'destination') {
  if (kind === 'restaurant') return images.food
  if (city === 'Đà Lạt') return images.highlands
  if (city === 'Quảng Nam') return images.oldTown
  if (city === 'Huế') return images.heritage
  if (city === 'Đà Nẵng') return images.coast
  return undefined
}

export const heroImage = images.coast
