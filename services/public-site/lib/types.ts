// Attribute shapes returned by the public API (field allowlist per API contract).

export interface VenueSummary {
  name: string;
  timezone?: string;
  address?: { line1?: string; city?: string; country?: string };
  details?: { description?: string };
}

export interface Business {
  code: string;
  name: string;
  profile?: {
    description?: string;
    logo?: string | null;
    images?: string[];
    links?: Record<string, string>;
  } | null;
  venues?: { id: string; attributes: VenueSummary }[];
}

export interface VenueResource {
  id: string;
  name: string;
  resource_type?: string;
  capacity?: number;
}

export interface VenueActivity {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface VenuePrice {
  id: string;
  name?: string;
  amount_cents?: number;
  currency?: string;
  unit?: string;
}

export interface FacilityRule {
  id: string;
  title: string;
  body?: string;
}

export interface VenueDetail extends VenueSummary {
  resources?: { id: string; attributes: Omit<VenueResource, 'id'> }[];
  activities?: { id: string; attributes: Omit<VenueActivity, 'id'> }[];
  prices?: { id: string; attributes: Omit<VenuePrice, 'id'> }[];
  facility_rules?: { id: string; attributes: Omit<FacilityRule, 'id'> }[];
}

export interface EventItem {
  name: string;
  description?: string;
  format?: string;
  status?: string;
  state?: string;
  starts_at?: string;
  ends_at?: string;
  capacity?: number;
  remaining_capacity?: number | null;
  fee_cents?: number;
  currency?: string;
  payment_timing?: string;
  venue_id?: string;
  business_code?: string;
}

export interface AvailabilitySlot {
  starts_at?: string;
  ends_at?: string;
  start?: string;
  end?: string;
  status?: string;
  available?: boolean;
  resource_id?: string;
  resource_name?: string;
}
