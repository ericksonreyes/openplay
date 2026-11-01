import { Module } from '@nestjs/common';
import { VenuesController } from './venues.controller';
import { ResourcesController } from './resources.controller';
import { ActivitiesController } from './activities.controller';
import { PricesController } from './prices.controller';
import { FacilityRulesController } from './facility-rules.controller';
import { ClosuresController } from './closures.controller';
import { WaiversController } from './waivers.controller';
import { VenueCatalogService } from './venue-catalog.service';

@Module({
  controllers: [
    VenuesController,
    ResourcesController,
    ActivitiesController,
    PricesController,
    FacilityRulesController,
    ClosuresController,
    WaiversController,
  ],
  providers: [VenueCatalogService],
})
export class VenueCatalogModule {}
