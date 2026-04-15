import { supabase, Quote, QuoteLane, LaneGroupAcceptance } from './supabase';
import { LaneAcceptanceGroup } from './customerPortalHelpers';
import { GroupResponse } from '../components/portal/PortalLaneCard';

export type OverallStatus = 'accepted' | 'rejected' | 'negotiate' | 'mixed';

function countByStatus(
  groups: LaneAcceptanceGroup[],
  responses: Record<string, GroupResponse>
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const g of groups) {
    const s = responses[g.group_id]?.status;
    if (s) counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}

async function writeHistoryEntries(
  quoteId: string,
  ownerName: string,
  overallStatus: OverallStatus,
  groups: LaneAcceptanceGroup[],
  responses: Record<string, GroupResponse>,
  customerName: string,
  negotiationQuoteId?: string
): Promise<void> {
  const now = new Date().toISOString();
  const counts = countByStatus(groups, responses);
  const parts: string[] = [];
  if (counts.accepted) parts.push(`${counts.accepted} accepted`);
  if (counts.rejected) parts.push(`${counts.rejected} rejected`);
  if (counts.negotiate) parts.push(`${counts.negotiate} negotiating`);
  const summary = parts.join(', ');

  const entries: { quote_id: string; date: string; user_name: string; action: string; notes: string }[] = [];

  entries.push({
    quote_id: quoteId,
    date: now,
    user_name: customerName,
    action: 'Customer Response Received',
    notes: `Status: ${overallStatus}. ${summary}.`,
  });

  entries.push({
    quote_id: quoteId,
    date: now,
    user_name: 'System',
    action: 'Stage Changed',
    notes: 'Stage changed to Published',
  });

  if (negotiationQuoteId) {
    entries.push({
      quote_id: quoteId,
      date: now,
      user_name: 'System',
      action: 'Revision Quote Created',
      notes: `Revision quote created for non-accepted lanes`,
    });

    entries.push({
      quote_id: negotiationQuoteId,
      date: now,
      user_name: 'System',
      action: 'Quote Created from Customer Response',
      notes: `Created from customer response on original quote`,
    });
  }

  try {
    await supabase.from('quote_history').insert(entries);
  } catch {}
}

async function triggerNotificationEmails(quote: Quote): Promise<void> {
  try {
    await Promise.allSettled([
      supabase.functions.invoke('send-quote-email', {
        body: {
          type: 'response_received_internal',
          quoteId: quote.id,
        },
      }),
      supabase.functions.invoke('send-quote-email', {
        body: {
          type: 'response_confirmation_customer',
          quoteId: quote.id,
          customerEmail: quote.customer_email,
        },
      }),
    ]);
  } catch {}
}

export interface SubmissionPayload {
  quote: Quote;
  lanes: QuoteLane[];
  groups: LaneAcceptanceGroup[];
  responses: Record<string, GroupResponse>;
  customerName: string;
  customerTitle: string;
  customerCompany: string;
  signatureFont: string;
  signatureData: string;
}

export interface SubmissionResult {
  success: boolean;
  overallStatus: OverallStatus;
  customerName: string;
  negotiationQuoteId?: string;
  error?: string;
}

export function deriveOverallStatus(
  groups: LaneAcceptanceGroup[],
  responses: Record<string, GroupResponse>
): OverallStatus {
  const statuses = groups.map(g => responses[g.group_id]?.status).filter(Boolean);

  if (statuses.every(s => s === 'accepted')) return 'accepted';
  if (statuses.every(s => s === 'rejected')) return 'rejected';
  if (statuses.every(s => s === 'negotiate')) return 'negotiate';
  return 'mixed';
}

function buildLaneAcceptanceJsonb(
  groups: LaneAcceptanceGroup[],
  responses: Record<string, GroupResponse>
): Record<string, LaneGroupAcceptance> {
  const acceptance: Record<string, LaneGroupAcceptance> = {};
  const now = new Date().toISOString();

  for (const group of groups) {
    const r = responses[group.group_id];
    if (!r?.status) continue;

    acceptance[`group_${group.group_id}`] = {
      status: r.status,
      comment: r.comment || undefined,
      lane_ids: group.lane_ids,
      responded_at: now,
    };
  }

  return acceptance;
}

async function cloneQuoteForNonAccepted(
  originalQuote: Quote,
  lanes: QuoteLane[],
  groups: LaneAcceptanceGroup[],
  responses: Record<string, GroupResponse>
): Promise<string | null> {
  const nonAcceptedLaneIds = new Set<string>();
  for (const group of groups) {
    const r = responses[group.group_id];
    if (r?.status && r.status !== 'accepted') {
      group.lane_ids.forEach(id => nonAcceptedLaneIds.add(id));
    }
  }

  if (nonAcceptedLaneIds.size === 0) return null;

  const nonAcceptedLanes = lanes.filter(l => nonAcceptedLaneIds.has(l.id));
  if (nonAcceptedLanes.length === 0) return null;

  const { data: clonedQuote, error: quoteErr } = await supabase
    .from('quotes')
    .insert({
      quote_number: `${originalQuote.quote_number}-NEG`,
      owner_name: originalQuote.owner_name,
      status: 'New',
      total_amount: 0,
      us_portion: 0,
      mx_rate: 0,
      border_crossing_fee: 0,
      units: originalQuote.units,
      type_of_service: originalQuote.type_of_service,
      partner_account: originalQuote.partner_account,
      us_sales_rep: originalQuote.us_sales_rep,
      mx_sales_rep: originalQuote.mx_sales_rep,
      currency: originalQuote.currency,
      bill_to_customer: originalQuote.bill_to_customer,
      shipper: originalQuote.shipper,
      bco_partner: originalQuote.bco_partner,
      opportunity: originalQuote.opportunity,
      opportunity_type: originalQuote.opportunity_type,
      stage: 'New',
      exchange_rate: originalQuote.exchange_rate,
      cad_exchange_rate: originalQuote.cad_exchange_rate,
      today_fuel_rate: originalQuote.today_fuel_rate,
    })
    .select('id')
    .single();

  if (quoteErr || !clonedQuote) return null;

  const clonedLanes = nonAcceptedLanes.map((lane, idx) => ({
    quote_id: clonedQuote.id,
    origin_city: lane.origin_city,
    destination_city: lane.destination_city,
    border_crossing: lane.border_crossing,
    border_crossing_fee: lane.border_crossing_fee,
    border_crossing_rate: lane.border_crossing_rate,
    us_rate: lane.us_rate,
    mx_rate: lane.mx_rate,
    equipment_type: lane.equipment_type,
    sort_order: idx + 1,
    trip_type: lane.trip_type,
    service_type: lane.service_type,
    split_billing_group: lane.split_billing_group,
    split_billing_index: lane.split_billing_index,
    is_primary_lane: lane.is_primary_lane,
    paired_lane_id: lane.paired_lane_id,
    toll_rate: lane.toll_rate,
    lane_type: lane.lane_type,
    load_frequency: lane.load_frequency,
    load_volume: lane.load_volume,
    commitment_type: lane.commitment_type,
    comments: lane.comments,
    accessorials_amount: lane.accessorials_amount,
    accessorials_list: lane.accessorials_list,
    us_accessorials_list: lane.us_accessorials_list,
    mx_accessorials_list: lane.mx_accessorials_list,
    currency_code: lane.currency_code,
    units_code: lane.units_code,
    stops_before: lane.stops_before,
    stops_after: lane.stops_after,
    origin_country_code: lane.origin_country_code,
    destination_country_code: lane.destination_country_code,
  }));

  await supabase.from('quote_lanes').insert(clonedLanes);

  return clonedQuote.id;
}

export async function submitPortalResponse(payload: SubmissionPayload): Promise<SubmissionResult> {
  const { quote, lanes, groups, responses, customerName, customerTitle, signatureFont, signatureData } = payload;

  const overallStatus = deriveOverallStatus(groups, responses);
  const laneAcceptance = buildLaneAcceptanceJsonb(groups, responses);
  const now = new Date().toISOString();

  const { error: updateErr } = await supabase
    .from('quotes')
    .update({
      customer_review_status: overallStatus,
      customer_responded_at: now,
      customer_name: customerName,
      customer_title: customerTitle,
      customer_signature_font: signatureFont,
      customer_signature_data: signatureData,
      lane_acceptance: laneAcceptance,
      stage: 'Published',
    })
    .eq('id', quote.id);

  if (updateErr) {
    return { success: false, overallStatus, customerName, error: updateErr.message };
  }

  let negotiationQuoteId: string | undefined;

  if (overallStatus !== 'accepted') {
    const cloneId = await cloneQuoteForNonAccepted(quote, lanes, groups, responses);
    if (cloneId) {
      negotiationQuoteId = cloneId;
      await supabase
        .from('quotes')
        .update({ negotiation_quote_id: cloneId })
        .eq('id', quote.id);
    }
  }

  writeHistoryEntries(quote.id, quote.owner_name, overallStatus, groups, responses, customerName, negotiationQuoteId);
  triggerNotificationEmails(quote);

  return { success: true, overallStatus, customerName, negotiationQuoteId };
}

export function renderSignatureToCanvas(
  canvas: HTMLCanvasElement,
  text: string,
  fontFamily: string
): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);

  ctx.font = `48px "${fontFamily}", cursive`;
  ctx.fillStyle = '#1a1a2e';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2);

  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(24, h - 20);
  ctx.lineTo(w - 24, h - 20);
  ctx.stroke();

  return canvas.toDataURL('image/png');
}

export const SIGNATURE_FONTS = [
  { name: 'Dancing Script', family: 'Dancing Script' },
  { name: 'Great Vibes', family: 'Great Vibes' },
  { name: 'Pacifico', family: 'Pacifico' },
  { name: 'Satisfy', family: 'Satisfy' },
] as const;

export function loadSignatureFonts(): void {
  const existing = document.getElementById('portal-signature-fonts');
  if (existing) return;

  const link = document.createElement('link');
  link.id = 'portal-signature-fonts';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Pacifico&family=Satisfy&display=swap';
  document.head.appendChild(link);
}
