import { GaugeData } from './signalEngine';
import { formatCurrency, CurrencyCode } from '../../lib/constants';

interface PricePositioningPanelProps {
  gauges: {
    sameCustomer: GaugeData;
    otherCustomers: GaugeData;
    market: GaugeData;
  };
  curr: CurrencyCode;
}

function getGaugeColor(position: number): string {
  if (position > 1) return 'bg-red-500';
  if (position > 0.67) return 'bg-amber-500';
  if (position > 0.33) return 'bg-blue-500';
  return 'bg-emerald-500';
}

function getGaugeBadge(position: number): { text: string; bg: string; textColor: string } {
  if (position > 1) return { text: 'Above Max', bg: 'bg-red-100', textColor: 'text-red-700' };
  if (position > 0.67) return { text: 'High', bg: 'bg-amber-100', textColor: 'text-amber-700' };
  if (position > 0.33) return { text: 'Mid', bg: 'bg-blue-100', textColor: 'text-blue-700' };
  return { text: 'Low', bg: 'bg-emerald-100', textColor: 'text-emerald-700' };
}

function GaugeRow({ gauge, curr }: { gauge: GaugeData; curr: CurrencyCode }) {
  const delta = gauge.hasData ? gauge.subjectRate - gauge.avg : 0;
  const deltaPct = gauge.hasData && gauge.avg > 0 ? (delta / gauge.avg) * 100 : 0;
  const barColor = getGaugeColor(gauge.position);
  const badge = getGaugeBadge(gauge.position);
  const tooltipText = gauge.hasData
    ? `Range: ${formatCurrency(gauge.min, curr)} — ${formatCurrency(gauge.max, curr)} | Rate: ${formatCurrency(gauge.subjectRate, curr)}`
    : 'No data';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-700">{gauge.label}</span>
        {gauge.hasData ? (
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${badge.bg} ${badge.textColor}`}>{badge.text}</span>
        ) : (
          <span className="text-[9px] font-medium text-gray-400 px-1.5 py-0.5 rounded-full bg-gray-100">No data</span>
        )}
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden" title={tooltipText}>
        {gauge.hasData && (
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${Math.min(100, gauge.position * 100)}%` }} />
        )}
      </div>
      {gauge.hasData ? (
        <div className={`text-[10px] font-medium ${delta > 0 ? 'text-red-600' : delta < 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
          {'\u0394'} {delta >= 0 ? '+' : ''}{formatCurrency(Math.abs(delta), curr).replace(`${curr} `, '')} ({deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
        </div>
      ) : (
        <div className="text-[10px] text-gray-400">No historical data available</div>
      )}
    </div>
  );
}

export function PricePositioningPanel({ gauges, curr }: PricePositioningPanelProps) {
  return (
    <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2.5">
      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">Price Positioning</h3>
      <div className="space-y-2.5">
        <GaugeRow gauge={gauges.sameCustomer} curr={curr} />
        <GaugeRow gauge={gauges.otherCustomers} curr={curr} />
        <GaugeRow gauge={gauges.market} curr={curr} />
      </div>
    </div>
  );
}
