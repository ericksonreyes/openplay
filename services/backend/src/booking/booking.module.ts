import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { ReservationsController } from './reservations.controller';
import { CheckInsController } from './check-ins.controller';
import { GuestBookingsController } from './guest-bookings.controller';
import { GuestContactsController } from './guest-contacts.controller';
import { ConsentController } from './consent.controller';
import { ScheduleController } from './schedule.controller';
import { RecurringController } from './recurring.controller';
import { BookingService } from './booking.service';
import { GuestBookingService } from './guest-booking.service';
import { ConsentService } from './consent.service';
import { RecurringService } from './recurring.service';

@Module({
  controllers: [
    AvailabilityController,
    ReservationsController,
    CheckInsController,
    GuestBookingsController,
  GuestContactsController,
    ConsentController,
    ScheduleController,
    RecurringController,
  ],
  providers: [BookingService, GuestBookingService, ConsentService, RecurringService],
  exports: [BookingService],
})
export class BookingModule {}
