import { QuoteLane } from './supabase';

export interface SiblingUpdate {
  id: string;
  updates: Partial<QuoteLane>;
  /** true when origin, destination or border crossing changed (its miles must be recalculated) */
  routeChanged: boolean;
}

const realBorder = (value?: string | null) => (value && value !== 'N/A' ? value : '');

/**
 * Door to Door split billing groups keep their segments consistent with each other:
 *
 * Round Trip (4 segments) - trip origin O (segment 1), border crossing B, trip destination D (segment 2):
 *   1: O -> B     2: B -> D     3: D -> B     4: B -> O
 *   The return crosses at the same point as the outbound trip.
 * One Way (2 segments): segment 1 ends where segment 2 starts (the border crossing).
 * Circuit groups are entered leg by leg and are not derived here.
 *
 * Given the group as it is after saving `editedId`, returns the changes the OTHER segments
 * (and, when needed, the edited one) require. Segments that are already consistent are omitted.
 */
export function deriveSplitBillingSiblings(group: QuoteLane[], editedId: string): SiblingUpdate[] {
  const byIndex = (idx: number) => group.find(l => l.split_billing_index === idx);
  const edited = group.find(l => l.id === editedId);
  if (!edited || edited.service_type !== 'Door to Door') return [];

  const expected: Record<string, Partial<QuoteLane>> = {};
  const expect = (lane: QuoteLane | undefined, values: Partial<QuoteLane>) => {
    if (lane) expected[lane.id] = { ...(expected[lane.id] || {}), ...values };
  };

  const s1 = byIndex(1);
  const s2 = byIndex(2);
  const s3 = byIndex(3);
  const s4 = byIndex(4);

  if (edited.trip_type === 'Round Trip' && s1 && s2 && s3 && s4) {
    // The crossing comes from the segment that was just saved when it carries one
    const editedBorder = edited.id === s1.id || edited.id === s2.id ? realBorder(edited.border_crossing) : '';
    const border = editedBorder || realBorder(s1.border_crossing) || realBorder(s2.border_crossing);
    if (border) {
      expect(s1, { destination_city: border });
      expect(s2, { origin_city: border });
      expect(s3, { destination_city: border });
      expect(s4, { origin_city: border });
      if (realBorder(s1.border_crossing)) {
        expect(s1, { border_crossing: border });
        expect(s4, { border_crossing: border });
      }
      if (realBorder(s2.border_crossing)) {
        expect(s2, { border_crossing: border });
        expect(s3, { border_crossing: border });
      }
    }
    if (s1.origin_city) {
      expect(s4, { destination_city: s1.origin_city });
      if (s1.origin_country_code) expect(s4, { destination_country_code: s1.origin_country_code });
    }
    if (s2.destination_city) {
      expect(s3, { origin_city: s2.destination_city });
      if (s2.destination_country_code) expect(s3, { origin_country_code: s2.destination_country_code });
    }
  } else if (edited.trip_type === 'One Way' && s1 && s2) {
    const border = realBorder(s1.border_crossing);
    const meetingPoint = border || s1.destination_city;
    if (border) expect(s1, { destination_city: border });
    if (meetingPoint) expect(s2, { origin_city: meetingPoint });
  } else {
    return [];
  }

  const result: SiblingUpdate[] = [];
  group.forEach(lane => {
    const want = expected[lane.id];
    if (!want) return;
    const updates: Partial<QuoteLane> = {};
    (Object.keys(want) as (keyof QuoteLane)[]).forEach(key => {
      if (want[key] !== undefined && want[key] !== lane[key]) (updates as Record<string, unknown>)[key] = want[key];
    });
    if (Object.keys(updates).length === 0) return;
    const routeChanged = 'origin_city' in updates || 'destination_city' in updates || 'border_crossing' in updates;
    result.push({ id: lane.id, updates, routeChanged });
  });
  return result;
}
