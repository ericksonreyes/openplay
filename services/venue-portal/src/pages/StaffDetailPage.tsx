import { Link, useParams } from 'react-router-dom';
import { attr } from '../lib/api';
import { useList } from '../lib/hooks';
import { EmptyState, PageHeader, Spinner, StatusBadge } from '../components/ui';

/** Staff member detail — GET /staff/:id doesn't exist yet, so the row is
 *  resolved from the staff list (convention: page works regardless). */
export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { rows: staff } = useList('/staff');
  const member = (staff ?? []).find((s) => s.id === id);

  if (staff === null) return <Spinner />;
  if (!member) return <EmptyState message="Staff member not found." />;

  const roles = (member.attributes?.roles as string[] | undefined) ?? [attr(member, 'role')].filter(Boolean);

  return (
    <div>
      <PageHeader title={attr(member, 'name') || attr(member, 'identifier') || 'Staff member'} description="This staff member’s roles and venue access.">
        <Link to="/staff" className="text-sm text-indigo-600 hover:underline">← All staff</Link>
      </PageHeader>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <dl className="divide-y divide-slate-100">
          {[
            ['Username', attr(member, 'identifier') || attr(member, 'username') || '—'],
            ['Display name', attr(member, 'display_name') || attr(member, 'name') || '—'],
            ['Roles', roles.length ? roles.join(', ') : '—'],
            ['Status', <StatusBadge key="s" status={attr(member, 'status') || 'active'} />],
            ['Venue assignments', ((member.attributes?.venue_ids as string[] | undefined) ?? []).length ? `${(member.attributes!.venue_ids as string[]).length} venue(s)` : 'All venues'],
          ].map(([k, v]) => (
            <div key={String(k)} className="flex justify-between gap-4 px-1 py-2 text-sm">
              <dt className="shrink-0 text-slate-500">{k}</dt>
              <dd className="text-right text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
