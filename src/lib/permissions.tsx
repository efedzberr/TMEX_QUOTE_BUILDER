import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { ADMIN_PERMISSION_KEYS, PermissionKey, PermissionLevel, permissionForViewMode } from './permissionCatalog';
import type { ViewMode } from '../components/Sidebar';

interface PermissionRow {
  permission_key: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface ObjectAccessRow {
  object: string;
  view_all: boolean;
  modify_all: boolean;
}

export interface ObjectAccess {
  viewAll: boolean;
  modifyAll: boolean;
}

export interface PermissionsState {
  loading: boolean;
  isAdmin: boolean;
  /** true when the current user has the given level on the key (default: view) */
  can: (key: PermissionKey, level?: PermissionLevel) => boolean;
  /** true when the user may open the given top-level view */
  canView: (mode: ViewMode) => boolean;
  /** View All / Modify All flags of the user's profile for an owned object */
  objectAccess: (object: string) => ObjectAccess;
  reload: () => Promise<void>;
}

const NO_ACCESS: ObjectAccess = { viewAll: false, modifyAll: false };

const PermissionsContext = createContext<PermissionsState>({
  loading: true,
  isAdmin: false,
  can: () => false,
  canView: mode => mode === 'home',
  objectAccess: () => NO_ACCESS,
  reload: async () => {},
});

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [granted, setGranted] = useState<Set<string>>(new Set()); // "key:level"
  const [objects, setObjects] = useState<Record<string, ObjectAccess>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); setGranted(new Set()); setObjects({}); return; }
      const [{ data: profile }, { data: rows, error }, { data: access }] = await Promise.all([
        supabase.from('user_profiles').select('is_admin').eq('id', user.id).maybeSingle(),
        supabase.rpc('my_permissions'),
        supabase.rpc('my_object_access'),
      ]);
      if (error) console.error('Error loading permissions:', error);
      setIsAdmin(profile?.is_admin === true);
      const set = new Set<string>();
      for (const r of (rows || []) as PermissionRow[]) {
        if (r.can_view) set.add(`${r.permission_key}:view`);
        if (r.can_create) set.add(`${r.permission_key}:create`);
        if (r.can_edit) set.add(`${r.permission_key}:edit`);
        if (r.can_delete) set.add(`${r.permission_key}:delete`);
      }
      setGranted(set);
      const obj: Record<string, ObjectAccess> = {};
      for (const a of (access || []) as ObjectAccessRow[]) obj[a.object] = { viewAll: a.view_all, modifyAll: a.modify_all };
      setObjects(obj);
    } catch (err) {
      console.error('Error loading permissions:', err);
      setGranted(new Set());
      setObjects({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = useMemo<PermissionsState>(() => {
    const can = (key: PermissionKey, level: PermissionLevel = 'view') => {
      if (loading) return false;
      if (isAdmin) return true;
      // create / edit / delete imply view
      if (level !== 'view' && !granted.has(`${key}:view`)) return false;
      return granted.has(`${key}:${level}`);
    };
    const canView = (mode: ViewMode) => {
      const req = permissionForViewMode(mode);
      if (req === null) return true;
      if (req === 'admin.any') return ADMIN_PERMISSION_KEYS.some(k => can(k));
      return can(req);
    };
    const objectAccess = (object: string): ObjectAccess => {
      if (loading) return NO_ACCESS;
      if (isAdmin) return { viewAll: true, modifyAll: true };
      return objects[object] || NO_ACCESS;
    };
    return { loading, isAdmin, can, canView, objectAccess, reload: load };
  }, [loading, isAdmin, granted, objects, load]);

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionsState {
  return useContext(PermissionsContext);
}
