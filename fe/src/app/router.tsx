import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { LoadingState } from '@/components/common'
import { AuthLayout, DashboardLayout, NotFound, TouristLayout } from './layouts'
import { useSession } from '@/stores/session'
import type { Role } from '@/types/domain'

const Home = lazy(() => import('@/features/public/home').then(m => ({ default: m.HomePage })))
const Explore = lazy(() => import('@/features/public/catalog').then(m => ({ default: m.ExplorePage })))
const DestinationDetail = lazy(() => import('@/features/public/catalog').then(m => ({ default: m.DestinationDetailPage })))
const Hotels = lazy(() => import('@/features/public/catalog').then(m => ({ default: m.HotelsPage })))
const HotelDetail = lazy(() => import('@/features/public/catalog').then(m => ({ default: m.HotelDetailPage })))
const Restaurants = lazy(() => import('@/features/public/catalog').then(m => ({ default: m.RestaurantsPage })))
const RestaurantDetail = lazy(() => import('@/features/public/catalog').then(m => ({ default: m.RestaurantDetailPage })))
const Profile = lazy(() => import('@/features/public/account').then(m => ({ default: m.ProfilePage })))
const Preferences = lazy(() => import('@/features/public/account').then(m => ({ default: m.PreferencesPage })))
const Favorites = lazy(() => import('@/features/public/account').then(m => ({ default: m.FavoritesPage })))
const Recommendations = lazy(() => import('@/features/public/account').then(m => ({ default: m.RecommendationsPage })))
const Login = lazy(() => import('@/features/auth/pages').then(m => ({ default: m.LoginPage })))
const Register = lazy(() => import('@/features/auth/pages').then(m => ({ default: m.RegisterPage })))
const VerifyOtp = lazy(() => import('@/features/auth/pages').then(m => ({ default: m.VerifyOtpPage })))
const ForgotPassword = lazy(() => import('@/features/auth/pages').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPassword = lazy(() => import('@/features/auth/pages').then(m => ({ default: m.ResetPasswordPage })))
const Planner = lazy(() => import('@/features/trips/planner').then(m => ({ default: m.PlannerPage })))
const Trips = lazy(() => import('@/features/trips/pages').then(m => ({ default: m.TripsPage })))
const TripForm = lazy(() => import('@/features/trips/pages').then(m => ({ default: m.TripFormPage })))
const TripDetail = lazy(() => import('@/features/trips/pages').then(m => ({ default: m.TripDetailPage })))
const BookingNew = lazy(() => import('@/features/bookings/pages').then(m => ({ default: m.BookingNewPage })))
const PartnerBookings = lazy(() => import('@/features/bookings/management').then(m => ({ default: m.BookingManagementPage })))
const AdminBookings = lazy(() => import('@/features/bookings/management').then(m => ({ default: () => <m.BookingManagementPage admin /> })))
const Bookings = lazy(() => import('@/features/bookings/pages').then(m => ({ default: m.BookingsPage })))
const BookingDetail = lazy(() => import('@/features/bookings/pages').then(m => ({ default: m.BookingDetailPage })))
const Payment = lazy(() => import('@/features/bookings/pages').then(m => ({ default: m.PaymentPage })))
const PaymentResult = lazy(() => import('@/features/bookings/pages').then(m => ({ default: m.PaymentResultPage })))
const PartnerHome = lazy(() => import('@/features/partner/rooms').then(m => ({ default: m.PartnerOverviewPage })))
const PartnerHotels = lazy(() => import('@/features/partner/hotels').then(m => ({ default: m.PartnerHotelsPage })))
const PartnerHotelForm = lazy(() => import('@/features/partner/hotels').then(m => ({ default: m.PartnerHotelFormPage })))
const PartnerRooms = lazy(() => import('@/features/partner/rooms').then(m => ({ default: m.PartnerRoomsPage })))
const PartnerRoomForm = lazy(() => import('@/features/partner/rooms').then(m => ({ default: m.PartnerRoomFormPage })))
const PartnerProfile = lazy(() => import('@/features/partner/profile').then(m => ({ default: m.PartnerProfilePage })))
const PartnerAmenities = lazy(() => import('@/features/partner/amenities').then(m => ({ default: m.PartnerAmenitiesPage })))
const PartnerCancellationPolicies = lazy(() => import('@/features/partner/cancellation-policies').then(m => ({ default: m.CancellationPoliciesPage })))
const PartnerReviews = lazy(() => import('@/features/reviews/management').then(m => ({ default: m.ReviewManagementPage })))
const AdminReviews = lazy(() => import('@/features/reviews/management').then(m => ({ default: () => <m.ReviewManagementPage admin /> })))
const AdminHome = lazy(() => import('@/features/admin/overview').then(m => ({ default: m.AdminOverviewPage })))
const AdminHotels = lazy(() => import('@/features/admin/hotels').then(m => ({ default: m.AdminHotelsPage })))
const AdminHotelDetail = lazy(() => import('@/features/admin/hotels').then(m => ({ default: m.AdminHotelDetailPage })))
const AdminUsers = lazy(() => import('@/features/admin/users').then(m => ({ default: m.AdminUsersPage })))
const AdminPartners = lazy(() => import('@/features/admin/hotel-owners').then(m => ({ default: m.AdminHotelOwnersPage })))
const AdminAmenities = lazy(() => import('@/features/admin/amenities').then(m => ({ default: m.AdminAmenitiesPage })))
const AdminCancellationPolicies = lazy(() => import('@/features/partner/cancellation-policies').then(m => ({ default: () => <m.CancellationPoliciesPage admin /> })))
const PartnerReports = lazy(() => import('@/features/reports/dashboard').then(m => ({ default: m.ReportDashboardPage })))
const AdminReports = lazy(() => import('@/features/reports/dashboard').then(m => ({ default: () => <m.ReportDashboardPage admin /> })))

function Guard({ role }: { role: Role }) {
  const user = useSession(s => s.user)
  const location = useLocation()
  if (!user) return <Navigate replace to={'/auth/login?returnTo=' + encodeURIComponent(location.pathname + location.search)} />
  if (user.role !== role) return <Navigate replace to="/403" />
  return <Outlet />
}
export function AppRouter() {
  return <Suspense fallback={<LoadingState />}><Routes>
    <Route element={<TouristLayout />}>
      <Route index element={<Home />} />
      <Route path="/explore" element={<Explore />} /><Route path="/explore/:id" element={<DestinationDetail />} />
      <Route path="/hotels" element={<Hotels />} /><Route path="/hotels/:id" element={<HotelDetail />} />
      <Route path="/restaurants" element={<Restaurants />} /><Route path="/restaurants/:id" element={<RestaurantDetail />} />
      <Route path="/ai/recommendations" element={<Recommendations />} /><Route path="/ai/trip-planner" element={<Planner />} />
      <Route element={<Guard role="tourist" />}>
        <Route path="/profile" element={<Profile />} /><Route path="/preferences" element={<Preferences />} /><Route path="/favorites" element={<Favorites />} />
        <Route path="/trips" element={<Trips />} /><Route path="/trips/new" element={<TripForm />} /><Route path="/trips/:id" element={<TripDetail />} /><Route path="/trips/:id/edit" element={<TripForm />} />
        <Route path="/bookings/new" element={<BookingNew />} /><Route path="/bookings" element={<Bookings />} /><Route path="/bookings/:id" element={<BookingDetail />} /><Route path="/bookings/:id/payment" element={<Payment />} /><Route path="/bookings/:id/payment-result" element={<PaymentResult />} />
      </Route>
      <Route path="/403" element={<NotFound forbidden />} /><Route path="*" element={<NotFound />} />
    </Route>
    <Route path="/auth" element={<AuthLayout />}><Route path="login" element={<Login />} /><Route path="register" element={<Register />} /><Route path="verify-otp" element={<VerifyOtp />} /><Route path="forgot-password" element={<ForgotPassword />} /><Route path="reset-password" element={<ResetPassword />} /></Route>
    <Route element={<Guard role="partner" />}><Route path="/partner" element={<DashboardLayout kind="partner" />}><Route index element={<PartnerHome />} /><Route path="hotels" element={<PartnerHotels />} /><Route path="hotels/new" element={<PartnerHotelForm />} /><Route path="hotels/:id/edit" element={<PartnerHotelForm />} /><Route path="rooms" element={<PartnerRooms />} /><Route path="rooms/new" element={<PartnerRoomForm />} /><Route path="rooms/:id/edit" element={<PartnerRoomForm />} /><Route path="amenities" element={<PartnerAmenities />} /><Route path="cancellation-policies" element={<PartnerCancellationPolicies />} /><Route path="bookings" element={<PartnerBookings />} /><Route path="reviews" element={<PartnerReviews />} /><Route path="reports" element={<PartnerReports />} /><Route path="profile" element={<PartnerProfile />} /></Route></Route>
    <Route element={<Guard role="admin" />}><Route path="/admin" element={<DashboardLayout kind="admin" />}><Route index element={<AdminHome />} /><Route path="users" element={<AdminUsers />} /><Route path="partners" element={<AdminPartners />} /><Route path="hotels" element={<AdminHotels />} /><Route path="hotels/:id" element={<AdminHotelDetail />} /><Route path="amenities" element={<AdminAmenities />} /><Route path="cancellation-policies" element={<AdminCancellationPolicies />} /><Route path="bookings" element={<AdminBookings />} /><Route path="reviews" element={<AdminReviews />} /><Route path="reports" element={<AdminReports />} /></Route></Route>
  </Routes></Suspense>
}
