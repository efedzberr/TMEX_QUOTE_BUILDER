import { QuoteLane } from '../../lib/supabase';
import { formatCurrency, CurrencyCode } from '../../lib/constants';

interface AccountLaneRecord { [key: string]: unknown; }

interface BenchmarkSuggestedPriceProps {
  lane: QuoteLane;
  accountLanes: AccountLaneRecord[];
}

export function BenchmarkSuggestedPrice({ lane, accountLanes }: BenchmarkSuggestedPriceProps) {
  const curr = (lane.currency_code || 'USD') as CurrencyCode;
  const usMiles = lane.us_miles || 0;
  const mxMiles = lane.mx_miles || 0;
  const totalMiles = usMiles + mxMiles;
  const usRPM = lane.us_rate_per_mile || 0;
  const mxRPM = lane.mx_rate_per_mile || 0;
  const usFuel = lane.us_fuel_rate || 0;
  const mxFuel = lane.mx_fuel_rate || 0;
  const totalUSPortion = (lane.us_rate || 0) + (usMiles * usFuel);
  const totalMXPortion = (lane.mx_rate || 0) + (mxMiles * mxFuel);
  const borderFee = lane.border_crossing_fee || 0;
  const totalAcc = (lane.us_accessorials_amount || 0) + (lane.mx_accessorials_amount || 0) + (lane.accessorials_amount || 0);
  const totalLaneCost = totalUSPortion + totalMXPortion + borderFee + totalAcc;

  const safeNum = (val: unknown): number => {
    if (val === null || val === undefined || val === '') return 0;
    const n = typeof val === 'number' ? val : parseFloat(String(val));
    return isNaN(n) ? 0 : n;
  };

  let suggestedRPM = usRPM + mxRPM;
  if (accountLanes.length > 0) {
    const rpmValues = accountLanes.map(al => {
      const usR = safeNum(al['US Rate Per Mile']);
      const mxR = safeNum(al['MX Rate Per Mile']);
      if (usR > 0 || mxR > 0) return usR + mxR;
      const total = safeNum(al['Total']) || safeNum(al['Rate']);
      const usMi = safeNum(al['US Miles']);
      const mxMi = safeNum(al['MX Miles']);
      const miles = usMi + mxMi;
      return miles > 0 && total > 0 ? total / miles : 0;
    }).filter(v => v > 0);
    if (rpmValues.length > 0) {
      suggestedRPM = rpmValues.reduce((s, v) => s + v, 0) / rpmValues.length;
    }
  }

  const suggestedLineHaul = totalMiles > 0 ? suggestedRPM * totalMiles : 0;

  let suggestedBCF = borderFee;
  if (accountLanes.length > 0) {
    const bcfValues = accountLanes
      .map(al => safeNum(al['Border Crossing Rate']))
      .filter(v => v > 0);
    if (bcfValues.length > 0) {
      suggestedBCF = bcfValues.reduce((s, v) => s + v, 0) / bcfValues.length;
    }
  }

  const laneTotal = suggestedLineHaul + suggestedBCF + totalAcc;
  const marginPct = laneTotal > 0 ? ((laneTotal - totalLaneCost) / laneTotal) * 100 : 0;
  const marginColor = marginPct >= 30 ? 'bg-emerald-500' : marginPct >= 15 ? 'bg-amber-500' : 'bg-red-500';
  const marginTextColor = marginPct >= 30 ? 'text-emerald-700' : marginPct >= 15 ? 'text-amber-700' : 'text-red-700';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5">
      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">Suggested Price</h3>
      <div className="text-center mb-2">
        <div className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Suggested RPM</div>
        <div className="text-xl font-bold text-gray-900">{formatCurrency(suggestedRPM, curr)}</div>
      </div>
      <div className="space-y-1.5 mb-2">
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-500">Suggested Line Haul</span>
          <span className="font-semibold text-gray-800">{formatCurrency(suggestedLineHaul, curr)}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-500">Suggested BCF</span>
          <span className="font-semibold text-gray-800">{formatCurrency(suggestedBCF, curr)}</span>
        </div>
      </div>
      <div className="border-t border-gray-200 pt-2">
        <div className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Margin Estimate</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${marginColor}`} style={{ width: `${Math.max(0, Math.min(100, marginPct))}%` }} />
          </div>
          <span className={`text-[11px] font-bold ${marginTextColor}`}>{marginPct.toFixed(1)}%</span>
        </div>
        <div className="text-[9px] text-gray-400 mt-0.5">
          {marginPct >= 30 ? 'Healthy margin' : marginPct >= 15 ? 'Moderate margin' : 'Low margin'}
        </div>
      </div>
    </div>
  );
}
