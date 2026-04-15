import { useState } from 'react';
import { RefreshCw, Copy, CheckCircle, ArrowRightCircle } from 'lucide-react';
import { supabase, QuoteLane } from '../../lib/supabase';
import { formatCurrency, CurrencyCode } from '../../lib/constants';
import { BenchmarkSignals } from './signalEngine';

interface BenchmarkSummaryBarProps {
  lane: QuoteLane;
  laneIndex: number;
  data: BenchmarkSignals;
  curr: CurrencyCode;
  accountLaneCount: number;
  marketInfoCount: number;
  costStructureCount: number;
  onRefresh: () => void;
  onBack: () => void;
}

export function BenchmarkSummaryBar({ lane, laneIndex, data, curr, accountLaneCount, marketInfoCount, costStructureCount, onRefresh, onBack }: BenchmarkSummaryBarProps) {
  const [copied, setCopied] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [applying, setApplying] = useState(false);

  const timestamp = new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const totalMiles = (lane.us_miles || 0) + (lane.mx_miles || 0);
  const suggestedUSRPM = totalMiles > 0 && data.suggestedRateMid > 0 ? (data.suggestedRateMid * ((lane.us_miles || 0) / totalMiles)) / (lane.us_miles || 1) : lane.us_rate_per_mile || 0;
  const suggestedMXRPM = totalMiles > 0 && data.suggestedRateMid > 0 ? (data.suggestedRateMid * ((lane.mx_miles || 0) / totalMiles)) / (lane.mx_miles || 1) : lane.mx_rate_per_mile || 0;

  async function handleCopySummary() {
    const text = [
      `Benchmark Analysis — Lane ${laneIndex}: ${lane.origin_city} → ${lane.destination_city}`,
      `Recommendation: ${data.badge}`,
      data.suggestedRateMid > 0 ? `Suggested Rate Range: ${formatCurrency(data.suggestedRateMin, curr)} — ${formatCurrency(data.suggestedRateMax, curr)}` : 'Suggested Rate Range: Insufficient data',
      `Key Factors:`, ...data.keyFactors.map(f => `  - ${f}`),
      `Generated: ${timestamp}`,
    ].join('\n');
    try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleApplySuggested() {
    setApplying(true);
    const usMiles = lane.us_miles || 0;
    const mxMiles = lane.mx_miles || 0;
    const usRate = usMiles > 0 ? suggestedUSRPM * usMiles : lane.us_rate || 0;
    const mxRate = mxMiles > 0 ? suggestedMXRPM * mxMiles : lane.mx_rate || 0;
    const { error } = await supabase.from('quote_lanes').update({ us_rate_per_mile: suggestedUSRPM, mx_rate_per_mile: suggestedMXRPM, us_rate: usRate, mx_rate: mxRate }).eq('id', lane.id);
    setApplying(false);
    setShowConfirm(false);
    if (!error) onBack();
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-gray-500">Analysis as of {timestamp}</span>
          <span className="text-[10px] text-gray-400 ml-3">AL: {accountLaneCount} | MI: {marketInfoCount} | CS: {costStructureCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button onClick={handleCopySummary} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50">
            {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy Summary'}
          </button>
          {data.suggestedRateMid > 0 && (
            <button onClick={() => setShowConfirm(true)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-blue-600 rounded hover:bg-blue-700">
              <ArrowRightCircle className="w-3 h-3" /> Apply Rate
            </button>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-[400px] p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Apply Suggested Rate</h3>
            <p className="text-xs text-gray-600 mb-3">Apply the suggested midpoint rate to this lane?</p>
            <div className="bg-gray-50 border border-gray-200 rounded p-2.5 mb-4 space-y-1">
              <div className="flex justify-between text-xs"><span className="text-gray-500">US Rate Per Mile</span><span className="font-semibold">${suggestedUSRPM.toFixed(2)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-gray-500">MX Rate Per Mile</span><span className="font-semibold">${suggestedMXRPM.toFixed(2)}</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirm(false)} className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              <button onClick={handleApplySuggested} disabled={applying} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50">{applying ? 'Applying...' : 'Apply'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
