import { Body, Controller, Headers, Param, Post } from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { RecordNotFoundException } from '../common/errors/api-error';
import { PaymentWebhooksService } from './payment-webhooks.service';

const PROVIDERS = new Set(['gcash', 'maya']);

/**
 * Provider webhooks — public route, signature-verified inside the stub
 * adapter, and idempotent. The contract names concrete paths
 * (/webhooks/payments/gcash, /webhooks/payments/maya); the :provider
 * param is constrained to exactly that set, unknown names are 404s.
 */
@Controller('webhooks/payments')
export class PaymentWebhooksController {
  constructor(private readonly webhooks: PaymentWebhooksService) {}

  @Public()
  @Post(':provider')
  async receive(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: unknown,
  ) {
    if (!PROVIDERS.has(provider)) {
      throw new RecordNotFoundException();
    }
    const flat: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(headers)) {
      flat[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
    }
    const result = await this.webhooks.handle(provider, flat, payload);
    return {
      type: 'webhook-receipt',
      id: provider,
      attributes: { processed: result.processed, outcome: result.outcome ?? null },
    };
  }
}
