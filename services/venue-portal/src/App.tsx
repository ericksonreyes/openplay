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
  PriceDetailPage,
  FacilityRuleDetailPage,
  ClosureDetailPage,
} from './pages/catalog';
import { WaiversPage, WaiverVersionsPage, WaiverDetailPage } from './pages/Waivers';
import { DisputesPage, MembershipPlanDetailPage, MembershipPlansPage, PaymentsPage } from './pages/money';
import { EquipmentPage, RentalsPage } from './pages/inventory';
import { StaffPage } from './pages/Staff';
import { NotificationsPage } from './pages/Notifications';
import { RuleAcknowledgmentsPage, WaiverSignaturesPage } from './pages/Consent';
import { HistoryPage } from './pages/History';
import { HolidaysPage } from './pages/Holidays';
import { RecordDetailPage } from './pages/RecordDetailPage';

import { ResourceDetailPage } from './pages/ResourceDetailPage';
import { VenueDetailPage } from './pages/VenueDetailPage';
import { ActivityDetailPage } from './pages/ActivityDetailPage';
import { ReservationDetailPage } from './pages/ReservationDetailPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { DisputeDetailPage } from './pages/DisputeDetailPage';
import { EquipmentDetailPage } from './pages/EquipmentDetailPage';
import { StaffDetailPage } from './pages/StaffDetailPage';
import { CustomersPage } from './pages/Customers';

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
            <Route path="history/:streamType/:streamId" element={<HistoryPage />} />
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
            <Route path="catalog/prices/:id" element={<PriceDetailPage />} />
            <Route path="catalog/facility-rules" element={<FacilityRulesPage />} />
            <Route path="catalog/facility-rules/:id" element={<FacilityRuleDetailPage />} />
            <Route path="catalog/closures" element={<ClosuresPage />} />
            <Route path="catalog/closures/:id" element={<ClosureDetailPage />} />
            <Route path="catalog/holidays" element={<HolidaysPage />} />
            <Route path="catalog/waivers" element={<WaiversPage />} />
            <Route path="catalog/waivers/:id" element={<WaiverDetailPage />} />
            <Route path="catalog/waivers/:waiverId/versions" element={<WaiverVersionsPage />} />
            <Route path="membership-plans" element={<MembershipPlansPage />} />
            <Route path="membership-plans/:id" element={<MembershipPlanDetailPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="disputes" element={<DisputesPage />} />
            <Route path="disputes/:id" element={<DisputeDetailPage />} />
            <Route path="equipment" element={<EquipmentPage />} />
            <Route path="equipment/:id" element={<EquipmentDetailPage />} />
            <Route path="rentals" element={<RentalsPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="staff/:id" element={<StaffDetailPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="notifications/:id" element={<RecordDetailPage path="/notifications" type="notifications" entity="Notification" canEdit={false} canDelete={false} backTo="/notifications" />} />
            <Route path="consent" element={<Navigate to="/consent/rules" replace />} />
            <Route path="consent/rules" element={<RuleAcknowledgmentsPage />} />
            <Route path="consent/waivers" element={<WaiverSignaturesPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
