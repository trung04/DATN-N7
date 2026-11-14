import type { Hotel } from '@/types/domain'

// Online photos are served by Unsplash's image CDN. The hotel records in the
// local database are fictional demo properties, so these photos are illustrative.
const hotelPhotos = [
  'photo-1566073771259-6a8506099945',
  'photo-1571896349842-33c89424de2d',
  'photo-1564501049412-61c2a3083791',
  'photo-1542314831-068cd1dbfeeb',
  'photo-1540518614846-7d63ca4727',
  'photo-1520250497591-112f2f40a3f4',
  'photo-1568084680786-a84f91d1153c',
  'photo-1582719508461-905c673771fd',
] as const

const roomPhotos = [
  'photo-1611892440504-42a792e24d32',
  'photo-1618221195710-dd6b41faaea6',
  'photo-1590490360182-c33d57733427',
  'photo-1595576508898-0ad5c879a061',
  'photo-1616486338812-3dadae4b4ace',
  'photo-1598928506311-c55ded91a20c',
] as const

const hotelPhotoById: Record<string, string> = {
  '7c7710ca-c1ef-46de-86fa-06a094ec592f': hotelPhotos[0],
  '1a86b3b1-2c44-459b-9927-51506bfa528e': hotelPhotos[1],
  '2083c18b-c937-4874-8d8e-58efd59526e4': hotelPhotos[2],
  '5f335362-443e-49d5-bc0a-d0761b5fec09': hotelPhotos[3],
  '8f68f396-e5ac-4c76-a642-03cd5c205079': hotelPhotos[4],
  '9d3c308b-2055-447f-83b9-bb0587457495': hotelPhotos[5],
  'a642b565-c86b-459f-9b61-43e855224332': hotelPhotos[6],
  'e22c16d3-54d3-4da9-a791-0ac344140b78': hotelPhotos[7],
}

function imageUrl(photoId: string, width: number) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${width}&q=80`
}

export function seededHotelPhoto(hotel: Hotel, width = 1400) {
  const photo = hotelPhotoById[hotel.id]
  return photo ? imageUrl(photo, width) : undefined
}

export function seededRoomPhoto(hotelId: string, roomType: string) {
  const hotelIndex = Object.keys(hotelPhotoById).indexOf(hotelId)
  if (hotelIndex < 0) return undefined
  const normalizedType = roomType.toLocaleLowerCase('vi')
  const typeIndex = normalizedType.includes('suite') || normalizedType.includes('vip')
    ? 2
    : normalizedType.includes('deluxe') || normalizedType.includes('gia đình') || normalizedType.includes('family')
      ? 1
      : 0
  const photo = roomPhotos[(hotelIndex + typeIndex) % roomPhotos.length]!
  return imageUrl(photo, 900)
}
