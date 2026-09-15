import { ShieldCheck } from 'lucide-react';
import { SecurityLogPanel } from './SecurityLogPanel';

export function SecurityTab() {
  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Login History & Activity</h2>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">Every login attempt, session and business event across all users. Records are kept for 12 months.</p>
      </div>
      <SecurityLogPanel showUserFilter />
    </div>
  );
}
