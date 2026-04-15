import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { QuoteHistory as QuoteHistoryType } from '../lib/supabase';

interface QuoteHistoryProps {
  history: QuoteHistoryType[];
}

export function QuoteHistory({ history }: QuoteHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-gray-50 rounded-lg shadow-sm border border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-600" />
          )}
          <h2 className="text-lg font-semibold text-gray-900">Quote History</h2>
          <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
            {history.length} {history.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-4">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {history.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {new Date(entry.date).toLocaleDateString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {entry.user_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {entry.action}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {entry.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
