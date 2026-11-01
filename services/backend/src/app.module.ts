import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { AuditModule } from './common/audit/audit.module';
import { AuthModule } from './common/auth/auth.module';
import { RateLimitGuard } from './common/rate-limit/rate-limit.guard';
import { ContextModule } from './common/context/context.module';
import { RlsContextInterceptor } from './common/context/rls-context.interceptor';
import { JsonApiInterceptor } from './common/jsonapi/jsonapi.interceptor';
import { LoggingModule } from './common/logging/logging.module';
import { ConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { IamModule } from './iam/iam.module';
import { PrismaModule } from './prisma/prisma.module';
import { PublicModule } from './public/public.module';
import { TenantsModule } from './tenants/tenants.module';
import { NotificationsModule } from './notifications/notifications.module';
import { VenueCatalogModule } from './venue-catalog/venue-catalog.module';
import { CommerceModule } from './commerce/commerce.module';
import { BookingModule } from './booking/booking.module';
import { EventsModule } from './events/events.module';
import { PublicContentModule } from './public-content/public-content.module';
import { PlatformModule } from './platform/platform.module';
import { AssistantModule } from './assistant/assistant.module';

@Module({
  imports: [
    // Context is opened by requestIdMiddleware (src/common/request-id.middleware.ts).
    ClsModule.forRoot({ global: true }),
    ConfigModule,
    LoggingModule,
    PrismaModule,
    AuditModule,
    ContextModule,
    AuthModule,
    HealthModule,
    PublicModule,
    IamModule,
    TenantsModule,
    NotificationsModule,
    VenueCatalogModule,
    CommerceModule,
    BookingModule,
    EventsModule,
    PublicContentModule,
    PlatformModule,
    AssistantModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: RlsContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: JsonApiInterceptor },
  ],
})
export class AppModule {}
