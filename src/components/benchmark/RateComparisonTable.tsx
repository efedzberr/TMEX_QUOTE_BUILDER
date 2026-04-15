import { QuoteLane } from '../../lib/supabase';
import { formatCurrencyOrDash, CurrencyCode } from '../../lib/constants';
import { Row, safeNum, calcStats, splitByCustomer } from './benchmarkUtils';

interface RateComparisonTableProps {
  lane: QuoteLane;
  accountLanes: Row[];
  marketInfo: Row[];
  partnerAccount: string;
}

interface StatResult { max: number; avg: number; min: number; }

function extractTotalValues(rows: Row[]): number[] {
  return rows.map(r => {
    const total = safeNum(r['Total']);
    if (total > 0) return total;
    const usRate = safeNum(r['US Rate']);
    const mxRate = safeNum(r['MX Rate']);
    const bcr = safeNum(r['Border Crossing Rate']);
    if (usRate > 0 || mxRate > 0) return usRate + mxRate + bcr;
    return safeNum(r['Rate']);
  }).filter(v => v > 0);
}

function extractBCFValues(rows: Row[]): number[] {
  return rows.map(r => safeNum(r['Border Crossing Rate'])).filter(v => v > 0);
}

function extractRPMValues(rows: Row[]): number[] {
  return rows.map(r => {
    const usRpm = safeNum(r['US Rate Per Mile']);
    const mxRpm = safeNum(r['MX Rate Per Mile']);
    if (usRpm > 0 || mxRpm > 0) return usRpm + mxRpm;
    const total = safeNum(r['Total']) || safeNum(r['Rate']);
    const usMi = safeNum(r['US Miles']);
    const mxMi = safeNum(r['MX Miles']);
    const totalMiles = usMi + mxMi;
    return totalMiles > 0 && total > 0 ? total / totalMiles : 0;
  }).filter(v => v > 0);
}

function extractUSLineHaul(rows: Row[]): number[] {
  return rows.map(r => safeNum(r['US Rate'])).filter(v => v > 0);
}

function extractMXLineHaul(rows: Row[]): number[] {
  return rows.map(r => safeNum(r['MX Rate'])).filter(v => v > 0);
}

function extractMarketLineHaul(rows: Row[]): number[] {
  return rows.map(r => safeNum(r['USD Rate']) || safeNum(r['All In Rate'])).filter(v => v > 0);
}

function extractMarketBCF(rows: Row[]): number[] {
  return rows.map(r => safeNum(r['Crossing Fee'])).filter(v => v > 0);
}

function extractMarketRPM(rows: Row[]): number[] {
  return rows.map(r => {
    const rate = safeNum(r['USD Rate']) || safeNum(r['All In Rate']);
    const miles = safeNum(r['Miles']);
    return miles > 0 && rate > 0 ? rate / miles : 0;
  }).filter(v => v > 0);
}

function statsFrom(values: number[]): StatResult | null { return calcStats(values); }

function Cell({ value, curr }: { value: number | null; curr: CurrencyCode }) {
  if (value === null || value === 0) return <span className="text-gray-400">{'\u2014'}</span>;
  return <span className="text-gray-800">{formatCurrencyOrDash(value, curr)}</span>;
}

function SubjectCell({ value, curr }: { value: number; curr: CurrencyCode }) {
  if (!value) return <span className="text-gray-400">{'\u2014'}</span>;
  return <span className="font-semibold text-blue-900">{formatCurrencyOrDash(value, curr)}</span>;
}

export function RateComparisonTable({ lane, accountLanes, marketInfo, partnerAccount }: RateComparisonTableProps) {
  const curr = (lane.currency_code || 'USD') as CurrencyCode;
  const { same, others } = splitByCustomer(accountLanes, partnerAccount);

  const sections = [
    { label: 'Line Haul (Total)', color: 'bg-blue-600', same: statsFrom(extractTotalValues(same)), others: statsFrom(extractTotalValues(others)), market: statsFrom(extractMarketLineHaul(marketInfo)), subject: (lane.us_rate || 0) + (lane.mx_rate || 0) },
    { label: 'Border Crossing Fee', color: 'bg-amber-600', same: statsFrom(extractBCFValues(same)), others: statsFrom(extractBCFValues(others)), market: statsFrom(extractMarketBCF(marketInfo)), subject: lane.border_crossing_fee || 0 },
    { label: 'Rate Per Mile (RPM)', color: 'bg-blue-500', same: statsFrom(extractRPMValues(same)), others: statsFrom(extractRPMValues(others)), market: statsFrom(extractMarketRPM(marketInfo)), subject: (lane.us_rate_per_mile || 0) + (lane.mx_rate_per_mile || 0) },
    { label: 'US Line Haul', color: 'bg-blue-500', same: statsFrom(extractUSLineHaul(same)), others: statsFrom(extractUSLineHaul(others)), market: null, subject: lane.us_rate || 0 },
    { label: 'MX Line Haul', color: 'bg-teal-600', same: statsFrom(extractMXLineHaul(same)), others: statsFrom(extractMXLineHaul(others)), market: null, subject: lane.mx_rate || 0 },
  ];

  const metrics: ('max' | 'avg' | 'min')[] = ['max', 'avg', 'min'];
  const metricLabels: Record<string, string> = { max: 'Max', avg: 'Average', min: 'Min' };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-2.5 py-1.5 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Rate Comparison</h3>
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span>Same Customer ({same.length} lanes)</span>
          <span>Other Customers ({others.length} lanes)</span>
          <span>Market ({marketInfo.length} records)</span>
        </div>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-2.5 py-1.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[100px]">Metric</th>
              <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Same Customer</th>
              <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-teal-600 uppercase tracking-wider">Other Customers</th>
              <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Market Information</th>
              <th className="px-2.5 py-1.5 text-right text-[10px] font-semibold text-blue-800 uppercase tracking-wider bg-blue-50/60">Subject Lane</th>
            </tr>
          </thead>
          <tbody>
            {sections.map(sec => (
              <SectionRows key={sec.label} section={sec} curr={curr} metrics={metrics} metricLabels={metricLabels} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-2.5 py-1 bg-gray-50 border-t border-gray-200">
        <p className="text-[10px] text-gray-400 italic">Some columns may show {'\u2014'} if no historical data matches the selected filters and market radius</p>
      </div>
    </div>
  );
}

function SectionRows({ section, curr, metrics, metricLabels }: {
  section: { label: string; color: string; same: StatResult | null; others: StatResult | null; market: StatResult | null; subject: number };
  curr: CurrencyCode;
  metrics: ('max' | 'avg' | 'min')[];
  metricLabels: Record<string, string>;
}) {
  return (
    <>
      <tr>
        <td colSpan={5} className={`px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white ${section.color}`}>
          {section.label}
        </td>
      </tr>
      {metrics.map(field => (
        <tr key={field} className="border-b border-gray-100 hover:bg-gray-50/50">
          <td className="px-2.5 py-1 text-gray-600 font-medium">{metricLabels[field]}</td>
          <td className="px-2.5 py-1 text-right"><Cell value={section.same?.[field] ?? null} curr={curr} /></td>
          <td className="px-2.5 py-1 text-right"><Cell value={section.others?.[field] ?? null} curr={curr} /></td>
          <td className="px-2.5 py-1 text-right"><Cell value={section.market?.[field] ?? null} curr={curr} /></td>
          <td className="px-2.5 py-1 text-right bg-blue-50/60"><SubjectCell value={section.subject} curr={curr} /></td>
        </tr>
      ))}
    </>
  );
}
