import { jsonApiGet } from '../lib/api';
import { unwrapResource } from '../lib/jsonapi';

export async function StatusPill() {
  const doc = await jsonApiGet('/status', { revalidate: 30 });
  const status = unwrapResource<{ status?: string }>(doc);
  const ok = status?.status === 'ok';
  return (
    <span
      className="inline-flex items-center gap-2 text-xs text-slate-500"
      role="status"
    >
      <span
        aria-hidden
        className={`h-2 w-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`}
      />
      {ok ? 'Live availability' : 'Booking service unavailable'}
    </span>
  );
}
