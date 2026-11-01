/**
 * Shared types and hard caps for the assistant module (AI_GOVERNANCE).
 *
 * Invariants enforced here and in the service/registry:
 * - Read-only: tools only query the caller's scope; the single non-read tool
 *   returns an UNSAVED PREFILL — it never writes.
 * - Caller scope: every tool runs on the request's RLS-scoped client with the
 *   verified actor; scope keys are stripped from tool arguments.
 * - No persistence: nothing is stored per conversation; each request is
 *   stateless. The only write is the `assistant.message` audit event.
 * - Injection defense: tool results are untrusted data — delimited in the
 *   prompt, size-capped, and the model→tool loop is capped.
 */

/** Mandatory stop condition: at most this many model→tool rounds per message. */
export const MAX_TOOL_ROUNDS = 3;

/** Tool results are truncated before they re-enter the model context. */
export const MAX_TOOL_RESULT_CHARS = 4_000;

/** Summary of a tool result returned to the API caller. */
export const MAX_RESULT_SUMMARY_CHARS = 500;

/** Inbound user message length cap. */
export const MAX_MESSAGE_CHARS = 2_000;

/** Provider request timeout. */
export const PROVIDER_TIMEOUT_MS = 15_000;

/** Status probe cache window — never hammer the provider. */
export const STATUS_CACHE_MS = 30_000;

export interface AssistantToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AssistantToolSpec {
  name: string;
  description: string;
  /** JSON-schema-ish parameters object handed to the provider. */
  parameters: Record<string, unknown>;
}

/** Chat roles used on the provider port. Tool results use role 'tool'. */
export interface AssistantMessage {
  role: 'system' | 'user' | 'tool';
  content: string;
  /** Tool name for role 'tool' messages. */
  name?: string;
}

export interface AssistantCompletion {
  text: string;
  toolCalls: AssistantToolCall[];
}

/** Marker placed on prefill tool results so the service can lift the draft. */
export const PREFILL_MARKER = '__prefill__';

export interface PrefillResult {
  [PREFILL_MARKER]: true;
  form: string;
  fields: Record<string, unknown>;
}

export const isPrefillResult = (value: unknown): value is PrefillResult =>
  typeof value === 'object' && value !== null && (value as Record<string, unknown>)[PREFILL_MARKER] === true;

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
  result_summary: string;
}

export interface AssistantReply {
  reply: string;
  tool_calls: ToolCallRecord[];
  prefill?: { form: string; fields: Record<string, unknown> };
  provider: string;
}
