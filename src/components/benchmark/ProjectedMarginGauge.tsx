import { useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js';

ChartJS.register(ArcElement, Tooltip);

interface ProjectedMarginGaugeProps {
  marginPct: number;
}

export function ProjectedMarginGauge({ marginPct }: ProjectedMarginGaugeProps) {
  const clamped = Math.max(0, Math.min(100, marginPct));
  const color = clamped >= 30 ? '#22C55E' : clamped >= 15 ? '#F59E0B' : '#EF4444';
  const bgColor = '#e5e7eb';

  const data = useMemo(() => ({
    datasets: [{
      data: [clamped, 100 - clamped],
      backgroundColor: [color, bgColor],
      borderWidth: 0,
      cutout: '75%',
    }],
  }), [clamped, color]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    rotation: -90,
    circumference: 180,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
  }), []);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5">
      <h4 className="text-[10px] font-bold text-gray-900 uppercase tracking-wider mb-1">Projected Margin vs. Target</h4>
      <div className="relative" style={{ height: 100 }}>
        <Doughnut data={data} options={options} />
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <span className="text-lg font-bold" style={{ color }}>{marginPct.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
