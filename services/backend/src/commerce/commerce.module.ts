import { Module } from '@nestjs/common';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { EquipmentController } from './equipment.controller';
import { MembershipPlansController } from './membership-plans.controller';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaymentWebhooksService } from './payment-webhooks.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RentalsController } from './rentals.controller';
import { RentalsService } from './rentals.service';
import { StubPaymentProviderRegistry } from './providers/stub-payment.provider';

@Module({
  controllers: [
    MembershipPlansController,
    MembershipsController,
    PaymentsController,
    PaymentWebhooksController,
    EquipmentController,
    RentalsController,
    DisputesController,
  ],
  providers: [
    MembershipsService,
    PaymentsService,
    PaymentWebhooksService,
    RentalsService,
    DisputesService,
    StubPaymentProviderRegistry,
  ],
})
export class CommerceModule {}
