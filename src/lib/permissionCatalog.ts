import type { ViewMode } from '../components/Sidebar';

export type PermissionKey =
  | 'module.quotes' | 'module.mass_update' | 'module.customers' | 'module.dashboards' | 'module.import' | 'module.kpi_sets'
  | 'admin.partner_accounts' | 'admin.bill_to' | 'admin.shippers' | 'admin.cities' | 'admin.global_variables'
  | 'admin.border_crossings' | 'admin.accessorials' | 'admin.terms_conditions'
  | 'admin.account_lanes' | 'admin.cost_structure' | 'admin.market_information' | 'admin.sla' | 'admin.users' | 'admin.profiles' | 'admin.roles'
  | 'quote.header' | 'quote.history' | 'quote.tab_lanes' | 'quote.tab_accessorials' | 'quote.tab_terms' | 'quote.tab_pdf';

export type PermissionLevel = 'view' | 'create' | 'edit' | 'delete';

export interface PermissionDef {
  key: PermissionKey;
  label: string;
  description: string;
  /** which levels make sense for this key (view is always included) */
  levels: PermissionLevel[];
}

/** Objects that have an owner and follow the sharing rules (role hierarchy / View All / Modify All). */
export const OWNED_OBJECTS: { key: string; label: string }[] = [
  { key: 'quote', label: 'Quotes' },
];

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
      { key: 'module.quotes', label: 'Quotes', description: 'Quote list and New Quote', levels: ['view', 'create', 'edit', 'delete'] },
      { key: 'module.mass_update', label: 'Mass Update', description: 'Mass price update and its log', levels: ['view', 'create', 'edit', 'delete'] },
      { key: 'module.customers', label: 'Customers', description: 'Customers module', levels: ['view', 'create', 'edit', 'delete'] },
      { key: 'module.dashboards', label: 'Dashboards', description: 'Dashboards module', levels: ['view', 'create', 'edit', 'delete'] },
      { key: 'module.import', label: 'Import', description: 'Import tool', levels: ['view', 'create', 'edit', 'delete'] },
      { key: 'module.kpi_sets', label: 'KPI Sets', description: 'Manage shared KPI sets and tiles', levels: ['view', 'create', 'edit', 'delete'] },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    permissions: [
      { key: 'admin.partner_accounts', label: 'Partner Accounts', description: 'Admin → Partner Accounts tab', levels: ['view', 'edit'] },
      { key: 'admin.bill_to', label: 'Bill To', description: 'Admin → Bill To tab', levels: ['view', 'edit'] },
      { key: 'admin.shippers', label: 'Shippers', description: 'Admin → Shippers tab', levels: ['view', 'edit'] },
      { key: 'admin.cities', label: 'Cities', description: 'Admin → Cities tab', levels: ['view', 'edit'] },
      { key: 'admin.global_variables', label: 'Global Variables', description: 'Admin → Global Variables tab', levels: ['view', 'edit'] },
      { key: 'admin.border_crossings', label: 'Border Crossing Cities', description: 'Admin → Border Crossing Cities tab', levels: ['view', 'edit'] },
      { key: 'admin.accessorials', label: 'Accessorials', description: 'Admin → Accessorials tab', levels: ['view', 'edit'] },
      { key: 'admin.terms_conditions', label: 'Terms & Conditions', description: 'Admin → Terms & Conditions tab', levels: ['view', 'edit'] },
      { key: 'admin.account_lanes', label: 'Account Lanes', description: 'Admin → Account Lanes tab', levels: ['view', 'edit'] },
      { key: 'admin.cost_structure', label: 'Cost Structure', description: 'Admin → Cost Structure tab', levels: ['view', 'edit'] },
      { key: 'admin.market_information', label: 'Market Information', description: 'Admin → Market Information tab', levels: ['view', 'edit'] },
      { key: 'admin.sla', label: 'SLA', description: 'Admin → SLA tab', levels: ['view', 'edit'] },
      { key: 'admin.users', label: 'Users', description: 'Admin → Users tab', levels: ['view', 'edit'] },
      { key: 'admin.profiles', label: 'Profiles', description: 'Admin → Profiles tab (permissions)', levels: ['view', 'edit'] },
      { key: 'admin.roles', label: 'Roles', description: 'Admin → Roles tab (hierarchy & sharing)', levels: ['view', 'edit'] },
    ],
  },
  {
    id: 'quote',
    label: 'Quote detail',
    permissions: [
      { key: 'quote.header', label: 'Header', description: 'Quote header block', levels: ['view', 'edit'] },
      { key: 'quote.history', label: 'History', description: 'Quote history block', levels: ['view'] },
      { key: 'quote.tab_lanes', label: 'Grid', description: 'Lanes grid tab (includes Benchmark)', levels: ['view', 'edit'] },
      { key: 'quote.tab_accessorials', label: 'Accessorials', description: 'Accessorials tab', levels: ['view', 'edit'] },
      { key: 'quote.tab_terms', label: 'Terms & Conditions', description: 'Terms & Conditions tab', levels: ['view', 'edit'] },
      { key: 'quote.tab_pdf', label: 'PDF', description: 'PDF tab', levels: ['view'] },
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
