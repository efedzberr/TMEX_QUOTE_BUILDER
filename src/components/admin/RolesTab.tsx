import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Lock, Users, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/permissions';
import { ALL_PERMISSION_KEYS, PERMISSION_GROUPS, PermissionKey } from '../../lib/permissionCatalog';

interface RolesTabProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  user_count: number;
}

type ModalState = { mode: 'create' } | { mode: 'rename'; role: Role } | { mode: 'delete'; role: Role } | null;

export function RolesTab({ onToast }: RolesTabProps) {
  const { reload: reloadPermissions } = usePermissions();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<PermissionKey>>(new Set());
  const [draft, setDraft] = useState<Set<PermissionKey>>(new Set());
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);

  const selected = useMemo(() => roles.find(r => r.id === selectedId) || null, [roles, selectedId]);
  const dirty = useMemo(() => {
    if (saved.size !== draft.size) return true;
    for (const k of draft) if (!saved.has(k)) return true;
    return false;
  }, [saved, draft]);

  async function loadRoles(keepSelection = true) {
    setLoading(true);
    try {
      const [{ data: roleRows, error }, { data: profileRows }] = await Promise.all([
        supabase.from('roles').select('id,name,description,is_system').order('is_system', { ascending: false }).order('name'),
        supabase.from('user_profiles').select('role_id'),
      ]);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const p of (profileRows || []) as { role_id: string | null }[]) {
        if (p.role_id) counts.set(p.role_id, (counts.get(p.role_id) || 0) + 1);
      }
      const list: Role[] = ((roleRows || []) as Omit<Role, 'user_count'>[]).map(r => ({ ...r, user_count: counts.get(r.id) || 0 }));
      setRoles(list);
      if (!keepSelection || !selectedId || !list.some(r => r.id === selectedId)) setSelectedId(list[0]?.id ?? null);
    } catch (err) {
      console.error('Error loading roles:', err);
      onToast("We couldn't load the roles.", 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadPermissions(roleId: string) {
    setLoadingPerms(true);
    try {
      const { data, error } = await supabase.from('role_permissions').select('permission_key,can_view').eq('role_id', roleId);
      if (error) throw error;
      const set = new Set<PermissionKey>();
      for (const row of (data || []) as { permission_key: PermissionKey; can_view: boolean }[]) if (row.can_view) set.add(row.permission_key);
      setSaved(set);
      setDraft(new Set(set));
    } catch (err) {
      console.error('Error loading role permissions:', err);
      onToast("We couldn't load the role permissions.", 'error');
    } finally {
      setLoadingPerms(false);
    }
  }

  useEffect(() => { loadRoles(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (selectedId) loadPermissions(selectedId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedId]);

  function selectRole(id: string) {
    if (id === selectedId) return;
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    setSelectedId(id);
  }

  function toggle(key: PermissionKey) {
    if (!selected || selected.is_system) return;
    setDraft(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleGroup(keys: PermissionKey[], on: boolean) {
    if (!selected || selected.is_system) return;
    setDraft(prev => {
      const next = new Set(prev);
      for (const k of keys) { if (on) next.add(k); else next.delete(k); }
      return next;
    });
  }

  async function handleSave() {
    if (!selected || selected.is_system || !dirty) return;
    setSaving(true);
    try {
      const rows = ALL_PERMISSION_KEYS.map(k => ({
        role_id: selected.id,
        permission_key: k,
        can_view: draft.has(k),
      }));
      const { error } = await supabase.from('role_permissions').upsert(rows, { onConflict: 'role_id,permission_key' });
      if (error) throw error;
      setSaved(new Set(draft));
      onToast(`Permissions saved for "${selected.name}"`, 'success');
      reloadPermissions();
    } catch (err) {
      console.error('Error saving role permissions:', err);
      onToast("We couldn't save the permissions.", 'error');
    } finally {
      setSaving(false);
    }
  }

  function openCreate() { setName(''); setDescription(''); setModalError(null); setModal({ mode: 'create' }); }
  function openRename(role: Role) { setName(role.name); setDescription(role.description || ''); setModalError(null); setModal({ mode: 'rename', role }); }

  async function handleModalSubmit() {
    if (!modal || modal.mode === 'delete') return;
    const n = name.trim();
    if (!n) { setModalError('Name is required.'); return; }
    if (n.length > 60) { setModalError('Name must be 60 characters or fewer.'); return; }
    setModalBusy(true);
    setModalError(null);
    try {
      if (modal.mode === 'create') {
        const { data, error } = await supabase.from('roles').insert({ name: n, description: description.trim() || null }).select('id').single();
        if (error) throw error;
        onToast(`Role "${n}" created`, 'success');
        setModal(null);
        await loadRoles(false);
        setSelectedId(data.id);
      } else {
        const { error } = await supabase.from('roles').update({ name: n, description: description.trim() || null }).eq('id', modal.role.id);
        if (error) throw error;
        onToast('Role updated', 'success');
        setModal(null);
        await loadRoles(true);
      }
    } catch (err) {
      const msg = String((err as { message?: string } | null)?.message ?? '');
      setModalError(msg.includes('duplicate') || msg.includes('unique') ? 'A role with this name already exists.' : "We couldn't save the role.");
    } finally {
      setModalBusy(false);
    }
  }

  async function handleDelete() {
    if (!modal || modal.mode !== 'delete') return;
    setModalBusy(true);
    try {
      const { error } = await supabase.from('roles').delete().eq('id', modal.role.id);
      if (error) throw error;
      onToast(`Role "${modal.role.name}" deleted`, 'success');
      setModal(null);
      await loadRoles(false);
    } catch (err) {
      const msg = String((err as { message?: string } | null)?.message ?? '');
      onToast(msg.includes('assigned to') ? msg : "We couldn't delete the role.", 'error');
      setModal(null);
    } finally {
      setModalBusy(false);
    }
  }

  return (
    <div className="flex gap-6 min-h-[480px]">
      {/* Role list */}
      <div className="w-72 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Roles</h2>
          <button onClick={openCreate} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Role
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">Loading roles...</p>
        ) : (
          <ul className="space-y-1">
            {roles.map(role => (
              <li key={role.id}>
                <button
                  onClick={() => selectRole(role.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${
                    role.id === selectedId ? 'border-blue-300 bg-blue-50' : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {role.is_system && <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                    <span className="text-sm font-medium text-gray-900 truncate">{role.name}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                    <Users className="w-3 h-3" /> {role.user_count} {role.user_count === 1 ? 'user' : 'users'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Permission matrix */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <p className="text-sm text-gray-400">Select a role to edit its permissions.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{selected.name}</h2>
                  {selected.is_system && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                      <Lock className="w-3 h-3" /> System role
                    </span>
                  )}
                </div>
                {selected.description && <p className="mt-0.5 text-sm text-gray-500">{selected.description}</p>}
                {selected.is_system && <p className="mt-1 text-xs text-gray-400">This role always has every permission and cannot be modified.</p>}
              </div>
              {!selected.is_system && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openRename(selected)} className="p-2 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700" title="Rename">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setModal({ mode: 'delete', role: selected })}
                    disabled={selected.user_count > 0}
                    title={selected.user_count > 0 ? 'Assigned to users — reassign them first' : 'Delete'}
                    className="p-2 rounded-md border border-gray-200 text-red-500 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-white disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!dirty || saving}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {loadingPerms ? (
              <p className="text-sm text-gray-400">Loading permissions...</p>
            ) : (
              <div className="space-y-6">
                {PERMISSION_GROUPS.map(group => {
                  const keys = group.permissions.map(p => p.key);
                  const onCount = keys.filter(k => draft.has(k)).length;
                  const allOn = onCount === keys.length;
                  return (
                    <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <span className="text-sm font-semibold text-gray-800">{group.label} <span className="text-xs font-normal text-gray-400">({onCount}/{keys.length})</span></span>
                        {!selected.is_system && (
                          <button onClick={() => toggleGroup(keys, !allOn)} className="text-xs font-medium text-blue-600 hover:text-blue-700">
                            {allOn ? 'Clear all' : 'Select all'}
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                        {group.permissions.map(p => (
                          <label key={p.key} className={`flex items-start gap-3 px-4 py-2.5 border-b border-gray-100 ${selected.is_system ? 'cursor-default' : 'cursor-pointer hover:bg-gray-50'}`}>
                            <input
                              type="checkbox"
                              checked={draft.has(p.key)}
                              onChange={() => toggle(p.key)}
                              disabled={selected.is_system}
                              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm text-gray-900">{p.label}</span>
                              <span className="block text-xs text-gray-500">{p.description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {modal && modal.mode !== 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !modalBusy && setModal(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">{modal.mode === 'create' ? 'New Role' : 'Rename Role'}</h3>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input type="text" value={name} onChange={e => { setName(e.target.value); setModalError(null); }} maxLength={60} autoFocus placeholder="e.g. Pricer" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <label className="block text-xs font-medium text-gray-600 mt-3 mb-1">Description <span className="text-gray-400">(optional)</span></label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} maxLength={200} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {modalError && <p className="text-xs text-red-600 mt-2">{modalError}</p>}
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setModal(null)} disabled={modalBusy} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleModalSubmit} disabled={modalBusy || !name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                {modalBusy ? 'Saving...' : modal.mode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && modal.mode === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !modalBusy && setModal(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Role</h3>
            <p className="text-sm text-gray-600 mb-5">Delete <span className="font-medium">"{modal.role.name}"</span>? This action can't be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)} disabled={modalBusy} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={modalBusy} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">
                {modalBusy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
