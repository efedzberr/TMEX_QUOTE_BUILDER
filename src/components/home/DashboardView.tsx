import { FileText, ArrowRight } from 'lucide-react';
import type { ViewMode } from '../Sidebar';

interface DashboardViewProps {
  onNavigate: (v: ViewMode) => void;
}

const KPI_CARDS = [
  { label: 'Open Quotes', value: '\u2014' },
  { label: 'Quoted Value (MTD)', value: '\u2014' },
  { label: 'Sent to Customer', value: '\u2014' },
  { label: 'Accepted', value: '\u2014' },
];

export function DashboardView({ onNavigate }: DashboardViewProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-8 py-10">
        {/* TODO: Replace generic greeting with "Hi, {user}" once a current-user concept exists */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Welcome to Smart Pricing Hub</h1>
          <p className="mt-1 text-sm text-gray-500">Your cross-border freight pricing at a glance.</p>
        </div>

        {/* TODO: KPI values will be computed from the quotes/quote_lanes tables in the dashboard task */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {KPI_CARDS.map(card => (
            <div
              key={card.label}
              className="bg-white rounded-lg border border-gray-200 shadow-sm px-5 py-5"
            >
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>

        {/* TODO: This will list the 5 most recent quotes later */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Recent Quotes</h2>
            <button
              onClick={() => onNavigate('list')}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              View all quotes
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="px-6 py-12 flex flex-col items-center justify-center text-center">
            <FileText className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">Recent quotes will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
