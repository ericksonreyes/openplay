import { AssistantToolRegistry, ToolContext, sanitizeArgs } from './tools/registry';
import { MAX_TOOL_RESULT_CHARS } from './assistant.types';
import { RequestActor } from '../common/auth/actor';

const actor: RequestActor = {
  userId: '11111111-1111-1111-1111-111111111111',
  roles: [],
  permissions: [],
  venueIds: [],
  isPlatform: false,
  isSystem: false,
  isPublic: false,
};

const emptyTx = () =>
  ({
    venue: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    venueResource: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn() },
    venueClosure: { findMany: jest.fn().mockResolvedValue([]) },
    resourceAllocation: { findMany: jest.fn().mockResolvedValue([]) },
    reservation: { findMany: jest.fn().mockResolvedValue([]) },
    event: { findFirst: jest.fn().mockResolvedValue(null) },
    eventRegistration: { findMany: jest.fn().mockResolvedValue([]) },
  }) as unknown as ToolContext['tx'];

const ctx = (tx: ToolContext['tx']): ToolContext => ({ tx, actor });

describe('sanitizeArgs (scope enforcement)', () => {
  it('strips every key that could override caller scope', () => {
    const clean = sanitizeArgs({
      venue_id: 'ok',
      tenant_id: 'evil',
      tenantId: 'evil',
      user_id: 'evil',
      userId: 'evil',
      player_id: 'evil',
      playerId: 'evil',
      guest_contact_id: 'evil',
      scope: 'evil',
    });
    expect(clean).toEqual({ venue_id: 'ok' });
  });
});

describe('AssistantToolRegistry', () => {
  const registry = new AssistantToolRegistry();
  const names = registry.specs().map((s) => s.name);

  it('exposes exactly the allowlisted read/prefill tools', () => {
    expect(names.sort()).toEqual([
      'get_availability',
      'list_reservations',
      'lookup_event',
      'prefill_reservation',
      'search_venues',
      'summarize_day',
    ]);
  });

  it('ignores unknown tool names from the provider', async () => {
    const out = await registry.dispatch(
      { name: 'drop_table', args: {} },
      ctx(emptyTx()),
      new Map(),
    );
    expect(out.content).toContain('unknown_tool');
    expect(out.prefill).toBeUndefined();
  });

  it('does not pass forbidden scope args to handlers', async () => {
    const tx = emptyTx();
    await registry.dispatch(
      { name: 'list_reservations', args: { tenant_id: 'evil', player_id: 'evil' } },
      ctx(tx),
      new Map(),
    );
    // Player actor: handler must filter by actor.userId, not supplied ids.
    expect(tx.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { playerId: actor.userId },
      }),
    );
  });

  it('dedupes identical calls within a turn', async () => {
    const tx = emptyTx();
    const dedupe = new Map<string, string>();
    const call = { name: 'search_venues', args: { query: 'court' } };
    await registry.dispatch(call, ctx(tx), dedupe);
    await registry.dispatch(call, ctx(tx), dedupe);
    expect(tx.venue.findMany).toHaveBeenCalledTimes(1);
  });

  it('caps tool result size before it re-enters the model context', async () => {
    const big = Array.from({ length: 500 }, (_, i) => ({
      id: `v${i}`,
      name: `venue-${i}-${'x'.repeat(50)}`,
      status: 'active',
      tenantId: 't',
      timezone: 'UTC',
      address: null,
      details: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const tx = emptyTx();
    (tx.venue.findMany as jest.Mock).mockResolvedValue(big);
    const out = await registry.dispatch(
      { name: 'search_venues', args: {} },
      ctx(tx),
      new Map(),
    );
    // The handler bounds to 20 rows AND the result is char-capped.
    expect(out.content.length).toBeLessThanOrEqual(MAX_TOOL_RESULT_CHARS + 20);
  });

  it('marks prefill results without writing anything', async () => {
    const tx = emptyTx();
    const out = await registry.dispatch(
      {
        name: 'prefill_reservation',
        args: { resource_id: 'r1', party_size: 4, player_id: 'evil' },
      },
      ctx(tx),
      new Map(),
    );
    expect(out.prefill).toBeDefined();
    expect(out.prefill?.form).toBe('reservation');
    expect(out.prefill?.fields['player_id']).toBeUndefined();
  });
});
