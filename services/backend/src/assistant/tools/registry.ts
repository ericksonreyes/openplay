import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RequestActor } from '../../common/auth/actor';
import { BookingDb } from '../../booking/booking.types';
import { CatalogDb } from '../../venue-catalog/catalog.types';
import {
  AssistantToolCall,
  AssistantToolSpec,
  MAX_TOOL_RESULT_CHARS,
  PREFILL_MARKER,
} from '../assistant.types';
import { readTools } from './read-tools';
import { prefillTools } from './prefill-reservation';

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/** The post-merge delegate subset the assistant tools are allowed to read. */
export type AssistantDb = CatalogDb & BookingDb;
export type AssistantTx = TxClient & AssistantDb;

export const asAssistantDb = (client: TxClient): AssistantTx =>
  client as unknown as AssistantTx;

export interface ToolContext {
  tx: AssistantTx;
  actor: RequestActor;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<unknown>;

export interface ToolDefinition {
  spec: AssistantToolSpec;
  handler: ToolHandler;
}

/**
 * Arg keys that could smuggle a scope override. Scope always comes from the
 * verified actor — never from model- or user-supplied arguments
 * (AI_GOVERNANCE identity rules). Stripped before handlers see the args.
 */
const FORBIDDEN_ARG_KEYS = new Set([
  'tenant_id',
  'tenantId',
  'user_id',
  'userId',
  'player_id',
  'playerId',
  'guest_contact_id',
  'guestContactId',
  'created_by',
  'createdBy',
  'actor',
  'scope',
]);

export const sanitizeArgs = (
  args: Record<string, unknown>,
): Record<string, unknown> => {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args ?? {})) {
    if (FORBIDDEN_ARG_KEYS.has(key)) continue;
    clean[key] = value;
  }
  return clean;
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
};

const capResult = (result: unknown): string => {
  const json = JSON.stringify(result ?? null);
  return json.length > MAX_TOOL_RESULT_CHARS
    ? `${json.slice(0, MAX_TOOL_RESULT_CHARS)}…[truncated]`
    : json;
};

/**
 * Allowlisted tool registry. Only names present here may execute — unknown
 * tool calls from the provider are ignored and logged. All handlers are
 * read-only or unsaved-prefill by construction.
 */
export class AssistantToolRegistry {
  private readonly logger = new Logger(AssistantToolRegistry.name);
  private readonly tools = new Map<string, ToolDefinition>();

  constructor() {
    for (const tool of [...readTools(), ...prefillTools()]) {
      this.tools.set(tool.spec.name, tool);
    }
  }

  specs(): AssistantToolSpec[] {
    return [...this.tools.values()].map((t) => t.spec);
  }

  /**
   * Execute one provider-requested tool call under the caller's scope.
   * Returns { content, prefill? } where content is a size-capped JSON string
   * safe to embed in the model context (wrapped in delimiters by the caller).
   * Unknown names return an error payload instead of executing anything.
   */
  async dispatch(
    call: AssistantToolCall,
    ctx: ToolContext,
    dedupe: Map<string, string>,
  ): Promise<{ content: string; prefill?: { form: string; fields: Record<string, unknown> } }> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      this.logger.warn(`ignoring unknown assistant tool call: ${call.name}`);
      return { content: JSON.stringify({ error: 'unknown_tool' }) };
    }
    const args = sanitizeArgs(call.args ?? {});
    const key = `${call.name}:${stableStringify(args)}`;
    const cached = dedupe.get(key);
    if (cached !== undefined) {
      return { content: cached };
    }
    let result: unknown;
    try {
      result = await tool.handler(args, ctx);
    } catch (err) {
      this.logger.warn(
        `assistant tool ${call.name} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      result = { error: 'tool_failed' };
    }
    const content = capResult(result);
    dedupe.set(key, content);
    let prefill: { form: string; fields: Record<string, unknown> } | undefined;
    if (
      typeof result === 'object' &&
      result !== null &&
      (result as Record<string, unknown>)[PREFILL_MARKER] === true
    ) {
      const r = result as Record<string, unknown>;
      prefill = { form: String(r['form']), fields: r['fields'] as Record<string, unknown> };
    }
    return { content, prefill };
  }
}
