import { AssistantService } from './assistant.service';
import { MAX_TOOL_ROUNDS } from './assistant.types';
import { AssistantProvider } from './providers/provider';
import { AssistantToolRegistry } from './tools/registry';

const actor = {
  userId: '11111111-1111-1111-1111-111111111111',
  tenantId: '22222222-2222-2222-2222-222222222222',
  roles: [],
  permissions: [],
  venueIds: [],
  isPlatform: false,
  isSystem: false,
  isPublic: false,
};

const fakeTx = () => ({
  venue: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
  venueResource: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
  venueClosure: { findMany: jest.fn().mockResolvedValue([]) },
  resourceAllocation: { findMany: jest.fn().mockResolvedValue([]) },
  reservation: { findMany: jest.fn().mockResolvedValue([]) },
  event: { findFirst: jest.fn().mockResolvedValue(null) },
  eventRegistration: { findMany: jest.fn().mockResolvedValue([]) },
});

const makeService = (provider: AssistantProvider, tx: object) => {
  const audit = { append: jest.fn().mockResolvedValue(undefined) };
  const service = new AssistantService(
    { client: tx } as never, // ScopedPrisma
    { run: (fn: (t: object) => unknown) => fn(tx) } as never, // SystemContextService
    { actor } as never, // ActorContextService
    audit as never, // AuditService
    { get: () => 'req-1' } as never, // ClsService
    provider,
    new AssistantToolRegistry(),
  );
  return { service, audit };
};

describe('AssistantService', () => {
  it('terminates a model that never emits a final response at the loop cap', async () => {
    const provider: AssistantProvider = {
      name: 'stub',
      probe: () => Promise.resolve({ available: true }),
      complete: jest.fn().mockResolvedValue({
        text: '',
        toolCalls: [{ name: 'search_venues', args: {} }],
      }),
    };
    const { service } = makeService(provider, fakeTx());
    const out = await service.handleMessage({ message: 'venues?' });
    // provider is consulted at most MAX_TOOL_ROUNDS + 1 times, then forced to stop.
    expect(provider.complete).toHaveBeenCalledTimes(MAX_TOOL_ROUNDS + 1);
    expect(out.attributes.reply.length).toBeGreaterThan(0);
  });

  it('wraps tool results in delimiters as untrusted data', async () => {
    const seen: { content: string }[] = [];
    const provider: AssistantProvider = {
      name: 'stub',
      probe: () => Promise.resolve({ available: true }),
      complete: jest.fn().mockImplementation((messages) => {
        const last = messages[messages.length - 1];
        seen.push(last);
        if (last.role === 'tool') {
          return Promise.resolve({ text: 'done', toolCalls: [] });
        }
        return Promise.resolve({
          text: '',
          toolCalls: [{ name: 'search_venues', args: {} }],
        });
      }),
    };
    const { service } = makeService(provider, fakeTx());
    await service.handleMessage({ message: 'venues?' });
    const toolMsg = seen.find((m) => m.content.includes('TOOL_RESULT'));
    expect(toolMsg?.content).toContain('<<<TOOL_RESULT');
    expect(toolMsg?.content).toContain('<<<END_TOOL_RESULT>>>');
  });

  it('appends one assistant.message audit event with hash + tool names only', async () => {
    const provider: AssistantProvider = {
      name: 'stub',
      probe: () => Promise.resolve({ available: true }),
      complete: jest
        .fn()
        .mockResolvedValueOnce({
          text: '',
          toolCalls: [{ name: 'search_venues', args: {} }],
        })
        .mockResolvedValue({ text: 'done', toolCalls: [] }),
    };
    const { service, audit } = makeService(provider, fakeTx());
    await service.handleMessage({ message: 'venues?' });
    expect(audit.append).toHaveBeenCalledTimes(1);
    const [, , input] = audit.append.mock.calls[0] as unknown as [
      unknown,
      unknown,
      { streamType: string; streamId: string; eventType: string; payload: Record<string, unknown> },
    ];
    expect(input.streamType).toBe('assistant');
    expect(input.streamId).toBe(actor.userId);
    expect(input.eventType).toBe('assistant.message');
    expect(input.payload['message_hash']).toMatch(/^[0-9a-f]{64}$/);
    expect(input.payload['tool_names']).toEqual(['search_venues']);
    expect(input.payload['provider']).toBe('stub');
    expect(input.payload['latency_ms']).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(input.payload)).not.toContain('venues?');
  });

  it('rejects empty messages', async () => {
    const provider: AssistantProvider = {
      name: 'stub',
      probe: () => Promise.resolve({ available: true }),
      complete: jest.fn(),
    };
    const { service } = makeService(provider, fakeTx());
    await expect(service.handleMessage({ message: '   ' })).rejects.toThrow();
    await expect(service.handleMessage({ message: 42 })).rejects.toThrow();
  });
});
