import { StubAssistantProvider } from './providers/stub.provider';
import { AssistantToolSpec } from './assistant.types';

const tools: AssistantToolSpec[] = [
  { name: 'search_venues', description: '', parameters: {} },
  { name: 'get_availability', description: '', parameters: {} },
  { name: 'list_reservations', description: '', parameters: {} },
  { name: 'lookup_event', description: '', parameters: {} },
  { name: 'summarize_day', description: '', parameters: {} },
  { name: 'prefill_reservation', description: '', parameters: {} },
];

describe('StubAssistantProvider', () => {
  const provider = new StubAssistantProvider();

  it('is deterministic: identical input yields identical output', async () => {
    const messages = [{ role: 'user' as const, content: 'show me venues' }];
    const a = await provider.complete(messages, tools);
    const b = await provider.complete(messages, tools);
    expect(a).toEqual(b);
  });

  it('emits canned tool calls for recognizable intents', async () => {
    const venue = await provider.complete(
      [{ role: 'user', content: 'what venues are nearby' }],
      tools,
    );
    expect(venue.toolCalls).toEqual([{ name: 'search_venues', args: {} }]);

    const reservations = await provider.complete(
      [{ role: 'user', content: 'show my reservations' }],
      tools,
    );
    expect(reservations.toolCalls).toEqual([{ name: 'list_reservations', args: {} }]);

    const availability = await provider.complete(
      [{ role: 'user', content: 'availability 2030-05-01' }],
      tools,
    );
    expect(availability.toolCalls[0].name).toBe('get_availability');
    expect(availability.toolCalls[0].args['date']).toBe('2030-05-01');
  });

  it('never calls tools outside the provided spec list', async () => {
    const out = await provider.complete(
      [{ role: 'user', content: 'what venues exist' }],
      [{ name: 'lookup_event', description: '', parameters: {} }],
    );
    expect(out.toolCalls).toEqual([]);
  });

  it('answers from tool results without further tool calls', async () => {
    const out = await provider.complete(
      [
        { role: 'user', content: 'venues?' },
        { role: 'tool', name: 'search_venues', content: '{"count":2}' },
      ],
      tools,
    );
    expect(out.toolCalls).toEqual([]);
    expect(out.text).toContain('search_venues');
  });

  it('always probes available', async () => {
    await expect(provider.probe()).resolves.toEqual({ available: true });
  });
});
