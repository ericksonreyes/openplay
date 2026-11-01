import { PREFILL_MARKER } from '../assistant.types';
import { ToolDefinition } from './registry';

/**
 * Unsaved-prefill tools. These produce suggested form fields only — no
 * reservation, hold, allocation, or any other record is created. The submit
 * step is the human checkpoint and re-runs the standard booking flow.
 */
export function prefillTools(): ToolDefinition[] {
  return [
    {
      spec: {
        name: 'prefill_reservation',
        description:
          'Draft UNSAVED form fields for a reservation the caller can review and submit through the normal booking form. Creates nothing.',
        parameters: {
          type: 'object',
          properties: {
            venue_id: { type: 'string' },
            resource_id: { type: 'string' },
            activity_id: { type: 'string' },
            starts_at: { type: 'string', description: 'ISO-8601 timestamp' },
            ends_at: { type: 'string', description: 'ISO-8601 timestamp' },
            party_size: { type: 'integer' },
            notes: { type: 'string' },
          },
        },
      },
      handler: async (args, ctx) => {
        const fields: Record<string, unknown> = {};
        const str = (key: string, max: number): void => {
          const v = args[key];
          if (typeof v === 'string' && v.length > 0) fields[key] = v.slice(0, max);
        };
        str('venue_id', 64);
        str('resource_id', 64);
        str('activity_id', 64);
        str('starts_at', 40);
        str('ends_at', 40);
        str('notes', 500);
        if (
          typeof args['party_size'] === 'number' &&
          Number.isFinite(args['party_size'])
        ) {
          fields['party_size'] = Math.min(Math.max(Math.floor(args['party_size'] as number), 1), 100);
        }
        // Resolve display names when ids were suggested (read-only).
        if (typeof fields['resource_id'] === 'string') {
          const resource = await ctx.tx.venueResource.findFirst({
            where: { id: fields['resource_id'], status: 'active' },
          });
          if (resource) {
            fields['resource_name'] = resource.name;
            fields['venue_id'] = resource.venueId;
          }
        }
        if (typeof fields['venue_id'] === 'string') {
          const venue = await ctx.tx.venue.findFirst({ where: { id: fields['venue_id'] } });
          if (venue) fields['venue_name'] = venue.name;
        }
        // Players always book for themselves; staff submit through the normal
        // form which re-derives the subject — no identity is prefilled.
        return {
          [PREFILL_MARKER]: true,
          form: 'reservation',
          fields,
          note: 'Unsaved suggestion — review and submit through the standard booking form.',
        };
      },
    },
  ];
}
