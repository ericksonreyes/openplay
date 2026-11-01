import { BadRequestException } from '@nestjs/common';

/** Tenant codes: lowercase slug, 3–32 chars, no leading/trailing dash. */
export const TENANT_CODE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX = 500;

export interface TenantSubmission {
  code: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  message?: string;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Validates the public POST /tenants body; throws 400 on any violation. */
export function validateTenantSubmission(body: unknown): TenantSubmission {
  const b = (body ?? {}) as Record<string, unknown>;
  const owner = (b.owner ?? {}) as Record<string, unknown>;

  const code = str(b.code);
  const name = str(b.name);
  const ownerName = str(owner.name);
  const ownerEmail = str(owner.email).toLowerCase();
  const message = str(b.message) || undefined;

  if (!TENANT_CODE.test(code)) {
    throw new BadRequestException(
      'code must be 3-32 chars of lowercase letters, digits, and dashes',
    );
  }
  if (!name || name.length > 200) {
    throw new BadRequestException('name is required (max 200 chars)');
  }
  if (!ownerName || ownerName.length > 200) {
    throw new BadRequestException('owner.name is required (max 200 chars)');
  }
  if (!EMAIL.test(ownerEmail)) {
    throw new BadRequestException('owner.email must be a valid email address');
  }
  if (message && message.length > 2000) {
    throw new BadRequestException('message is too long (max 2000 chars)');
  }

  return { code, name, ownerName, ownerEmail, message };
}

export interface TransitionInput {
  reason?: string;
  purpose: string;
}

/**
 * Validates a lifecycle-transition body. `reason` is mandatory for suspend;
 * `purpose` satisfies the platform-access audit rule (defaults applied).
 */
export function validateTransition(
  body: unknown,
  opts: { reasonRequired: boolean; defaultPurpose: string },
): TransitionInput {
  const b = (body ?? {}) as Record<string, unknown>;
  const reason = str(b.reason) || undefined;
  const purpose = str(b.purpose) || opts.defaultPurpose;

  if (opts.reasonRequired && !reason) {
    throw new BadRequestException('reason is required');
  }
  if (reason && reason.length > MAX) {
    throw new BadRequestException(`reason is too long (max ${MAX} chars)`);
  }
  return { reason, purpose };
}
