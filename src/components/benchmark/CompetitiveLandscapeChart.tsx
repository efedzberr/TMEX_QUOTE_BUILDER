import { useMemo } from 'react';
import { Bubble } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { QuoteLane } from '../../lib/supabase';
import { Row, safeNum, splitByCustomer } from './benchmarkUtils';

ChartJS.register(LinearScale, PointElement, Tooltip);

interface CompetitiveLandscapeChartProps {
  lane: QuoteLane;
  accountLanes: Row[];
  marketInfo: Row[];
  partnerAccount: string;
}

interface BubblePoint {
  x: number;
  y: number;
  r: number;
}

function extractBubbles(rows: Row[], baseRadius: number): BubblePoint[] {
  const points: BubblePoint[] = [];
  for (const row of rows) {
    const totalRate = safeNum(row['Total Amount']);
    const volume = safeNum(row['Annual Ld']) || safeNum(row['Weekly Ld']) * 52 || 1;
    if (totalRate > 0) {
      points.push({ x: totalRate, y: volume, r: baseRadius });
    }
  }
  return points;
}

function extractMarketBubble(rows: Row[]): BubblePoint | null {
  const rates = rows.map(r => safeNum(r['USD Rate']) || safeNum(r['All In Rate'])).filter(v => v > 0);
  if (rates.length === 0) return null;
  const avg = rates.reduce((s, v) => s + v, 0) / rates.length;
  return { x: avg, y: rates.length, r: 12 };
}

export function CompetitiveLandscapeChart({ lane, accountLanes, marketInfo, partnerAccount }: CompetitiveLandscapeChartProps) {
  const { same, others } = splitByCustomer(accountLanes, partnerAccount);

  const sameBubbles = useMemo(() => extractBubbles(same, 6), [same]);
  const otherBubbles = useMemo(() => extractBubbles(others, 5), [others]);
  const marketBubble = useMemo(() => extractMarketBubble(marketInfo), [marketInfo]);

  const subjectTotal = (lane.us_rate || 0) + (lane.mx_rate || 0);
  const subjectVolume = parseFloat(lane.volume || '0') || 1;

  const totalRecords = sameBubbles.length + otherBubbles.length + (marketBubble ? 1 : 0);

  const data = useMemo(() => {
    const datasets: any[] = [
      {
        label: 'Same Customer',
        data: sameBubbles,
        backgroundColor: 'rgba(59,130,246,0.7)',
        borderColor: 'rgba(59,130,246,0.9)',
        borderWidth: 1,
      },
      {
        label: 'Other Customers',
        data: otherBubbles,
        backgroundColor: 'rgba(34,197,94,0.5)',
        borderColor: 'rgba(34,197,94,0.7)',
        borderWidth: 1,
      },
    ];

    if (marketBubble) {
      datasets.push({
        label: 'Market Average',
        data: [marketBubble],
        backgroundColor: 'rgba(245,158,11,0.8)',
        borderColor: 'rgba(245,158,11,1)',
        borderWidth: 1,
      });
    }

    if (subjectTotal > 0) {
      datasets.push({
        label: 'Your Quote',
        data: [{ x: subjectTotal, y: subjectVolume, r: 8 }],
        backgroundColor: 'rgba(226,75,74,0.85)',
        borderColor: 'rgba(226,75,74,1)',
        borderWidth: 2,
      });
    }

    return { datasets };
  }, [sameBubbles, otherBubbles, marketBubble, subjectTotal, subjectVolume]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const p = ctx.raw;
            return `${ctx.dataset.label}: Rate $${Number(p.x).toLocaleString('en-US', { maximumFractionDigits: 0 })}, Volume ${Number(p.y).toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Total Rate (USD)', font: { size: 11 } },
        ticks: {
          font: { size: 10 },
          callback: (val: any) => `$${Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        },
        grid: { color: '#f3f4f6' },
      },
      y: {
        title: { display: true, text: 'Load Volume', font: { size: 11 } },
        beginAtZero: true,
        ticks: { font: { size: 10 } },
        grid: { color: '#f3f4f6' },
      },
    },
  }), []);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Competitive Landscape — Rate vs Volume</h4>
      {totalRecords >= 3 ? (
        <>
          <div className="relative" style={{ height: 280 }}>
            <Bubble data={data} options={options as any} />
          </div>
          <div className="flex items-center gap-5 mt-3 px-1 flex-wrap">
            {[
              { color: 'rgba(59,130,246,0.7)', label: 'Same Customer' },
              { color: 'rgba(34,197,94,0.5)', label: 'Other Customers' },
              { color: 'rgba(245,158,11,0.8)', label: 'Market Average' },
              { color: 'rgba(226,75,74,0.85)', label: 'Your Quote' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center py-16">
          <span className="text-sm text-gray-400 italic text-center max-w-sm">
            Not enough data to render competitive landscape. Adjust filters or market radius to broaden the analysis.
          </span>
        </div>
      )}
    </div>
  );
}
