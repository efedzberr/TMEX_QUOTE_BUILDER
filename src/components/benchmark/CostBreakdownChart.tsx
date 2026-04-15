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
import { Row, safeNum } from './benchmarkUtils';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, annotationPlugin);

interface CostBreakdownChartProps {
  lane: QuoteLane;
  costStructures: Row[];
}

interface ParsedCostRow {
  label: string;
  lineHaul: number;
  fuel: number;
  borderFee: number;
  accessorials: number;
  other: number;
}

function parseCostRows(rows: Row[]): ParsedCostRow[] {
  return rows.map(r => {
    const name = String(r['Name'] || r['Equipment Type'] || 'Unknown');
    const driverWagesMileage = safeNum(r['Driver Wages Mileage Pay']);
    const purchasedTransportation = safeNum(r['Purchased Transportation']);
    const lineHaul = driverWagesMileage + purchasedTransportation;

    const fuel = safeNum(r['Fuel Expense']) + safeNum(r['Fuel Mileage Taxes']);
    const borderFee = safeNum(r['Road Expenses Tolls']);
    const accessorials = safeNum(r['Driver Wages Accessorial Other']) + safeNum(r['Load Tie Down Protection']);

    const insurance = safeNum(r['Insurance']) + safeNum(r['Insurance Bonds Filings']) + safeNum(r['Self Insurance Claims']) + safeNum(r['Collision Self Ins']);
    const maintenance = safeNum(r['Total Equipment Maintenance']);
    const fixedOps = safeNum(r['Total Fixed Operating Expense']);
    const trailerLease = safeNum(r['Trailer Lease Expense']);
    const trailerWash = safeNum(r['Trailer Washout']);
    const transmexAlloc = safeNum(r['Transmex Allocation']);
    const transmexBenefits = safeNum(r['Transmex Driver Benefits']);
    const other = insurance + maintenance + fixedOps + trailerLease + trailerWash + transmexAlloc + transmexBenefits;

    return { label: name, lineHaul, fuel, borderFee, accessorials, other };
  });
}

export function CostBreakdownChart({ lane, costStructures }: CostBreakdownChartProps) {
  const parsed = useMemo(() => parseCostRows(costStructures), [costStructures]);

  const usFuel = (lane.us_miles || 0) * (lane.us_fuel_rate || 0);
  const mxFuel = (lane.mx_miles || 0) * (lane.mx_fuel_rate || 0);
  const totalLaneCost = (lane.us_rate || 0) + (lane.mx_rate || 0) + usFuel + mxFuel
    + (lane.border_crossing_fee || 0)
    + (lane.us_accessorials_amount || 0) + (lane.mx_accessorials_amount || 0) + (lane.accessorials_amount || 0);

  const hasData = parsed.length > 0;

  const data = useMemo(() => ({
    labels: parsed.map(p => p.label),
    datasets: [
      {
        label: 'Line Haul',
        data: parsed.map(p => p.lineHaul),
        backgroundColor: '#B5D4F4',
        borderRadius: 2,
      },
      {
        label: 'Fuel',
        data: parsed.map(p => p.fuel),
        backgroundColor: '#9FE1CB',
        borderRadius: 2,
      },
      {
        label: 'Border Fee',
        data: parsed.map(p => p.borderFee),
        backgroundColor: '#FAC775',
        borderRadius: 2,
      },
      {
        label: 'Accessorials',
        data: parsed.map(p => p.accessorials),
        backgroundColor: '#D3D1C7',
        borderRadius: 2,
      },
      {
        label: 'Other Costs',
        data: parsed.map(p => p.other),
        backgroundColor: '#E5E7EB',
        borderRadius: 2,
      },
    ],
  }), [parsed]);

  const options = useMemo(() => ({
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw || 0;
            return `${ctx.dataset.label}: $${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          },
        },
      },
      annotation: {
        annotations: totalLaneCost > 0 ? {
          yourCost: {
            type: 'line' as const,
            xMin: totalLaneCost,
            xMax: totalLaneCost,
            borderColor: '#E24B4A',
            borderWidth: 2,
            borderDash: [6, 3],
            label: {
              display: true,
              content: `Your Cost: $${totalLaneCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
              position: 'start' as const,
              backgroundColor: '#E24B4A',
              color: '#fff',
              font: { size: 11 },
              padding: 4,
            },
          },
        } : {},
      },
    },
    scales: {
      x: {
        stacked: true,
        ticks: {
          font: { size: 11 },
          callback: (val: any) => `$${Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        },
        grid: { color: '#f3f4f6' },
      },
      y: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
  }), [totalLaneCost]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Cost Structure Breakdown — from Cost Structure Table</h4>
      {hasData ? (
        <>
          <div className="relative" style={{ height: Math.max(200, parsed.length * 50) }}>
            <Bar data={data} options={options as any} />
          </div>
          <div className="flex items-center gap-5 mt-3 px-1 flex-wrap">
            {[
              { color: '#B5D4F4', label: 'Line Haul' },
              { color: '#9FE1CB', label: 'Fuel' },
              { color: '#FAC775', label: 'Border Fee' },
              { color: '#D3D1C7', label: 'Accessorials' },
              { color: '#E5E7EB', label: 'Other Costs' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-gray-600">{item.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-gray-400 italic">
            No cost structure data available for {lane.equipment_type || 'this equipment type'}
          </span>
        </div>
      )}
    </div>
  );
}
