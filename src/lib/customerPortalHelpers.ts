import { Quote, QuoteLane } from './supabase';
import { formatCurrency, CurrencyCode } from './constants';

export interface LaneAcceptanceGroup {
  group_id: string;
  label: string;
  lane_ids: string[];
  service_type: string;
  trip_type: string;
  is_split: boolean;
  origin: string;
  destination: string;
  border_crossing: string;
  lane_total: number;
  currency_code: string;
}

export function generateReviewToken(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildLaneAcceptanceGroups(lanes: QuoteLane[]): LaneAcceptanceGroup[] {
  const groups: LaneAcceptanceGroup[] = [];
  const processed = new Set<string>();

  const sorted = [...lanes].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  for (const lane of sorted) {
    if (processed.has(lane.id)) continue;

    const tripType = lane.trip_type || 'One Way';
    const isSplit = !!lane.split_billing_group;
    const currCode = lane.currency_code || 'USD';

    if (isSplit) {
      const siblings = sorted.filter(l => l.split_billing_group === lane.split_billing_group);
      const laneIds = siblings.map(l => l.id);
      laneIds.forEach(id => processed.add(id));

      const primary = siblings.find(l => l.is_primary_lane) || siblings[0];
      const laneNumbers = siblings.map(l => sorted.indexOf(l) + 1);
      const minNum = Math.min(...laneNumbers);
      const maxNum = Math.max(...laneNumbers);
      const tripLabel = tripType !== 'One Way' ? ` -- ${tripType}` : '';

      const total = siblings.reduce((sum, l) => {
        return sum + (l.us_rate || 0) + (l.mx_rate || 0) + (l.border_crossing_fee || 0) + (l.toll_rate || 0) + (l.accessorials_amount || 0);
      }, 0);

      groups.push({
        group_id: lane.split_billing_group!,
        label: `Lanes ${minNum}-${maxNum} -- Split Billing${tripLabel}`,
        lane_ids: laneIds,
        service_type: primary.service_type || 'Door to Door',
        trip_type: tripType,
        is_split: true,
        origin: primary.origin_city || '',
        destination: primary.destination_city || '',
        border_crossing: primary.border_crossing || '',
        lane_total: total,
        currency_code: currCode,
      });
    } else if ((tripType === 'Round Trip' || tripType === 'Circuit') && lane.paired_lane_id) {
      const paired = sorted.find(l => l.id === lane.paired_lane_id);
      const primary = lane.is_primary_lane ? lane : (paired || lane);
      const secondary = lane.is_primary_lane ? paired : lane;
      const allLanes = secondary ? [primary, secondary] : [primary];
      const laneIds = allLanes.map(l => l.id);
      laneIds.forEach(id => processed.add(id));

      const laneNumbers = allLanes.map(l => sorted.indexOf(l) + 1);
      const minNum = Math.min(...laneNumbers);
      const maxNum = Math.max(...laneNumbers);

      const total = allLanes.reduce((sum, l) => {
        return sum + (l.us_rate || 0) + (l.mx_rate || 0) + (l.border_crossing_fee || 0) + (l.toll_rate || 0) + (l.accessorials_amount || 0);
      }, 0);

      groups.push({
        group_id: primary.id,
        label: `Lanes ${minNum}-${maxNum} -- ${tripType}`,
        lane_ids: laneIds,
        service_type: primary.service_type || 'Door to Door',
        trip_type: tripType,
        is_split: false,
        origin: primary.origin_city || '',
        destination: primary.destination_city || '',
        border_crossing: primary.border_crossing || '',
        lane_total: total,
        currency_code: currCode,
      });
    } else {
      processed.add(lane.id);
      const laneNum = sorted.indexOf(lane) + 1;
      const total = (lane.us_rate || 0) + (lane.mx_rate || 0) + (lane.border_crossing_fee || 0) + (lane.toll_rate || 0) + (lane.accessorials_amount || 0);

      groups.push({
        group_id: lane.id,
        label: `Lane ${laneNum}`,
        lane_ids: [lane.id],
        service_type: lane.service_type || 'Door to Door',
        trip_type: tripType,
        is_split: false,
        origin: lane.origin_city || '',
        destination: lane.destination_city || '',
        border_crossing: lane.border_crossing || '',
        lane_total: total,
        currency_code: currCode,
      });
    }
  }

  return groups;
}

export type CustomerReviewStatus = 'accepted' | 'rejected' | 'negotiate' | 'mixed' | 'expired' | 'pending' | null;

export function calculateQuoteReviewStatus(quote: Quote): CustomerReviewStatus {
  if (!quote.review_token) return null;

  if (quote.token_expires_at && new Date(quote.token_expires_at) < new Date() && (!quote.customer_responded_at)) {
    return 'expired';
  }

  if (!quote.lane_acceptance || Object.keys(quote.lane_acceptance).length === 0) {
    if (quote.customer_responded_at) {
      return quote.customer_review_status as CustomerReviewStatus || 'pending';
    }
    return 'pending';
  }

  const statuses = Object.values(quote.lane_acceptance).map(g => g.status);

  if (statuses.every(s => s === 'accepted')) return 'accepted';
  if (statuses.every(s => s === 'rejected')) return 'rejected';
  if (statuses.every(s => s === 'negotiate')) return 'negotiate';

  return 'mixed';
}

export function formatGroupTotal(total: number, currencyCode: string): string {
  return formatCurrency(total, currencyCode as CurrencyCode);
}

export function getPortalUrl(token: string): string {
  return `${window.location.origin}/#/review/${token}`;
}

export function getPreviewUrl(quoteId: string): string {
  return `${window.location.origin}/#/review/preview/${quoteId}`;
}
