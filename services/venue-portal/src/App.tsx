import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './auth/auth';
import { SignInPage } from './auth/SignInPage';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { SettingsPage } from './pages/Settings';
import { SchedulePage } from './pages/Schedule';
import { ReservationsPage } from './pages/Reservations';
import { CheckInsPage } from './pages/CheckIns';
import { EventsPage, EventRegistrationsPage } from './pages/Events';
import {
  ActivitiesPage,
  ClosuresPage,
  FacilityRulesPage,
  PricesPage,
  ResourcesPage,
  VenuesPage,
} from './pages/catalog';
import { WaiversPage, WaiverVersionsPage } from './pages/Waivers';
import { DisputesPage, MembershipPlansPage, PaymentsPage } from './pages/money';
import { EquipmentPage, RentalsPage } from './pages/inventory';
import { StaffPage } from './pages/Staff';
import { NotificationsPage } from './pages/Notifications';
import { ConsentPage } from './pages/Consent';
import { ResourceDetailPage } from './pages/ResourceDetailPage';
import { VenueDetailPage } from './pages/VenueDetailPage';
import { ActivityDetailPage } from './pages/ActivityDetailPage';
import { ReservationDetailPage } from './pages/ReservationDetailPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { DisputeDetailPage } from './pages/DisputeDetailPage';
import { EquipmentDetailPage } from './pages/EquipmentDetailPage';
import { StaffDetailPage } from './pages/StaffDetailPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="reservations/:id" element={<ReservationDetailPage />} />
            <Route path="check-ins" element={<CheckInsPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="events/:id" element={<EventDetailPage />} />
            <Route path="events/:eventId/registrations" element={<EventRegistrationsPage />} />
            <Route path="catalog/venues" element={<VenuesPage />} />
            <Route path="catalog/venues/:id" element={<VenueDetailPage />} />
            <Route path="catalog/resources" element={<ResourcesPage />} />
            <Route path="catalog/resources/:id" element={<ResourceDetailPage />} />
            <Route path="catalog/activities" element={<ActivitiesPage />} />
            <Route path="catalog/activities/:id" element={<ActivityDetailPage />} />
            <Route path="catalog/prices" element={<PricesPage />} />
            <Route path="catalog/facility-rules" element={<FacilityRulesPage />} />
            <Route path="catalog/closures" element={<ClosuresPage />} />
            <Route path="catalog/waivers" element={<WaiversPage />} />
            <Route path="catalog/waivers/:waiverId/versions" element={<WaiverVersionsPage />} />
            <Route path="membership-plans" element={<MembershipPlansPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="disputes" element={<DisputesPage />} />
            <Route path="disputes/:id" element={<DisputeDetailPage />} />
            <Route path="equipment" element={<EquipmentPage />} />
            <Route path="equipment/:id" element={<EquipmentDetailPage />} />
            <Route path="rentals" element={<RentalsPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="staff/:id" element={<StaffDetailPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="consent" element={<ConsentPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
