import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ActorContextService } from '../common/auth/actor-context.service';
import { TokenBlacklistService } from '../common/auth/token-blacklist.service';
import { AuthFlowService } from './auth-flow.service';
import { SystemContextService } from '../common/context/system-context.service';
import { hashCredential } from './credentials';

/** POST /api/v1/auth/sign-out — revoke the caller's token (jti blacklist). */
@Controller('auth')
export class SignOutController {
  constructor(
    private readonly actorContext: ActorContextService,
    private readonly blacklist: TokenBlacklistService,
    private readonly flows: AuthFlowService,
    private readonly system: SystemContextService,
  ) {}

  @Post('sign-out')
  @HttpCode(200)
  async signOut(@Body() body?: { refresh_token?: string }): Promise<{ type: string; attributes: { revoked: boolean } }> {
    const actor = this.actorContext.actor;
    const remaining = Math.max(0, (actor.exp ?? 0) - Math.floor(Date.now() / 1000));
    if (actor.jti && remaining > 0) {
      await this.blacklist.revoke(actor.jti, remaining);
    }
    // Kill the refresh token too so the session can't be silently renewed.
    if (typeof body?.refresh_token === 'string' && body.refresh_token) {
      const hash = hashCredential(body.refresh_token);
      await this.system.run(async (tx) => {
        const row = await this.flows.findUsableToken(tx, 'refresh', hash);
        if (row) await this.flows.consumeToken(tx, row.id);
      });
    }
    return { type: 'session', attributes: { revoked: true } };
  }
}
