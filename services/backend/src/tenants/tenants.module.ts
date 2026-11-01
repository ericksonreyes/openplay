import { Module } from '@nestjs/common';
import { PlatformTenantsController } from './platform-tenants.controller';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';

@Module({
  controllers: [TenantsController, PlatformTenantsController],
  providers: [TenantsService],
})
export class TenantsModule {}
