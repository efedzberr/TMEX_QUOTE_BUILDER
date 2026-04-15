interface RateDeviationBarProps {
  subjectRPM: number;
  marketAvgRPM: number;
}

export function RateDeviationBar({ subjectRPM, marketAvgRPM }: RateDeviationBarProps) {
  const hasData = marketAvgRPM > 0 && subjectRPM > 0;
  const deviationPct = hasData ? ((subjectRPM - marketAvgRPM) / marketAvgRPM) * 100 : 0;
  const clamped = Math.max(-50, Math.min(50, deviationPct));
  const isAbove = clamped > 0;
  const barWidth = Math.abs(clamped) * 2;
  const color = isAbove ? (clamped > 10 ? '#EF4444' : '#F59E0B') : '#22C55E';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5">
      <h4 className="text-[10px] font-bold text-gray-900 uppercase tracking-wider mb-2">Rate Deviation from Market Average</h4>
      {hasData ? (
        <div className="space-y-1">
          <div className="text-[10px] text-gray-500">For this rate</div>
          <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
            <div className="absolute top-0 left-1/2 w-px h-full bg-gray-400 z-10" />
            <div
              className="absolute top-0 h-full rounded-full transition-all"
              style={{
                backgroundColor: color,
                width: `${barWidth}%`,
                ...(isAbove ? { left: '50%' } : { right: '50%' }),
              }}
            />
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">-50%</span>
            <span className="font-semibold" style={{ color }}>
              {deviationPct >= 0 ? '+' : ''}{deviationPct.toFixed(1)}%
            </span>
            <span className="text-gray-400">+50%</span>
          </div>
        </div>
      ) : (
        <div className="text-[10px] text-gray-400 italic py-2">No market data for comparison</div>
      )}
    </div>
  );
}
