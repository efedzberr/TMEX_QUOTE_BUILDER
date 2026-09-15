import { Check, Circle } from 'lucide-react';
import type { PasswordRule } from '../../lib/passwordPolicy';

export function PasswordRules({ rules, touched }: { rules: PasswordRule[]; touched: boolean }) {
  return (
    <ul className="space-y-1 text-xs">
      {rules.map(r => (
        <li key={r.id} className={`flex items-center gap-1.5 ${r.ok ? 'text-emerald-700' : touched ? 'text-red-600' : 'text-gray-500'}`}>
          {r.ok ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
          <span>{r.label}</span>
        </li>
      ))}
    </ul>
  );
}
