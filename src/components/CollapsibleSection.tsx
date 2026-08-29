import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  /** unique key used to remember the open/closed state in this browser */
  storageKey: string;
  defaultOpen?: boolean;
  /** optional content rendered at the right of the title (badges, actions) */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const PREFIX = 'sph.section.';

export function CollapsibleSection({ title, storageKey, defaultOpen = true, aside, children, className = '' }: CollapsibleSectionProps) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = window.localStorage.getItem(PREFIX + storageKey);
      return v === null ? defaultOpen : v === '1';
    } catch {
      return defaultOpen;
    }
  });

  useEffect(() => {
    try { window.localStorage.setItem(PREFIX + storageKey, open ? '1' : '0'); } catch { /* ignore */ }
  }, [open, storageKey]);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="text-sm font-semibold text-gray-900">{title}</span>
        </span>
        {aside && <span onClick={e => e.stopPropagation()}>{aside}</span>}
      </button>
      {open && <div className="border-t border-gray-100">{children}</div>}
    </div>
  );
}
