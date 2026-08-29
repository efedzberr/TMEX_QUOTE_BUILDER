Implement Phase 1 of Roles & Permissions in the UI: a permission catalog, a `usePermissions()` hook that loads the current user's permissions once (RPC `my_permissions()` already exists in the DB), and hiding of sidebar modules / routes the user cannot view. Home is always visible and is the fallback.

Scope of THIS prompt only. Do NOT gate the quote detail page yet, do NOT build the Roles admin tab, do NOT touch `UsersTab.tsx` or the edge function. Do NOT create migrations. Do NOT modify any file other than the 5 listed below.

IMPORTANT: Do NOT append any `export { ... }` statement at the end of any file. Every symbol is already exported inline.

---

## PART A — Create 2 new files (exact contents)

### A1. `src/lib/permissionCatalog.ts`

```ts
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
```

### A2. `src/lib/permissions.tsx`

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { ADMIN_PERMISSION_KEYS, PermissionKey, permissionForViewMode } from './permissionCatalog';
import type { ViewMode } from '../components/Sidebar';

interface PermissionRow {
  permission_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface PermissionsState {
  loading: boolean;
  isAdmin: boolean;
  /** true when the current user may view the given key */
  can: (key: PermissionKey) => boolean;
  /** true when the user may open the given top-level view */
  canView: (mode: ViewMode) => boolean;
  reload: () => Promise<void>;
}

const PermissionsContext = createContext<PermissionsState>({
  loading: true,
  isAdmin: false,
  can: () => false,
  canView: mode => mode === 'home',
  reload: async () => {},
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewable, setViewable] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); setViewable(new Set()); return; }
      const [{ data: profile }, { data: rows, error }] = await Promise.all([
        supabase.from('user_profiles').select('is_admin').eq('id', user.id).maybeSingle(),
        supabase.rpc('my_permissions'),
      ]);
      if (error) console.error('Error loading permissions:', error);
      setIsAdmin(profile?.is_admin === true);
      const set = new Set<string>();
      for (const r of (rows || []) as PermissionRow[]) if (r.can_view) set.add(r.permission_key);
      setViewable(set);
    } catch (err) {
      console.error('Error loading permissions:', err);
      setViewable(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = useMemo<PermissionsState>(() => {
    const can = (key: PermissionKey) => !loading && (isAdmin || viewable.has(key));
    const canView = (mode: ViewMode) => {
      const req = permissionForViewMode(mode);
      if (req === null) return true;
      if (req === 'admin.any') return ADMIN_PERMISSION_KEYS.some(k => can(k));
      return can(req);
    };
    return { loading, isAdmin, can, canView, reload: load };
  }, [loading, isAdmin, viewable, load]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionsState {
  return useContext(PermissionsContext);
}
```

---

## PART B — Targeted edits (find / replace, each `Find` block exists exactly once)

### B1. `src/main.tsx` — 2 edits

Find:
```
import { AuthGate } from './components/auth/LoginFlow.tsx';
```
Replace with:
```
import { AuthGate } from './components/auth/LoginFlow.tsx';
import { PermissionsProvider } from './lib/permissions.tsx';
```

Find:
```
              <AuthGate>
                <App />
              </AuthGate>
```
Replace with:
```
              <AuthGate>
                <PermissionsProvider>
                  <App />
                </PermissionsProvider>
              </AuthGate>
```

### B2. `src/components/Sidebar.tsx` — 2 edits

Find:
```
import { LayoutDashboard, BarChart3, FileText, Layers, Users, Settings, Upload, Truck } from 'lucide-react';
```
Replace with:
```
import { LayoutDashboard, BarChart3, FileText, Layers, Users, Settings, Upload, Truck } from 'lucide-react';
import { usePermissions } from '../lib/permissions';
```

Find:
```
export function Sidebar({ current, onNavigate, isAdmin = false }: SidebarProps) {
  const topItems = NAV_ITEMS.filter(i => !i.pinBottom && (!i.adminOnly || isAdmin));
  const bottomItems = NAV_ITEMS.filter(i => i.pinBottom);
```
Replace with:
```
export function Sidebar({ current, onNavigate, isAdmin = false }: SidebarProps) {
  const { canView } = usePermissions();
  const allowed = (i: NavItem) => (!i.adminOnly || isAdmin || canView(i.viewMode)) && canView(i.viewMode);
  const topItems = NAV_ITEMS.filter(i => !i.pinBottom && allowed(i));
  const bottomItems = NAV_ITEMS.filter(i => i.pinBottom && allowed(i));
```

### B3. `src/App.tsx` — 3 edits

Find:
```
import { getPortalUrl, getPreviewUrl } from './lib/customerPortalHelpers';
```
Replace with:
```
import { getPortalUrl, getPreviewUrl } from './lib/customerPortalHelpers';
import { usePermissions } from './lib/permissions';
```

Find:
```
  const [appIsAdmin, setAppIsAdmin] = useState(false);

  useEffect(() => {
    if (viewMode === 'builder' && currentQuoteId) {
```
Replace with:
```
  const [appIsAdmin, setAppIsAdmin] = useState(false);
  const { canView, loading: permissionsLoading } = usePermissions();

  // Permission guard: if the current view is not allowed, go Home
  useEffect(() => {
    if (permissionsLoading) return;
    if (!canView(viewMode)) {
      setCurrentQuoteId(null);
      setQuote(null);
      setViewMode('home');
    }
  }, [permissionsLoading, canView, viewMode]);

  useEffect(() => {
    if (viewMode === 'builder' && currentQuoteId) {
```

Find:
```
  const handleNavigate = (target: ViewMode) => {
    if (target === 'list' || target === 'home') {
```
Replace with:
```
  const handleNavigate = (target: ViewMode) => {
    if (!canView(target)) target = 'home';
    if (target === 'list' || target === 'home') {
```

---

## PART C — Verify
1. Both new files exist with the exact contents and no trailing `export { ... }` line.
2. All 7 edits applied: `PermissionsProvider` appears in main.tsx; `usePermissions` appears in Sidebar.tsx and App.tsx; `permissionsLoading` appears in App.tsx.
3. Run `npm run build` and confirm it succeeds. Do not fix unrelated pre-existing TypeScript warnings in other files.
