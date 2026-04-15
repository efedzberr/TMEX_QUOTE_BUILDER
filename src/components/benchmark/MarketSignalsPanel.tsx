import { Signal, SignalColor, BadgeType } from './signalEngine';

interface MarketSignalsPanelProps {
  signals: Signal[];
  badge: BadgeType;
  keyFactors: string[];
}

const DOT_COLORS: Record<SignalColor, string> = {
  green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-blue-500', gray: 'bg-gray-400',
};
const TEXT_COLORS: Record<SignalColor, string> = {
  green: 'text-emerald-700', amber: 'text-amber-700', red: 'text-red-700', blue: 'text-blue-700', gray: 'text-gray-500',
};

const BADGE_STYLES: Record<BadgeType, string> = {
  'INCREASE RATE': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'HOLD RATE': 'bg-blue-100 text-blue-800 border-blue-300',
  'REVIEW PRICING': 'bg-amber-100 text-amber-800 border-amber-300',
  'COMPETITIVE OPPORTUNITY': 'bg-teal-100 text-teal-800 border-teal-300',
};

export function MarketSignalsPanel({ signals, badge, keyFactors }: MarketSignalsPanelProps) {
  return (
    <div className="flex-1 bg-white border border-gray-200 rounded-lg p-2.5">
      <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">Market Signals</h3>
      <div className="space-y-1">
        {signals.map((signal, i) => (
          <div key={i} className="flex items-center gap-2 py-0.5">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLORS[signal.color]}`} />
            <span className={`text-[11px] ${TEXT_COLORS[signal.color]} truncate`}>{signal.text}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 bg-amber-50/80 rounded p-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Recommendation</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${BADGE_STYLES[badge]}`}>{badge}</span>
        </div>
        {keyFactors.length > 0 && (
          <p className="text-[10px] text-amber-800 leading-relaxed">
            {keyFactors.join(' — ')}
          </p>
        )}
      </div>
    </div>
  );
}
