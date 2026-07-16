import { LayoutDashboard, FileText, Layers, Users, Settings, Upload } from 'lucide-react';

export type ViewMode = 'home' | 'list' | 'builder' | 'admin' | 'mass-update' | 'mass-update-log' | 'customers' | 'import';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  viewMode: ViewMode;
  pinBottom?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: LayoutDashboard, viewMode: 'home' },
  { id: 'quotes', label: 'Quotes', icon: FileText, viewMode: 'list' },
  { id: 'mass-update', label: 'Mass Price Update', icon: Layers, viewMode: 'mass-update' },
  { id: 'customers', label: 'Customers', icon: Users, viewMode: 'customers' },
  { id: 'admin', label: 'Administration', icon: Settings, viewMode: 'admin' },
  { id: 'import', label: 'Import', icon: Upload, viewMode: 'import', pinBottom: true },
];

interface SidebarProps {
  current: ViewMode;
  onNavigate: (v: ViewMode) => void;
}

function isActive(current: ViewMode, itemViewMode: ViewMode): boolean {
  if (itemViewMode === 'list' && current === 'builder') return true;
  if (itemViewMode === 'mass-update' && current === 'mass-update-log') return true;
  return current === itemViewMode;
}

export function Sidebar({ current, onNavigate }: SidebarProps) {
  const topItems = NAV_ITEMS.filter(i => !i.pinBottom);
  const bottomItems = NAV_ITEMS.filter(i => i.pinBottom);

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <img
            src="/Transmex_Logo_II.jpeg"
            alt="Transmex Logo"
            className="h-9 w-9 rounded object-cover"
          />
          <span className="text-sm font-semibold text-gray-800 leading-tight">
            Smart Pricing Hub
          </span>
        </div>
      </div>

      <nav className="flex-1 flex flex-col px-3 py-4 overflow-y-auto">
        <ul className="space-y-1">
          {topItems.map(item => {
            const active = isActive(current, item.viewMode);
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.viewMode)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-600 rounded-r" />
                  )}
                  <item.icon className={`w-[18px] h-[18px] ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>

        <ul className="mt-auto space-y-1 pt-4 border-t border-gray-100">
          {bottomItems.map(item => {
            const active = isActive(current, item.viewMode);
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.viewMode)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-blue-600 rounded-r" />
                  )}
                  <item.icon className={`w-[18px] h-[18px] ${active ? 'text-blue-600' : 'text-gray-400'}`} />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
