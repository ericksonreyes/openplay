import { referencePrefix } from './commerce.types';

type RawTx = {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

/**
 * Allocates the next per-tenant display reference (PAY-00042, …).
 * The counter row is upserted atomically inside the caller's transaction,
 * so concurrent writers can never draw the same number. References are
 * display labels only — never record identifiers (IDENTIFIERS.MD).
 */
export async function nextReference(tx: RawTx, tenantId: string, kind: string): Promise<string> {
  const prefix = referencePrefix(kind);
  const rows = await tx.$queryRaw<[{ value: bigint }]>`
    INSERT INTO "reference_counters" ("tenant_id", "kind", "value")
    VALUES (${tenantId}::uuid, ${kind}, 1)
    ON CONFLICT ("tenant_id", "kind")
    DO UPDATE SET "value" = "reference_counters"."value" + 1
    RETURNING "value"
  `;
  return `${prefix}-${rows[0].value.toString().padStart(5, '0')}`;
}
