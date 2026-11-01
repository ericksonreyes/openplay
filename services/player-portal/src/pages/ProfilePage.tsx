import { jsonApi } from '../lib/api';
import type { JsonApiResource } from '../lib/api';
import { attributeEntries, displayName } from '../lib/attrs';
import { useQuery } from '../lib/useQuery';
import { Card, DetailTable, ErrorState, Loading, PageHeader } from '../components/ui';

export function ProfilePage() {
  const { data, error, loading, reload } = useQuery<JsonApiResource>(
    (token) => jsonApi<JsonApiResource>('/me', { token }),
    [],
  );

  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <Card>
          <h2 className="mb-3 font-semibold text-slate-800">{displayName(data, 'My account')}</h2>
          <DetailTable rows={attributeEntries(data, ['name', 'display_name', 'token'])} />
        </Card>
      )}
    </div>
  );
}
