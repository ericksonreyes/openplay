import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { generateCredential } from './credentials';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export interface IssuedCredential {
  tokenId: string;
  token: string;
  expiresAt: Date;
}

/**
 * Single-use credential tokens (recovery | invite) plus the local-dev
 * "delivery" path: a `notifications` row (channel 'email') that the worker
 * sends through Mailpit. All callers run under SystemContextService —
 * `auth_tokens` is system/platform-only by RLS and `notifications` needs a
 * tenant bypass for platform-scope users (tenant_id NULL).
 */
@Injectable()
export class AuthFlowService {
  async issueToken(
    tx: Tx,
    input: { userId: string; kind: 'recovery' | 'invite' | 'refresh'; ttlMs: number },
  ): Promise<IssuedCredential> {
    const { token, tokenHash } = generateCredential();
    const tokenId = uuidv7();
    const expiresAt = new Date(Date.now() + input.ttlMs);
    await tx.$executeRaw`
      INSERT INTO "auth_tokens"
        ("id", "user_id", "kind", "token_hash", "expires_at", "created_at")
      VALUES
        (${tokenId}::uuid, ${input.userId}::uuid, ${input.kind}, ${tokenHash}, ${expiresAt}, now())
    `;
    return { tokenId, token, expiresAt };
  }

  /** Finds the newest unconsumed, unexpired token row for a presented hash. */
  async findUsableToken(tx: Tx, kind: string, tokenHash: string) {
    const rows = await tx.$queryRaw<
      { id: string; user_id: string; expires_at: Date; consumed_at: Date | null }[]
    >`
      SELECT "id", "user_id", "expires_at", "consumed_at"
      FROM "auth_tokens"
      WHERE "kind" = ${kind} AND "token_hash" = ${tokenHash}
      ORDER BY "created_at" DESC
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || row.consumed_at !== null || row.expires_at.getTime() <= Date.now()) {
      return null;
    }
    return row;
  }

  async consumeToken(tx: Tx, tokenId: string): Promise<void> {
    await tx.$executeRaw`
      UPDATE "auth_tokens" SET "consumed_at" = now() WHERE "id" = ${tokenId}::uuid
    `;
  }

  /**
   * Local-dev delivery: the notification worker renders `kind` + `payload`
   * and emails `recipient_address` via Mailpit. `tenantId` may be null for
   * platform-scope auth mail (migration 008 relaxes the column).
   */
  async queueAuthEmail(
    tx: Tx,
    input: {
      tenantId: string | null;
      recipientUserId: string | null;
      recipientAddress: string | null;
      kind: 'auth.recovery' | 'auth.invite';
      payload: Record<string, unknown>;
      idempotencyKey: string;
    },
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO "notifications"
        ("id", "tenant_id", "recipient_user_id", "recipient_address", "channel",
         "kind", "payload", "status", "idempotency_key", "created_at", "updated_at")
      VALUES
        (${uuidv7()}::uuid, ${input.tenantId}::uuid, ${input.recipientUserId}::uuid,
         ${input.recipientAddress}, 'email', ${input.kind},
         ${JSON.stringify(input.payload)}::jsonb, 'pending', ${input.idempotencyKey},
         now(), now())
    `;
  }

  /** Venue ids assigned to a staff user (join table gates via iam_users). */
  async venueIdsFor(tx: Tx, userId: string): Promise<string[]> {
    const rows = await tx.$queryRaw<{ venue_id: string }[]>(
      Prisma.sql`SELECT "venue_id" FROM "staff_venue_assignments" WHERE "user_id" = ${userId}::uuid`,
    );
    return rows.map((r) => r.venue_id);
  }
}
