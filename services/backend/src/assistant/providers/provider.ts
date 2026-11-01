import {
  AssistantCompletion,
  AssistantMessage,
  AssistantToolSpec,
} from '../assistant.types';

/**
 * Assistant provider port (ADR-0006). Adapters translate provider errors into
 * typed failures — raw HTTP/fetch errors never leak to callers.
 */
export const ASSISTANT_PROVIDER = 'ASSISTANT_PROVIDER';

export type ProviderFailureKind =
  | 'auth' // declined/invalid credentials — persistent
  | 'rate_limit' // transient
  | 'provider_down' // refused connection / outage — transient
  | 'timeout' // transient
  | 'unavailable'; // no provider configured

export class AssistantProviderError extends Error {
  constructor(
    public readonly kind: ProviderFailureKind,
    message: string,
  ) {
    super(message);
    this.name = 'AssistantProviderError';
  }
}

export interface AssistantProvider {
  /** Stable adapter name ('stub' | 'ollama') — safe for audit payloads. */
  readonly name: string;
  complete(
    messages: AssistantMessage[],
    tools: AssistantToolSpec[],
  ): Promise<AssistantCompletion>;
  /** Readiness probe for GET /assistant/status; never throws. */
  probe(): Promise<{ available: boolean; kind?: ProviderFailureKind }>;
}
