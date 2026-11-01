import {
  claimDueReminders,
  DueReminderRow,
  markReminderSent,
  SqlTx,
} from './reminders';

/** Records raw queries; $queryRaw replays a canned row set. */
const fakeTx = (rows: DueReminderRow[]) => {
  const tx = {
    queries: [] as unknown[],
    async $queryRaw<T>(q: unknown): Promise<T> {
      tx.queries.push(q);
      return rows as unknown as T;
    },
    async $executeRaw(q: unknown): Promise<number> {
      tx.queries.push(q);
      return rows.length;
    },
  };
  return tx as SqlTx & { queries: unknown[] };
};

const row = (id: string): DueReminderRow => ({
  id,
  tenant_id: 'tenant-1',
  stream_type: 'booking',
  stream_id: 'booking-1',
  recipient_user_id: null,
  recipient_address: 'player@demo.test',
  channel: 'email',
  kind: 'reminder.upcoming_reservation',
  payload: { link: 'https://x.test' },
  idempotency_key: `key-${id}`,
});

describe('claimDueReminders', () => {
  it('claims due rows and marks them claimed in one batch', async () => {
    const tx = fakeTx([row('r1'), row('r2')]);
    const claimed = await claimDueReminders(tx, 50);
    expect(claimed.map((r) => r.id)).toEqual(['r1', 'r2']);
    // One SELECT ... FOR UPDATE SKIP LOCKED + one UPDATE.
    expect(tx.queries).toHaveLength(2);
  });

  it('skips the UPDATE when nothing is due', async () => {
    const tx = fakeTx([]);
    const claimed = await claimDueReminders(tx);
    expect(claimed).toEqual([]);
    expect(tx.queries).toHaveLength(1);
  });
});

describe('markReminderSent', () => {
  it('marks the reminder sent and inserts the notification row', async () => {
    const tx = fakeTx([]);
    await markReminderSent(tx, row('r1'));
    // UPDATE reminders + INSERT notifications (idempotent on key).
    expect(tx.queries).toHaveLength(2);
  });
});
