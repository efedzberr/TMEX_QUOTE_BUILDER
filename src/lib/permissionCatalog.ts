import type { ViewMode } from '../components/Sidebar';

export type PermissionKey =
  | 'module.quotes' | 'module.mass_update' | 'module.customers' | 'module.dashboards' | 'module.import'
  | 'admin.users' | 'admin.cost_structure' | 'admin.market_information' | 'admin.account_lanes' | 'admin.roles'
  | 'quote.header' | 'quote.history' | 'quote.tab_lanes' | 'quote.tab_accessorials' | 'quote.tab_terms' | 'quote.tab_pdf';

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
}

export interface PermissionGroup {
  id: 'modules' | 'admin' | 'quote';
  label: string;
  permissions: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: 'modules',
    label: 'Modules',
    permissions: [
      { key: 'module.quotes', label: 'Quotes', description: 'Quote list and New Quote' },
      { key: 'module.mass_update', label: 'Mass Update', description: 'Mass price update and its log' },
      { key: 'module.customers', label: 'Customers', description: 'Customers module' },
      { key: 'module.dashboards', label: 'Dashboards', description: 'Dashboards module' },
      { key: 'module.import', label: 'Import', description: 'Import tool' },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    permissions: [
      { key: 'admin.users', label: 'Users', description: 'Admin → Users tab' },
      { key: 'admin.cost_structure', label: 'Cost Structure', description: 'Admin → Cost Structure tab' },
      { key: 'admin.market_information', label: 'Market Information', description: 'Admin → Market Information tab' },
      { key: 'admin.account_lanes', label: 'Account Lanes', description: 'Admin → Account Lanes tab' },
      { key: 'admin.roles', label: 'Roles', description: 'Admin → Roles tab' },
    ],
  },
  {
    id: 'quote',
    label: 'Quote detail',
    permissions: [
      { key: 'quote.header', label: 'Header', description: 'Quote header block' },
      { key: 'quote.history', label: 'History', description: 'Quote history block' },
      { key: 'quote.tab_lanes', label: 'Grid', description: 'Lanes grid tab (includes Benchmark)' },
      { key: 'quote.tab_accessorials', label: 'Accessorials', description: 'Accessorials tab' },
      { key: 'quote.tab_terms', label: 'Terms & Conditions', description: 'Terms & Conditions tab' },
      { key: 'quote.tab_pdf', label: 'PDF', description: 'PDF tab' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));

export const ADMIN_PERMISSION_KEYS: PermissionKey[] = PERMISSION_GROUPS
  .find(g => g.id === 'admin')!.permissions.map(p => p.key);

/** Which permission a top-level view requires. Home is always allowed (null). Admin requires any admin.* key. */
export function permissionForViewMode(mode: ViewMode): PermissionKey | 'admin.any' | null {
  switch (mode) {
    case 'home': return null;
    case 'list':
    case 'builder': return 'module.quotes';
    case 'mass-update':
    case 'mass-update-log': return 'module.mass_update';
    case 'customers': return 'module.customers';
    case 'dashboards': return 'module.dashboards';
    case 'import': return 'module.import';
    case 'admin': return 'admin.any';
    default: return null;
  }
}
