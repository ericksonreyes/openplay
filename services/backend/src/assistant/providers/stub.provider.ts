import {
  AssistantCompletion,
  AssistantMessage,
  AssistantToolSpec,
} from '../assistant.types';
import { AssistantProvider } from './provider';

/**
 * Deterministic local provider — the default adapter. It never calls a model:
 * it maps keywords in the latest user message to canned tool-call sequences,
 * then answers from tool results. Used for local development, CI evals, and
 * as the zero-dependency fallback.
 *
 * Determinism contract: identical (messages, tools) inputs always produce
 * identical completions.
 */
export class StubAssistantProvider implements AssistantProvider {
  readonly name = 'stub';

  complete(
    messages: AssistantMessage[],
    tools: AssistantToolSpec[],
  ): Promise<AssistantCompletion> {
    const last = messages[messages.length - 1];
    // After at least one tool result, answer from the tool data — the stub
    // never emits a second tool round.
    if (last?.role === 'tool') {
      return Promise.resolve({
        text: this.answerFromToolResults(messages),
        toolCalls: [],
      });
    }
    const userText = (last?.content ?? '').toLowerCase();
    const allowed = new Set(tools.map((t) => t.name));
    const call = (name: string, args: Record<string, unknown>) =>
      allowed.has(name) ? [{ name, args }] : [];

    if (/\b(available|availability|slot|open time)\b/.test(userText)) {
      const venueId = this.extractUuid(userText) ?? '';
      const date = this.extractDate(userText) ?? '1970-01-01';
      return Promise.resolve({
        text: '',
        toolCalls: call('get_availability', { venue_id: venueId, date }),
      });
    }
    if (/\b(book|reserve|prefill|draft)\b/.test(userText)) {
      return Promise.resolve({
        text: '',
        toolCalls: call('prefill_reservation', {}),
      });
    }
    if (/\b(summary|summarize|today'?s|day)\b/.test(userText)) {
      return Promise.resolve({
        text: '',
        toolCalls: call('summarize_day', {}),
      });
    }
    if (/\bevent\b/.test(userText)) {
      const eventId = this.extractUuid(userText) ?? '';
      return Promise.resolve({
        text: '',
        toolCalls: call('lookup_event', { event_id: eventId }),
      });
    }
    if (/\b(reservation|booking)s?\b/.test(userText)) {
      return Promise.resolve({
        text: '',
        toolCalls: call('list_reservations', {}),
      });
    }
    if (/\bvenue/.test(userText)) {
      return Promise.resolve({
        text: '',
        toolCalls: call('search_venues', {}),
      });
    }
    return Promise.resolve({
      text: "I can help look up venues, availability, your reservations, events, or draft a booking for you to review. I can't make changes myself.",
      toolCalls: [],
    });
  }

  probe(): Promise<{ available: boolean }> {
    return Promise.resolve({ available: true });
  }

  private answerFromToolResults(messages: AssistantMessage[]): string {
    const toolMessages = messages.filter((m) => m.role === 'tool');
    const summaries = toolMessages.map((m) => {
      const name = m.name ?? 'tool';
      const content = m.content ?? '';
      let count = '';
      try {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        if (typeof parsed['count'] === 'number') count = ` (${parsed['count']} result${parsed['count'] === 1 ? '' : 's'})`;
        if (parsed['error']) return `${name}: unavailable`;
      } catch {
        /* content stays uncounted */
      }
      return `${name}${count}`;
    });
    return `Here is what I found in your scope: ${summaries.join('; ')}.`;
  }

  private extractUuid(text: string): string | undefined {
    const match = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(text);
    return match?.[0];
  }

  private extractDate(text: string): string | undefined {
    const match = /\b\d{4}-\d{2}-\d{2}\b/.exec(text);
    return match?.[0];
  }
}
