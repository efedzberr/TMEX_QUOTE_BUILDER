import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { QuoteLane } from '../../lib/supabase';
import { Row, safeNum, splitByCustomer } from './benchmarkUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, annotationPlugin);

interface RpmDistributionChartProps {
  lane: QuoteLane;
  accountLanes: Row[];
  marketInfo: Row[];
  partnerAccount: string;
  compact?: boolean;
}

const BUCKET_LABELS = ['$1.00', '$1.20', '$1.40', '$1.60', '$1.80', '$2.00', '$2.20', '$2.40', '$2.60', '$2.80', '$3.00+'];
const BUCKET_BOUNDS = [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, Infinity];

function bucketize(values: number[]): number[] {
  const counts = new Array(BUCKET_LABELS.length).fill(0);
  for (const v of values) {
    if (v <= 0) continue;
    let placed = false;
    for (let i = 0; i < BUCKET_BOUNDS.length; i++) {
      if (v < BUCKET_BOUNDS[i]) { counts[i]++; placed = true; break; }
    }
    if (!placed) counts[counts.length - 1]++;
  }
  return counts;
}

export function RpmDistributionChart({ lane, accountLanes, marketInfo, partnerAccount, compact = false }: RpmDistributionChartProps) {
  const { same, others } = splitByCustomer(accountLanes, partnerAccount);
  const sameRPMs = same.map(r => {
    const usRpm = safeNum(r['US Rate Per Mile']);
    const mxRpm = safeNum(r['MX Rate Per Mile']);
    if (usRpm > 0 || mxRpm > 0) return usRpm + mxRpm;
    const total = safeNum(r['Total']) || safeNum(r['Rate']);
    const usMi = safeNum(r['US Miles']);
    const mxMi = safeNum(r['MX Miles']);
    const totalMiles = usMi + mxMi;
    return totalMiles > 0 && total > 0 ? total / totalMiles : 0;
  }).filter(v => v > 0);
  const othersRPMs = others.map(r => {
    const usRpm = safeNum(r['US Rate Per Mile']);
    const mxRpm = safeNum(r['MX Rate Per Mile']);
    if (usRpm > 0 || mxRpm > 0) return usRpm + mxRpm;
    const total = safeNum(r['Total']) || safeNum(r['Rate']);
    const usMi = safeNum(r['US Miles']);
    const mxMi = safeNum(r['MX Miles']);
    const totalMiles = usMi + mxMi;
    return totalMiles > 0 && total > 0 ? total / totalMiles : 0;
  }).filter(v => v > 0);
  const marketRPMs = marketInfo.map(r => {
    const rate = safeNum(r['USD Rate']) || safeNum(r['All In Rate']);
    const miles = safeNum(r['Miles']);
    return miles > 0 && rate > 0 ? rate / miles : 0;
  }).filter(v => v > 0);
  const subjectRPM = (lane.us_rate_per_mile || 0) + (lane.mx_rate_per_mile || 0);

  const data = useMemo(() => ({
    labels: BUCKET_LABELS,
    datasets: [
      { label: 'Same Customer', data: bucketize(sameRPMs), backgroundColor: '#B5D4F4', borderRadius: 2 },
      { label: 'Other Customers', data: bucketize(othersRPMs), backgroundColor: '#9FE1CB', borderRadius: 2 },
      { label: 'Market', data: bucketize(marketRPMs), backgroundColor: '#FAC775', borderRadius: 2 },
    ],
  }), [sameRPMs, othersRPMs, marketRPMs]);

  const annotationValue = useMemo(() => {
    let idx = BUCKET_LABELS.length - 1;
    for (let i = 0; i < BUCKET_BOUNDS.length; i++) {
      if (subjectRPM < BUCKET_BOUNDS[i]) { idx = i; break; }
    }
    return idx;
  }, [subjectRPM]);

  const chartHeight = compact ? 130 : 240;
  const fontSize = compact ? 9 : 11;

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => `${ctx.dataset.label}: ${ctx.raw} lanes` } },
      annotation: {
        annotations: subjectRPM > 0 ? {
          subjectLine: {
            type: 'line' as const, xMin: annotationValue, xMax: annotationValue,
            borderColor: '#185FA5', borderWidth: 2, borderDash: [4, 2],
            label: { display: true, content: `Your Rate: $${subjectRPM.toFixed(2)}`, position: 'start' as const, backgroundColor: '#185FA5', color: '#fff', font: { size: compact ? 9 : 11 }, padding: 3 },
          },
        } : {},
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: fontSize }, maxRotation: 45 } },
      y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: fontSize }, callback: (val: any) => Math.floor(val) === val ? val : '' }, grid: { color: '#f3f4f6' } },
    },
  }), [subjectRPM, annotationValue, compact, fontSize]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5">
      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">RPM Distribution — Lane Market</h4>
      <div className="relative" style={{ height: chartHeight }}>
        <Bar data={data} options={options as any} />
      </div>
      <div className="flex items-center gap-3 mt-1 px-0.5">
        {[
          { color: '#B5D4F4', label: 'Same Customer' },
          { color: '#9FE1CB', label: 'Other Customers' },
          { color: '#FAC775', label: 'Market' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-[10px] text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
