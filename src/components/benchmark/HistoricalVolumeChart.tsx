import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { QuoteLane } from '../../lib/supabase';
import { Row, splitByCustomer, getMonthLabels, countByMonth } from './benchmarkUtils';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

interface HistoricalVolumeChartProps {
  lane: QuoteLane;
  accountLanes: Row[];
  partnerAccount: string;
  dateRange: string;
  compact?: boolean;
}

export function HistoricalVolumeChart({ lane, accountLanes, partnerAccount, dateRange, compact = false }: HistoricalVolumeChartProps) {
  const { same } = splitByCustomer(accountLanes, partnerAccount);
  const originBase = lane.origin_city ? lane.origin_city.split(',')[0].trim().toLowerCase() : '';
  const destBase = lane.destination_city ? lane.destination_city.split(',')[0].trim().toLowerCase() : '';
  const sameLane = same.filter(r => {
    const oc = String(r['Origin City'] || '').split(',')[0].trim().toLowerCase();
    const dc = String(r['Destination City'] || '').split(',')[0].trim().toLowerCase();
    return oc === originBase && dc === destBase;
  });
  const monthLabels = useMemo(() => getMonthLabels(dateRange), [dateRange]);
  const volumeData = useMemo(() => countByMonth(sameLane, 'Effective Date', monthLabels), [sameLane, monthLabels]);
  const hasData = volumeData.some(v => v > 0);
  const chartHeight = compact ? 110 : 240;
  const fontSize = compact ? 9 : 10;

  const data = useMemo(() => ({
    labels: monthLabels,
    datasets: [{
      label: 'Loads', data: volumeData, borderColor: '#185FA5', backgroundColor: 'rgba(55,138,221,0.1)',
      fill: true, tension: 0.3, borderWidth: 2, pointRadius: compact ? 2 : 3, pointBackgroundColor: '#185FA5',
    }],
  }), [monthLabels, volumeData, compact]);

  const options = useMemo(() => ({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => `${ctx.raw} loads` } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: fontSize }, maxRotation: 45 } },
      y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: fontSize }, callback: (val: any) => Math.floor(val) === val ? val : '' }, grid: { color: '#f3f4f6' } },
    },
  }), [fontSize]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5">
      <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-1">Historical Volume — This Customer</h4>
      <div className="relative" style={{ height: chartHeight }}>
        {hasData ? <Line data={data} options={options as any} /> : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] text-gray-400 italic">No historical volume data for this customer on this lane</span>
          </div>
        )}
      </div>
    </div>
  );
}
