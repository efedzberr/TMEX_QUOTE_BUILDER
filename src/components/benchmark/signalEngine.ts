import { QuoteLane } from '../../lib/supabase';
import { Row, safeNum, splitByCustomer, getMonthLabels, countByMonth } from './benchmarkUtils';

export type SignalColor = 'green' | 'amber' | 'red' | 'blue' | 'gray';
export type BadgeType = 'INCREASE RATE' | 'HOLD RATE' | 'REVIEW PRICING' | 'COMPETITIVE OPPORTUNITY';

export interface Signal {
  label: string;
  text: string;
  color: SignalColor;
}

export interface GaugeData {
  label: string;
  position: number;
  min: number;
  max: number;
  avg: number;
  subjectRate: number;
  hasData: boolean;
}

export interface BenchmarkSignals {
  gauges: { sameCustomer: GaugeData; otherCustomers: GaugeData; market: GaugeData };
  signals: Signal[];
  badge: BadgeType;
  suggestedRateMin: number;
  suggestedRateMax: number;
  suggestedRateMid: number;
  suggestedRPMMin: number;
  suggestedRPMMax: number;
  marginAtMid: number;
  revenueAtMid: number;
  vsCostAtMid: number;
  keyFactors: string[];
  totalLaneCost: number;
  subjectTotal: number;
  marketAvgRPM: number;
  subjectRPM: number;
}

function computeTotalRate(rows: Row[]): number[] {
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

function computeRPM(rows: Row[]): number[] {
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

function computeMarketRPM(rows: Row[]): number[] {
  return rows.map(r => {
    const rate = safeNum(r['USD Rate']) || safeNum(r['All In Rate']);
    const miles = safeNum(r['Miles']);
    return miles > 0 && rate > 0 ? rate / miles : 0;
  }).filter(v => v > 0);
}

function computeMarketTotalRate(rows: Row[]): number[] {
  return rows.map(r => safeNum(r['USD Rate']) || safeNum(r['All In Rate'])).filter(v => v > 0);
}

function stats(values: number[]) {
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  return { max, min, avg };
}

function makeGauge(label: string, values: number[], subjectRate: number): GaugeData {
  const s = stats(values);
  if (!s) return { label, position: 0, min: 0, max: 0, avg: 0, subjectRate, hasData: false };
  const range = s.max - s.min;
  const position = range > 0 ? Math.max(0, Math.min(1.2, (subjectRate - s.min) / range)) : 0.5;
  return { label, position, min: s.min, max: s.max, avg: s.avg, subjectRate, hasData: true };
}

export function computeAllSignals(
  lane: QuoteLane,
  accountLanes: Row[],
  marketInfo: Row[],
  partnerAccount: string,
  dateRange: string
): BenchmarkSignals {
  const { same, others } = splitByCustomer(accountLanes, partnerAccount);

  const subjectTotal = (lane.us_rate || 0) + (lane.mx_rate || 0);
  const subjectRPM = (lane.us_rate_per_mile || 0) + (lane.mx_rate_per_mile || 0);
  const subjectBCF = lane.border_crossing_fee || 0;

  const usMiles = lane.us_miles || 0;
  const mxMiles = lane.mx_miles || 0;
  const usFuel = usMiles * (lane.us_fuel_rate || 0);
  const mxFuel = mxMiles * (lane.mx_fuel_rate || 0);
  const totalAcc = (lane.us_accessorials_amount || 0) + (lane.mx_accessorials_amount || 0) + (lane.accessorials_amount || 0);
  const totalLaneCost = (lane.us_rate || 0) + usFuel + (lane.mx_rate || 0) + mxFuel + subjectBCF + totalAcc;

  const sameTotalRates = computeTotalRate(same);
  const othersTotalRates = computeTotalRate(others);
  const marketTotalRates = computeMarketTotalRate(marketInfo);

  const sameGauge = makeGauge('vs Same Customer', sameTotalRates, subjectTotal);
  const othersGauge = makeGauge('vs Other Customers', othersTotalRates, subjectTotal);
  const marketGauge = makeGauge('vs Market', marketTotalRates, subjectTotal);

  const signals: Signal[] = [];

  if (same.length > 5) {
    signals.push({ label: 'Lane Activity', text: `Lane active \u2014 ${same.length} lanes found for this customer`, color: 'green' });
  } else if (same.length >= 1) {
    signals.push({ label: 'Lane Activity', text: `Low activity \u2014 ${same.length} lanes found for this customer`, color: 'amber' });
  } else {
    signals.push({ label: 'Lane Activity', text: 'No historical data for this lane', color: 'red' });
  }

  const monthLabels = getMonthLabels(dateRange);
  const half = Math.floor(monthLabels.length / 2);
  const firstHalfLabels = monthLabels.slice(0, half);
  const secondHalfLabels = monthLabels.slice(half);
  const allRatesByMonth = buildMonthlyRates(accountLanes, monthLabels);
  const firstHalfRates = firstHalfLabels.flatMap(m => allRatesByMonth[m] || []);
  const secondHalfRates = secondHalfLabels.flatMap(m => allRatesByMonth[m] || []);
  const firstAvg = firstHalfRates.length > 0 ? firstHalfRates.reduce((s, v) => s + v, 0) / firstHalfRates.length : 0;
  const secondAvg = secondHalfRates.length > 0 ? secondHalfRates.reduce((s, v) => s + v, 0) / secondHalfRates.length : 0;

  if (firstHalfRates.length < 2 || secondHalfRates.length < 2) {
    signals.push({ label: 'Rate Trend', text: 'Not enough data for trend', color: 'gray' });
  } else if (firstAvg > 0 && secondAvg > firstAvg * 1.03) {
    const pct = ((secondAvg - firstAvg) / firstAvg * 100).toFixed(1);
    signals.push({ label: 'Rate Trend', text: `Rate trending up +${pct}%`, color: 'amber' });
  } else if (firstAvg > 0 && secondAvg < firstAvg * 0.97) {
    const pct = ((firstAvg - secondAvg) / firstAvg * 100).toFixed(1);
    signals.push({ label: 'Rate Trend', text: `Rate trending down ${pct}%`, color: 'green' });
  } else {
    signals.push({ label: 'Rate Trend', text: 'Rate stable', color: 'blue' });
  }

  const dateField = 'Effective From Date';
  const volumeByMonth = countByMonth(accountLanes, dateField, monthLabels);
  const last3 = volumeByMonth.slice(-3);
  const prior3 = volumeByMonth.slice(-6, -3);
  const last3Avg = last3.length > 0 ? last3.reduce((s, v) => s + v, 0) / last3.length : 0;
  const prior3Avg = prior3.length > 0 ? prior3.reduce((s, v) => s + v, 0) / prior3.length : 0;

  if (last3Avg === 0 && prior3Avg === 0) {
    signals.push({ label: 'Volume Trend', text: 'No volume data', color: 'gray' });
  } else if (last3Avg > prior3Avg * 1.1) {
    signals.push({ label: 'Volume Trend', text: 'Volume increasing', color: 'green' });
  } else if (last3Avg < prior3Avg * 0.9) {
    signals.push({ label: 'Volume Trend', text: 'Volume decreasing', color: 'amber' });
  } else {
    signals.push({ label: 'Volume Trend', text: 'Volume stable', color: 'blue' });
  }

  const marketRPMs = computeMarketRPM(marketInfo);
  const marketAvgRPM = marketRPMs.length > 0 ? marketRPMs.reduce((s, v) => s + v, 0) / marketRPMs.length : 0;

  if (marketAvgRPM === 0) {
    signals.push({ label: 'Market Competitiveness', text: 'No market RPM data available', color: 'gray' });
  } else if (subjectRPM > marketAvgRPM * 1.1) {
    signals.push({ label: 'Market Competitiveness', text: 'Rate above market average', color: 'red' });
  } else if (subjectRPM > marketAvgRPM) {
    signals.push({ label: 'Market Competitiveness', text: 'Rate slightly above market', color: 'amber' });
  } else if (subjectRPM >= marketAvgRPM * 0.95) {
    signals.push({ label: 'Market Competitiveness', text: 'Rate at market average', color: 'blue' });
  } else {
    signals.push({ label: 'Market Competitiveness', text: 'Rate below market \u2014 room to increase', color: 'green' });
  }

  const originBase = lane.origin_city ? lane.origin_city.split(',')[0].trim().toLowerCase() : '';
  const destBase = lane.destination_city ? lane.destination_city.split(',')[0].trim().toLowerCase() : '';
  const sameCustomerSameLane = same.filter(r => {
    const oc = String(r['Origin City'] || '').split(',')[0].trim().toLowerCase();
    const dc = String(r['Destination City'] || '').split(',')[0].trim().toLowerCase();
    return oc === originBase && dc === destBase;
  });
  if (sameCustomerSameLane.length > 0) {
    signals.push({ label: 'Customer History', text: `Customer quoted this lane before \u2014 ${sameCustomerSameLane.length} times`, color: 'green' });
  } else {
    signals.push({ label: 'Customer History', text: 'New lane for this customer', color: 'blue' });
  }

  const bcfValues = accountLanes
    .map(r => safeNum(r['Border Crossing Rate']))
    .filter(v => v > 0);
  const avgBCF = bcfValues.length > 0 ? bcfValues.reduce((s, v) => s + v, 0) / bcfValues.length : 0;

  if (avgBCF === 0 || subjectBCF === 0) {
    signals.push({ label: 'Border Crossing', text: 'No BCF comparison data', color: 'gray' });
  } else if (subjectBCF > avgBCF * 1.15) {
    signals.push({ label: 'Border Crossing', text: 'BCF above average for this crossing', color: 'amber' });
  } else if (subjectBCF < avgBCF * 0.85) {
    signals.push({ label: 'Border Crossing', text: 'BCF below average \u2014 opportunity', color: 'green' });
  } else {
    signals.push({ label: 'Border Crossing', text: 'BCF within normal range', color: 'blue' });
  }

  const marginPct = subjectTotal > 0 ? ((subjectTotal - totalLaneCost) / subjectTotal) * 100 : 0;
  if (subjectTotal > 0 && subjectTotal < totalLaneCost) {
    signals.push({ label: 'Cost Structure', text: 'WARNING: Rate below cost structure', color: 'red' });
  } else if (marginPct < 15 && marginPct >= 0) {
    signals.push({ label: 'Cost Structure', text: 'Low margin \u2014 review pricing', color: 'amber' });
  } else if (marginPct > 30) {
    signals.push({ label: 'Cost Structure', text: 'Strong margin on this lane', color: 'green' });
  } else {
    signals.push({ label: 'Cost Structure', text: 'Margin within normal range', color: 'blue' });
  }

  const rateAboveMarket = marketAvgRPM > 0 && subjectRPM > marketAvgRPM * 1.1;
  const rateBelowMarket = marketAvgRPM > 0 && subjectRPM < marketAvgRPM * 0.95;
  const marginLow = marginPct < 15;
  const marginStrong = marginPct > 30;
  const rateBelowCost = subjectTotal > 0 && subjectTotal < totalLaneCost;
  const volumeIncreasing = last3Avg > prior3Avg;
  const newCustomerLane = sameCustomerSameLane.length === 0;
  const noMarketData = marketInfo.length === 0;

  let badge: BadgeType;
  if (rateBelowCost || marginLow) {
    badge = 'REVIEW PRICING';
  } else if (rateAboveMarket) {
    badge = 'REVIEW PRICING';
  } else if (rateBelowMarket && newCustomerLane) {
    badge = 'COMPETITIVE OPPORTUNITY';
  } else if (rateBelowMarket && marginStrong && volumeIncreasing) {
    badge = 'INCREASE RATE';
  } else if (noMarketData) {
    badge = 'HOLD RATE';
  } else {
    badge = 'HOLD RATE';
  }

  const allAccountTotals = computeTotalRate(accountLanes);
  const allAccountRPMs = computeRPM(accountLanes);
  const accountRateStats = stats(allAccountTotals);
  const marketRateStats = stats(marketTotalRates);

  const suggestedRateMid = accountRateStats ? accountRateStats.avg : (marketRateStats ? marketRateStats.avg : 0);
  const suggestedRateMin = suggestedRateMid * 0.95;
  const suggestedRateMax = suggestedRateMid * 1.05;

  const accountRPMStats = stats(allAccountRPMs);
  const marketRPMStats = stats(marketRPMs);
  const suggestedRPMAvg = accountRPMStats ? accountRPMStats.avg : (marketRPMStats ? marketRPMStats.avg : 0);
  const suggestedRPMMin = suggestedRPMAvg * 0.95;
  const suggestedRPMMax = suggestedRPMAvg * 1.05;

  const marginAtMid = suggestedRateMid > 0 ? ((suggestedRateMid - totalLaneCost) / suggestedRateMid) * 100 : 0;
  const revenueAtMid = suggestedRateMid;
  const vsCostAtMid = suggestedRateMid - totalLaneCost;

  const keyFactors: string[] = [];
  const redAmber = signals.filter(s => s.color === 'red' || s.color === 'amber');
  const greens = signals.filter(s => s.color === 'green');
  const prioritized = [...redAmber, ...greens];
  for (let i = 0; i < Math.min(3, prioritized.length); i++) {
    keyFactors.push(prioritized[i].text);
  }
  if (keyFactors.length === 0 && signals.length > 0) {
    keyFactors.push(signals[0].text);
  }

  return {
    gauges: { sameCustomer: sameGauge, otherCustomers: othersGauge, market: marketGauge },
    signals,
    badge,
    suggestedRateMin,
    suggestedRateMax,
    suggestedRateMid,
    suggestedRPMMin,
    suggestedRPMMax,
    marginAtMid,
    revenueAtMid,
    vsCostAtMid,
    keyFactors,
    totalLaneCost,
    subjectTotal,
    marketAvgRPM,
    subjectRPM,
  };
}

function buildMonthlyRates(rows: Row[], monthLabels: string[]): Record<string, number[]> {
  const buckets: Record<string, number[]> = {};
  for (const label of monthLabels) buckets[label] = [];
  for (const row of rows) {
    const dateStr = String(row['Effective From Date'] || row['Effective Date'] || '');
    if (!dateStr) continue;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;
    const key = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
    if (buckets[key] !== undefined) {
      const total = safeNum(row['Total']);
      const val = total > 0 ? total : safeNum(row['Rate']);
      if (val > 0) buckets[key].push(val);
    }
  }
  return buckets;
}
