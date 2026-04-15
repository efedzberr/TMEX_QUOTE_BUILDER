import { BadgeType, BenchmarkSignals } from './signalEngine';
import { formatCurrency, CurrencyCode } from '../../lib/constants';

interface RecommendationPanelProps {
  data: BenchmarkSignals;
  curr: CurrencyCode;
}

const BADGE_STYLES: Record<BadgeType, { bg: string; text: string; border: string }> = {
  'INCREASE RATE': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  'HOLD RATE': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  'REVIEW PRICING': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  'COMPETITIVE OPPORTUNITY': { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
};

export function RecommendationPanel({ data, curr }: RecommendationPanelProps) {
  const style = BADGE_STYLES[data.badge];
  const hasMarketData = data.suggestedRateMid > 0;

  return (
    <div className="flex-[0.8] bg-white border border-gray-200 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Recommendation</h3>

      <div className={`inline-block px-4 py-2 rounded-lg border font-bold text-sm tracking-wide ${style.bg} ${style.text} ${style.border} mb-5`}>
        {data.badge}
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-2">Suggested Rate Range</div>
          {hasMarketData ? (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Min</span>
                <span className="font-semibold text-gray-800">{formatCurrency(data.suggestedRateMin, curr)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Midpoint</span>
                <span className="font-bold text-gray-900">{formatCurrency(data.suggestedRateMid, curr)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Max</span>
                <span className="font-semibold text-gray-800">{formatCurrency(data.suggestedRateMax, curr)}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic">Insufficient market data to suggest range</div>
          )}
        </div>

        {hasMarketData && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-2">Suggested RPM Range</div>
            <div className="text-xs font-semibold text-gray-800">
              ${data.suggestedRPMMin.toFixed(2)} — ${data.suggestedRPMMax.toFixed(2)}
            </div>
          </div>
        )}

        {data.keyFactors.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-2">Key Factors</div>
            <ul className="space-y-1">
              {data.keyFactors.map((f, i) => (
                <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                  <span className="text-gray-400 mt-px">&#x2022;</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasMarketData && (
          <div className="border-t border-gray-100 pt-3">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-2">At Suggested Midpoint Rate</div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Estimated Margin</span>
                <span className={`font-semibold ${data.marginAtMid >= 30 ? 'text-emerald-700' : data.marginAtMid >= 15 ? 'text-amber-700' : 'text-red-600'}`}>
                  {data.marginAtMid.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Estimated Revenue</span>
                <span className="font-semibold text-gray-800">{formatCurrency(data.revenueAtMid, curr)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">vs Cost Structure</span>
                <span className={`font-semibold ${data.vsCostAtMid >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                  {data.vsCostAtMid >= 0 ? '+' : ''}{formatCurrency(Math.abs(data.vsCostAtMid), curr).replace(`${curr} `, '')}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
