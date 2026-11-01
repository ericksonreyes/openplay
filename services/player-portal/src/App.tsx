import { Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { RequireAuth } from './auth/RequireAuth';
import { Layout } from './components/Layout';
import { BookPage } from './pages/BookPage';
import PaymentDetailPage from './pages/PaymentDetailPage';
import { CheckInPage } from './pages/CheckInPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { EventsPage } from './pages/EventsPage';
import { GuestBookingPage } from './pages/GuestBookingPage';
import { HomePage } from './pages/HomePage';
import { MembershipsPage } from './pages/MembershipsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { RentalsPage } from './pages/RentalsPage';
import { ReservationDetailPage } from './pages/ReservationDetailPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { VenueDetailPage } from './pages/VenueDetailPage';
import { VenuesPage } from './pages/VenuesPage';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route path="/sign-up" element={<SignUpPage />} />
          <Route path="/guest-booking" element={<GuestBookingPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/venues"
            element={
              <RequireAuth>
                <VenuesPage />
              </RequireAuth>
            }
          />
          <Route
            path="/venues/:id"
            element={
              <RequireAuth>
                <VenueDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/book/:venueId"
            element={
              <RequireAuth>
                <BookPage />
              </RequireAuth>
            }
          />
          <Route
            path="/reservations"
            element={
              <RequireAuth>
                <ReservationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/reservations/:id"
            element={
              <RequireAuth>
                <ReservationDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/payments/:id"
            element={
              <RequireAuth>
                <PaymentDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events"
            element={
              <RequireAuth>
                <EventsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/events/:id"
            element={
              <RequireAuth>
                <EventDetailPage />
              </RequireAuth>
            }
          />
          <Route
            path="/memberships"
            element={
              <RequireAuth>
                <MembershipsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/rentals"
            element={
              <RequireAuth>
                <RentalsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/notifications"
            element={
              <RequireAuth>
                <NotificationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/check-in"
            element={
              <RequireAuth>
                <CheckInPage />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
