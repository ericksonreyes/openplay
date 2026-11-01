import {
  AssistantCompletion,
  AssistantMessage,
  AssistantToolCall,
  AssistantToolSpec,
  PROVIDER_TIMEOUT_MS,
} from '../assistant.types';
import {
  AssistantProvider,
  AssistantProviderError,
  ProviderFailureKind,
} from './provider';

interface OllamaToolCallFunction {
  name?: string;
  arguments?: Record<string, unknown>;
}

interface OllamaChatResponse {
  message?: {
    content?: string;
    tool_calls?: { function?: OllamaToolCallFunction }[];
  };
}

/**
 * Ollama adapter (ADR-0006). Talks to OLLAMA_HOST over plain fetch — no new
 * dependencies. Errors are mapped to typed failures; raw HTTP details never
 * leak to callers.
 */
export class OllamaAssistantProvider implements AssistantProvider {
  readonly name = 'ollama';

  constructor(
    private readonly host: string,
    private readonly model: string,
  ) {}

  async complete(
    messages: AssistantMessage[],
    tools: AssistantToolSpec[],
  ): Promise<AssistantCompletion> {
    const body = {
      model: this.model,
      stream: false,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
      })),
      tools: tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
    };
    const res = await this.request('/api/chat', body);
    const json = (await res.json()) as OllamaChatResponse;
    const toolCalls: AssistantToolCall[] = (json.message?.tool_calls ?? [])
      .map((tc) => ({
        name: String(tc.function?.name ?? ''),
        args:
          typeof tc.function?.arguments === 'object' && tc.function.arguments !== null
            ? tc.function.arguments
            : {},
      }))
      .filter((tc) => tc.name.length > 0);
    return { text: json.message?.content ?? '', toolCalls };
  }

  async probe(): Promise<{ available: boolean; kind?: ProviderFailureKind }> {
    if (!this.host) return { available: false, kind: 'unavailable' };
    try {
      const res = await fetch(`${this.host}/api/tags`, {
        signal: AbortSignal.timeout(5_000),
      });
      return res.ok ? { available: true } : { available: false, kind: 'provider_down' };
    } catch (err) {
      return { available: false, kind: this.classify(err) };
    }
  }

  private async request(path: string, body: unknown): Promise<Response> {
    if (!this.host) {
      throw new AssistantProviderError('unavailable', 'OLLAMA_HOST is not configured');
    }
    let res: Response;
    try {
      res = await fetch(`${this.host}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch (err) {
      throw new AssistantProviderError(this.classify(err), 'ollama request failed');
    }
    if (!res.ok) {
      const kind: ProviderFailureKind =
        res.status === 401 || res.status === 403
          ? 'auth'
          : res.status === 429
            ? 'rate_limit'
            : 'provider_down';
      throw new AssistantProviderError(kind, `ollama responded ${res.status}`);
    }
    return res;
  }

  private classify(err: unknown): ProviderFailureKind {
    const name = (err as { name?: string })?.name ?? '';
    if (name === 'TimeoutError' || name === 'AbortError') return 'timeout';
    const code = (err as { cause?: { code?: string } })?.cause?.code ?? '';
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH') {
      return 'provider_down';
    }
    return 'provider_down';
  }
}
