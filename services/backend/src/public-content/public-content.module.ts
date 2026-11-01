import { Module } from '@nestjs/common';
import { PublicContentController } from './public-content.controller';
import { PublicContentService } from './public-content.service';

/**
 * Public content module: anonymous, read-only endpoints for the public site.
 * SystemContextService is global (ContextModule). The dedicated public
 * rate-limit bucket required by PUBLIC_CONTENT.MD is throttle configuration
 * owned by the app wiring (app.module/main.ts), not this module.
 */
@Module({
  controllers: [PublicContentController],
  providers: [PublicContentService],
})
export class PublicContentModule {}
