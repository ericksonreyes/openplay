import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ActorContextService } from './actor-context.service';
import { AuthGuard } from './auth.guard';
import { JwtService } from './jwt.service';
import { TokenBlacklistService } from './token-blacklist.service';

@Global()
@Module({
  providers: [
    JwtService,
    TokenBlacklistService,
    ActorContextService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [ActorContextService, JwtService, TokenBlacklistService],
})
export class AuthModule {}
