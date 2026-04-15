import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { QuoteLane } from '../../lib/supabase';
import { Row, safeNum, splitByCustomer, getMonthLabels, groupByMonth } from './benchmarkUtils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, annotationPlugin);

interface RateTrendChartProps {
  lane: QuoteLane;
  accountLanes: Row[];
  partnerAccount: string;
  dateRange: string;
  compact?: boolean;
}

function totalRateExtractor(r: Row): number {
  const total = safeNum(r['Total']);
  if (total > 0) return total;
  const usRate = safeNum(r['US Rate']);
  const mxRate = safeNum(r['MX Rate']);
  const bcr = safeNum(r['Border Crossing Rate']);
  if (usRate > 0 || mxRate > 0) return usRate + mxRate + bcr;
  return safeNum(r['Rate']);
}

export function RateTrendChart({ lane, accountLanes, partnerAccount, dateRange, compact = false }: RateTrendChartProps) {
  const { same, others } = splitByCustomer(accountLanes, partnerAccount);
  const monthLabels = useMemo(() => getMonthLabels(dateRange), [dateRange]);
  const sameRates = useMemo(() => groupByMonth(same, 'Effective Date', totalRateExtractor, monthLabels), [same, monthLabels]);
  const othersRates = useMemo(() => groupByMonth(others, 'Effective Date', totalRateExtractor, monthLabels), [others, monthLabels]);
  const subjectTotal = (lane.us_rate || 0) + (lane.mx_rate || 0);
  const chartHeight = compact ? 110 : 240;
  const fontSize = compact ? 9 : 10;

  const data = useMemo(() => ({
    labels: monthLabels,
    datasets: [
      { label: 'Same Customer', data: sameRates.map(v => v || null), borderColor: '#185FA5', backgroundColor: '#185FA5', tension: 0.3, borderWidth: 2, pointRadius: compact ? 2 : 3, pointBackgroundColor: '#185FA5', spanGaps: true },
      { label: 'Other Customers', data: othersRates.map(v => v || null), borderColor: '#1D9E75', backgroundColor: '#1D9E75', tension: 0.3, borderWidth: 2, pointRadius: compact ? 2 : 3, pointBackgroundColor: '#1D9E75', spanGaps: true },
    ],
  }), [monthLabels, sameRates, othersRates, compact]);

  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: any) => { const val = ctx.raw; return val ? `${ctx.dataset.label}: $${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''; } } },
      annotation: {
        annotations: subjectTotal > 0 ? {
          currentQuote: {
            type: 'line' as const, yMin: subjectTotal, yMax: subjectTotal,
            borderColor: '#EF9F27', borderWidth: 2, borderDash: [4, 2],
            label: { display: true, content: `Current Quote: $${subjectTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, position: 'end' as const, backgroundColor: '#EF9F27', color: '#fff', font: { size: compact ? 9 : 11 }, padding: 3 },
          },
        } : {},
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: fontSize }, maxRotation: 45 } },
      y: { beginAtZero: false, ticks: { font: { size: fontSize }, callback: (val: any) => `$${Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 })}` }, grid: { color: '#f3f4f6' } },
    },
  }), [subjectTotal, compact, fontSize]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5">
      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Rate Trend — Same Lane</h4>
      <div className="relative" style={{ height: chartHeight }}>
        <Line data={data} options={options as any} />
      </div>
      <div className="flex items-center gap-3 mt-1 px-0.5">
        {[
          { color: '#185FA5', label: 'Same Customer' },
          { color: '#1D9E75', label: 'Other Customers' },
          { color: '#EF9F27', label: 'Current Quote', border: true },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm" style={item.border ? { borderColor: item.color, borderWidth: 2, backgroundColor: 'transparent' } : { backgroundColor: item.color }} />
            <span className="text-[10px] text-gray-600">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
