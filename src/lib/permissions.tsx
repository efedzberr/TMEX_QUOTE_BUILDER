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
