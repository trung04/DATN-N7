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
const Bookings = lazy(() => import('@/features/bookings/pages').then(m => ({ default: m.BookingsPage })))
const BookingDetail = lazy(() => import('@/features/bookings/pages').then(m => ({ default: m.BookingDetailPage })))
const Payment = lazy(() => import('@/features/bookings/pages').then(m => ({ default: m.PaymentPage })))
const PaymentResult = lazy(() => import('@/features/bookings/pages').then(m => ({ default: m.PaymentResultPage })))
const PartnerHome = lazy(() => import('@/features/partner/pages').then(m => ({ default: m.PartnerDashboard })))
const PartnerRooms = lazy(() => import('@/features/partner/pages').then(m => ({ default: m.PartnerRoomsPage })))
const PartnerRoomForm = lazy(() => import('@/features/partner/pages').then(m => ({ default: m.PartnerRoomFormPage })))
const PartnerInventory = lazy(() => import('@/features/partner/pages').then(m => ({ default: m.PartnerInventoryPage })))
const AdminHome = lazy(() => import('@/features/admin/dashboard').then(m => ({ default: m.AdminDashboard })))
const AdminPartners = lazy(() => import('@/features/admin/pages').then(m => ({ default: m.AdminPartnersPage })))
const AdminPartnerDetail = lazy(() => import('@/features/admin/pages').then(m => ({ default: m.AdminPartnerDetailPage })))
const AdminServices = lazy(() => import('@/features/admin/pages').then(m => ({ default: m.AdminServicesPage })))
const AdminCategories = lazy(() => import('@/features/admin/pages').then(m => ({ default: m.AdminCategoriesPage })))
const AdminReviews = lazy(() => import('@/features/admin/pages').then(m => ({ default: m.AdminReviewsPage })))
const AdminReviewDetail = lazy(() => import('@/features/admin/pages').then(m => ({ default: m.AdminReviewDetailPage })))
const AdminReports = lazy(() => import('@/features/admin/pages').then(m => ({ default: m.AdminReportsPage })))
const AdminSettlements = lazy(() => import('@/features/admin/pages').then(m => ({ default: m.AdminSettlementsPage })))
const AdminSettlementDetail = lazy(() => import('@/features/admin/pages').then(m => ({ default: m.AdminSettlementDetailPage })))

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
    <Route element={<Guard role="partner" />}><Route path="/partner" element={<DashboardLayout kind="partner" />}><Route index element={<PartnerHome />} /><Route path="rooms" element={<PartnerRooms />} /><Route path="rooms/new" element={<PartnerRoomForm />} /><Route path="rooms/:id/edit" element={<PartnerRoomForm />} /><Route path="rooms/:id/inventory" element={<PartnerInventory />} /></Route></Route>
    <Route element={<Guard role="admin" />}><Route path="/admin" element={<DashboardLayout kind="admin" />}><Route index element={<AdminHome />} /><Route path="partners" element={<AdminPartners />} /><Route path="partners/:id" element={<AdminPartnerDetail />} /><Route path="services" element={<AdminServices />} /><Route path="service-categories" element={<AdminCategories />} /><Route path="reviews" element={<AdminReviews />} /><Route path="reviews/:id" element={<AdminReviewDetail />} /><Route path="reports" element={<AdminReports />} /><Route path="settlements" element={<AdminSettlements />} /><Route path="settlements/:id" element={<AdminSettlementDetail />} /></Route></Route>
  </Routes></Suspense>
}
