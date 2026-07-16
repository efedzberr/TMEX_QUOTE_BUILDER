import { LayoutDashboard, BarChart3, FileText, Layers, Users, Settings, Upload } from 'lucide-react';

export type ViewMode = 'home' | 'dashboards' | 'list' | 'builder' | 'admin' | 'mass-update' | 'mass-update-log' | 'customers' | 'import';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  viewMode: ViewMode;
  pinBottom?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: LayoutDashboard, viewMode: 'home' },
  { id: 'dashboards', label: 'Dashboards', icon: BarChart3, viewMode: 'dashboards' },
  { id: 'quotes', label: 'Quotes', icon: FileText, viewMode: 'list' },
  { id: 'mass-update', label: 'Mass Update', icon: Layers, viewMode: 'mass-update' },
  { id: 'customers', label: 'Customers', icon: Users, viewMode: 'customers' },
  { id: 'admin', label: 'Admin', icon: Settings, viewMode: 'admin' },
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
    <aside
      className="w-[96px] shrink-0 h-screen sticky top-0 flex flex-col items-center py-4 gap-2"
      style={{ backgroundColor: '#0F2A5C' }}
    >
      {/* Brand tile */}
      <div className="mb-4">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex items-center justify-center">
          <img
            src="/Transmex_Logo_II.jpeg"
            alt="Transmex"
            className="w-10 h-10 rounded-lg object-cover"
          />
        </div>
      </div>

      {/* Main nav items */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
        {topItems.map(item => {
          const active = isActive(current, item.viewMode);
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.viewMode)}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all duration-150 ${
                active
                  ? 'text-white shadow-lg'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
              style={active ? { backgroundColor: '#1D4ED8' } : undefined}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-tight text-center">{item.label}</span>
            </button>
          );
        })}

        {/* Bottom-pinned items */}
        <div className="mt-auto w-full flex flex-col items-center gap-1">
          {bottomItems.map(item => {
            const active = isActive(current, item.viewMode);
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.viewMode)}
                className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all duration-150 ${
                  active
                    ? 'text-white shadow-lg'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
                style={active ? { backgroundColor: '#1D4ED8' } : undefined}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-tight text-center">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* User avatar */}
      <div className="mt-2">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-[11px] font-bold text-white">SG</span>
        </div>
      </div>
    </aside>
  );
}
