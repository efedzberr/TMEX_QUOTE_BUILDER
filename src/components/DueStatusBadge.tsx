import { CheckCircle2, AlertTriangle, AlertOctagon, Lock, Minus } from 'lucide-react';
import { DueStatusInfo, DueStatusKey } from '../lib/dueStatus';

const STYLES: Record<DueStatusKey, { className: string; Icon: typeof CheckCircle2 }> = {
  on_time: { className: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircle2 },
  due_soon: { className: 'bg-amber-50 text-amber-700 border-amber-200', Icon: AlertTriangle },
  overdue: { className: 'bg-red-50 text-red-700 border-red-200', Icon: AlertOctagon },
  closed: { className: 'bg-gray-100 text-gray-600 border-gray-200', Icon: Lock },
  none: { className: 'bg-gray-50 text-gray-400 border-gray-200', Icon: Minus },
};

interface DueStatusBadgeProps {
  status: DueStatusInfo;
  /** show "(3 days left)" / "(2 days overdue)" after the label */
  showDays?: boolean;
  className?: string;
}

export function DueStatusBadge({ status, showDays = false, className = '' }: DueStatusBadgeProps) {
  const { className: colors, Icon } = STYLES[status.key];
  let suffix = '';
  if (showDays && status.daysLeft !== null && status.key !== 'closed' && status.key !== 'none') {
    const n = Math.abs(status.daysLeft);
    if (status.key === 'overdue') suffix = ` · ${n} ${n === 1 ? 'day' : 'days'} overdue`;
    else if (status.daysLeft === 0) suffix = ' · today';
    else suffix = ` · ${n} ${n === 1 ? 'day' : 'days'} left`;
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border whitespace-nowrap ${colors} ${className}`}>
      <Icon className="w-3.5 h-3.5" />
      {status.label}{suffix}
    </span>
  );
}
