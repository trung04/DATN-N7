import 'reflect-metadata';
import { config as loadEnvironment } from 'dotenv';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/environment.validation';
import { AmenityEntity } from '../modules/amenities/entities/amenity.entity';
import { RoomAmenityEntity } from '../modules/rooms/entities/room-amenity.entity';
import { RoomEntity } from '../modules/rooms/entities/room.entity';
import { AdminEntity } from '../modules/users/entities/admin.entity';
import { HotelOwnerEntity } from '../modules/users/entities/hotel-owner.entity';
import { TopicEntity } from '../modules/users/entities/topic.entity';
import { TouristEntity } from '../modules/users/entities/tourist.entity';
import { TravelPreferenceTopicEntity } from '../modules/users/entities/travel-preference-topic.entity';
import { TravelPreferenceEntity } from '../modules/users/entities/travel-preference.entity';
import { UserEntity } from '../modules/users/entities/user.entity';
import { UserImageEntity } from '../modules/users/entities/user-image.entity';
import { UserFavoriteEntity } from '../modules/users/entities/user-favorite.entity';
import { ImageEntity } from '../modules/media/entities/image.entity';
import { ItineraryEntity } from '../modules/itineraries/entities/itinerary.entity';
import { StopoverEntity } from '../modules/stopovers/entities/stopover.entity';
import { ActivityEntity } from '../modules/activities/entities/activity.entity';
import { PlaceCategoryMappingEntity } from '../modules/places/entities/place-category-mapping.entity';
import { PlaceCategoryEntity } from '../modules/places/entities/place-category.entity';
import { PlaceImageEntity } from '../modules/places/entities/place-image.entity';
import { PlaceTopicEntity } from '../modules/places/entities/place-topic.entity';
import { PlaceEntity } from '../modules/places/entities/place.entity';
import { ReferencePriceEntity } from '../modules/places/entities/reference-price.entity';
import { CancellationPolicyEntity } from '../modules/cancellation-policies/entities/cancellation-policy.entity';
import { BookingEntity } from '../modules/bookings/entities/booking.entity';
import { BookingRoomEntity } from '../modules/bookings/entities/booking-room.entity';
import { BookingIdempotencyKeyEntity } from '../modules/bookings/entities/booking-idempotency-key.entity';
import { HotelEntity } from '../modules/hotels/entities/hotel.entity';
import { HotelDocumentEntity } from '../modules/hotels/entities/hotel-document.entity';
import { HotelReviewHistoryEntity } from '../modules/hotels/entities/hotel-review-history.entity';
import { CreateAmenities1793696400000 } from './migrations/1793696400000-CreateAmenities';
import { RemoveAmenityType1793696500000 } from './migrations/1793696500000-RemoveAmenityType';
import { CreateRooms1793696600000 } from './migrations/1793696600000-CreateRooms';
import { CreateUsers1793696700000 } from './migrations/1793696700000-CreateUsers';
import { CreateHotelOwners1793696800000 } from './migrations/1793696800000-CreateHotelOwners';
import { AddUserRolesSoftDeleteAndItineraries1793696900000 } from './migrations/1793696900000-AddUserRolesSoftDeleteAndItineraries';
import { CreatePlaces1793696900000 } from './migrations/1793696900000-CreatePlaces';
import { CreateCancellationPolicies1793697000000 } from './migrations/1793697000000-CreateCancellationPolicies';
import { CreateBookings1793697100000 } from './migrations/1793697100000-CreateBookings';
import { UseGenericVnpayPayment1793697200000 } from './migrations/1793697200000-UseGenericVnpayPayment';
import { CompleteBookingStayDetails1793697300000 } from './migrations/1793697300000-CompleteBookingStayDetails';
import { AddBookingReservationExpiry1793697400000 } from './migrations/1793697400000-AddBookingReservationExpiry';
import { CreateBookingIdempotencyKeys1793697500000 } from './migrations/1793697500000-CreateBookingIdempotencyKeys';
import { CreateHotels1793697600000 } from './migrations/1793697600000-CreateHotels';
import { AlignAuthenticationSchema1793898000000 } from './migrations/1793898000000-AlignAuthenticationSchema';
import { AddHotelScopedAmenities1793898100000 } from './migrations/1793898100000-AddHotelScopedAmenities';
import { AddCancellationPolicyRanges1793898200000 } from './migrations/1793898200000-AddCancellationPolicyRanges';
import { ReviewEntity } from '../modules/reviews/entities/review.entity';
import { ReviewModerationHistoryEntity } from '../modules/reviews/entities/review-moderation-history.entity';
import { CreateReviews1793898300000 } from './migrations/1793898300000-CreateReviews';
import { HotelImageEntity } from '../modules/hotels/entities/hotel-image.entity';
import { CreateHotelImages1794400000000 } from './migrations/1794400000000-CreateHotelImages';
import { AddUserTwoFactorFlag1794400001000 } from './migrations/1794400001000-AddUserTwoFactorFlag';
import { AddHotelOwnerTimestamps1794400002000 } from './migrations/1794400002000-AddHotelOwnerTimestamps';
import { ExpandPlaceCatalog1794500000000 } from './migrations/1794500000000-ExpandPlaceCatalog';
import { CreatePlaceCatalogRelations1794500000500 } from './migrations/1794500000500-CreatePlaceCatalogRelations';
import { BackfillPlaceCatalog1794500001000 } from './migrations/1794500001000-BackfillPlaceCatalog';
import { NormalizeImages1794500002000 } from './migrations/1794500002000-NormalizeImages';
import { AlignPlacesSchema1794400003000 } from './migrations/1794400003000-AlignPlacesSchema';
import { RequireCancellationPolicySnapshot1794400004000 } from './migrations/1794400004000-RequireCancellationPolicySnapshot';
import { UseHoursAfterBookingForCancellation1794400005000 } from './migrations/1794400005000-UseHoursAfterBookingForCancellation';
import { SimplifyCancellationPolicies1794400006000 } from './migrations/1794400006000-SimplifyCancellationPolicies';
import { CompleteManualBookingRefundWorkflow1794400007000 } from './migrations/1794400007000-CompleteManualBookingRefundWorkflow';
import { UseSePayV2SandboxOrders1794400008000 } from './migrations/1794400008000-UseSePayV2SandboxOrders';
import { NotificationEntity } from '../modules/notifications/entities/notification.entity';
import { CreateNotifications1794400009000 } from './migrations/1794400009000-CreateNotifications';
import { CreateTravelPreferences1794500003000 } from './migrations/1794500003000-CreateTravelPreferences';
import { AddItineraryDestinationCity1794500004000 } from './migrations/1794500004000-AddItineraryDestinationCity';
import { CreateSettlementBatches1794500005000 } from './migrations/1794500005000-CreateSettlementBatches';
import { SettlementBatchEntity } from '../modules/bookings/entities/settlement-batch.entity';
import { SettlementItemEntity } from '../modules/bookings/entities/settlement-item.entity';
import { SettlementBatchEventEntity } from '../modules/bookings/entities/settlement-batch-event.entity';
import { CreateSettlementBatchEvents1794500006000 } from './migrations/1794500006000-CreateSettlementBatchEvents';
import { CreateUserFavorites1794500007000 } from './migrations/1794500007000-CreateUserFavorites';

loadEnvironment();
const environment = validateEnvironment(process.env);

export default new DataSource({
  type: 'postgres',
  host: environment.DATABASE_HOST as string,
  port: environment.DATABASE_PORT as number,
  username: environment.DATABASE_USER as string,
  password: environment.DATABASE_PASSWORD as string,
  database: environment.DATABASE_NAME as string,
  ssl: environment.DATABASE_SSL ? { rejectUnauthorized: true } : false,
  entities: [
    AmenityEntity,
    RoomEntity,
    RoomAmenityEntity,
    UserEntity,
    AdminEntity,
    TouristEntity,
    HotelOwnerEntity,
    TopicEntity,
    TravelPreferenceEntity,
    TravelPreferenceTopicEntity,
    ImageEntity,
    UserImageEntity,
    UserFavoriteEntity,
    ItineraryEntity,
    StopoverEntity,
    ActivityEntity,
    PlaceEntity,
    PlaceCategoryEntity,
    PlaceCategoryMappingEntity,
    PlaceTopicEntity,
    PlaceImageEntity,
    ReferencePriceEntity,
    CancellationPolicyEntity,
    BookingEntity,
    BookingRoomEntity,
    BookingIdempotencyKeyEntity,
    SettlementBatchEntity,
    SettlementItemEntity,
    SettlementBatchEventEntity,
    HotelEntity,
    HotelImageEntity,
    HotelDocumentEntity,
    HotelReviewHistoryEntity,
    ReviewEntity,
    ReviewModerationHistoryEntity,
    NotificationEntity,
  ],
  migrations: [
    CreateAmenities1793696400000,
    RemoveAmenityType1793696500000,
    CreateRooms1793696600000,
    CreateUsers1793696700000,
    CreateHotelOwners1793696800000,
    AddUserRolesSoftDeleteAndItineraries1793696900000,
    CreatePlaces1793696900000,
    CreateCancellationPolicies1793697000000,
    CreateBookings1793697100000,
    UseGenericVnpayPayment1793697200000,
    CompleteBookingStayDetails1793697300000,
    AddBookingReservationExpiry1793697400000,
    CreateBookingIdempotencyKeys1793697500000,
    CreateHotels1793697600000,
    AlignAuthenticationSchema1793898000000,
    AddHotelScopedAmenities1793898100000,
    AddCancellationPolicyRanges1793898200000,
    CreateReviews1793898300000,
    CreateHotelImages1794400000000,
    AddUserTwoFactorFlag1794400001000,
    AddHotelOwnerTimestamps1794400002000,
    ExpandPlaceCatalog1794500000000,
    CreatePlaceCatalogRelations1794500000500,
    BackfillPlaceCatalog1794500001000,
    NormalizeImages1794500002000,
    AlignPlacesSchema1794400003000,
    RequireCancellationPolicySnapshot1794400004000,
    UseHoursAfterBookingForCancellation1794400005000,
    SimplifyCancellationPolicies1794400006000,
    CompleteManualBookingRefundWorkflow1794400007000,
    UseSePayV2SandboxOrders1794400008000,
    CreateNotifications1794400009000,
    CreateTravelPreferences1794500003000,
    AddItineraryDestinationCity1794500004000,
    CreateSettlementBatches1794500005000,
    CreateSettlementBatchEvents1794500006000,
    CreateUserFavorites1794500007000,
  ],
  synchronize: false,
  logging: false,
});
