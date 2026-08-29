import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Lock, Users, Save, X, Eye, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../lib/permissions';
import { ALL_PERMISSION_KEYS, OWNED_OBJECTS, PERMISSION_GROUPS, PermissionKey, PermissionLevel } from '../../lib/permissionCatalog';

interface ProfilesTabProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

interface Profile {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  user_count: number;
}

type Grants = Record<string, Set<PermissionLevel>>;           // key -> levels
type ObjectAccessMap = Record<string, { viewAll: boolean; modifyAll: boolean }>;

const LEVELS: { id: PermissionLevel; label: string }[] = [
  { id: 'view', label: 'View' },
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'delete', label: 'Delete' },
];

type ModalState = { mode: 'create' } | { mode: 'rename'; profile: Profile } | { mode: 'delete'; profile: Profile } | null;

function cloneGrants(g: Grants): Grants {
  const out: Grants = {};
  for (const k of Object.keys(g)) out[k] = new Set(g[k]);
  return out;
}
function grantsEqual(a: Grants, b: Grants): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const x = a[k] || new Set(); const y = b[k] || new Set();
    if (x.size !== y.size) return false;
    for (const l of x) if (!y.has(l)) return false;
  }
  return true;
}

export function ProfilesTab({ onToast }: ProfilesTabProps) {
  const { reload: reloadPermissions } = usePermissions();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Grants>({});
  const [draft, setDraft] = useState<Grants>({});
  const [savedObj, setSavedObj] = useState<ObjectAccessMap>({});
  const [draftObj, setDraftObj] = useState<ObjectAccessMap>({});
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);

  const selected = useMemo(() => profiles.find(r => r.id === selectedId) || null, [profiles, selectedId]);
  const dirty = useMemo(() => !grantsEqual(saved, draft) || JSON.stringify(savedObj) !== JSON.stringify(draftObj), [saved, draft, savedObj, draftObj]);

  async function loadProfiles(keepSelection = true) {
    setLoading(true);
    try {
      const [{ data: rows, error }, { data: users }] = await Promise.all([
        supabase.from('profiles').select('id,name,description,is_system').order('is_system', { ascending: false }).order('name'),
        supabase.from('user_profiles').select('profile_id'),
      ]);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const u of (users || []) as { profile_id: string | null }[]) if (u.profile_id) counts.set(u.profile_id, (counts.get(u.profile_id) || 0) + 1);
      const list: Profile[] = ((rows || []) as Omit<Profile, 'user_count'>[]).map(r => ({ ...r, user_count: counts.get(r.id) || 0 }));
      setProfiles(list);
      if (!keepSelection || !selectedId || !list.some(r => r.id === selectedId)) setSelectedId(list[0]?.id ?? null);
    } catch (err) {
      console.error('Error loading profiles:', err);
      onToast("We couldn't load the profiles.", 'error');
    } finally {
      setLoading(false);
    }
  }

  async function loadPermissions(profileId: string) {
    setLoadingPerms(true);
    try {
      const [{ data, error }, { data: access }] = await Promise.all([
        supabase.from('profile_permissions').select('permission_key,can_view,can_create,can_edit,can_delete').eq('profile_id', profileId),
        supabase.from('profile_object_access').select('object,view_all,modify_all').eq('profile_id', profileId),
      ]);
      if (error) throw error;
      const g: Grants = {};
      for (const row of (data || []) as { permission_key: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean }[]) {
        const set = new Set<PermissionLevel>();
        if (row.can_view) set.add('view');
        if (row.can_create) set.add('create');
        if (row.can_edit) set.add('edit');
        if (row.can_delete) set.add('delete');
        g[row.permission_key] = set;
      }
      setSaved(g); setDraft(cloneGrants(g));
      const o: ObjectAccessMap = {};
      for (const a of (access || []) as { object: string; view_all: boolean; modify_all: boolean }[]) o[a.object] = { viewAll: a.view_all, modifyAll: a.modify_all };
      setSavedObj(o); setDraftObj({ ...o });
    } catch (err) {
      console.error('Error loading profile permissions:', err);
      onToast("We couldn't load the profile permissions.", 'error');
    } finally {
      setLoadingPerms(false);
    }
  }

  useEffect(() => { loadProfiles(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (selectedId) loadPermissions(selectedId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selectedId]);

  function selectProfile(id: string) {
    if (id === selectedId) return;
    if (dirty && !window.confirm('You have unsaved changes. Discard them?')) return;
    setSelectedId(id);
  }

  const readOnly = !selected || selected.is_system;

  function toggle(key: PermissionKey, level: PermissionLevel) {
    if (readOnly) return;
    setDraft(prev => {
      const next = cloneGrants(prev);
      const set = next[key] || new Set<PermissionLevel>();
      if (set.has(level)) {
        set.delete(level);
        if (level === 'view') { set.delete('create'); set.delete('edit'); set.delete('delete'); }
      } else {
        set.add(level);
        if (level !== 'view') set.add('view');
      }
      next[key] = set;
      return next;
    });
  }

  function toggleGroup(keys: PermissionKey[], level: PermissionLevel, on: boolean) {
    if (readOnly) return;
    setDraft(prev => {
      const next = cloneGrants(prev);
      for (const k of keys) {
        const def = PERMISSION_GROUPS.flatMap(g => g.permissions).find(p => p.key === k);
        if (!def || !def.levels.includes(level)) continue;
        const set = next[k] || new Set<PermissionLevel>();
        if (on) { set.add(level); set.add('view'); }
        else { set.delete(level); if (level === 'view') { set.delete('create'); set.delete('edit'); set.delete('delete'); } }
        next[k] = set;
      }
      return next;
    });
  }

  function toggleObject(object: string, field: 'viewAll' | 'modifyAll') {
    if (readOnly) return;
    setDraftObj(prev => {
      const cur = prev[object] || { viewAll: false, modifyAll: false };
      const next = { ...cur, [field]: !cur[field] };
      if (field === 'modifyAll' && next.modifyAll) next.viewAll = true;
      if (field === 'viewAll' && !next.viewAll) next.modifyAll = false;
      return { ...prev, [object]: next };
    });
  }

  async function handleSave() {
    if (!selected || readOnly || !dirty) return;
    setSaving(true);
    try {
      const rows = ALL_PERMISSION_KEYS.map(k => {
        const set = draft[k] || new Set<PermissionLevel>();
        return { profile_id: selected.id, permission_key: k, can_view: set.has('view'), can_create: set.has('create'), can_edit: set.has('edit'), can_delete: set.has('delete') };
      });
      const { error } = await supabase.from('profile_permissions').upsert(rows, { onConflict: 'profile_id,permission_key' });
      if (error) throw error;
      const objRows = OWNED_OBJECTS.map(o => ({ profile_id: selected.id, object: o.key, view_all: draftObj[o.key]?.viewAll ?? false, modify_all: draftObj[o.key]?.modifyAll ?? false }));
      const { error: e2 } = await supabase.from('profile_object_access').upsert(objRows, { onConflict: 'profile_id,object' });
      if (e2) throw e2;
      setSaved(cloneGrants(draft)); setSavedObj({ ...draftObj });
      onToast(`Permissions saved for "${selected.name}"`, 'success');
      reloadPermissions();
    } catch (err) {
      console.error('Error saving profile permissions:', err);
      onToast("We couldn't save the permissions.", 'error');
    } finally {
      setSaving(false);
    }
  }

  function openCreate() { setName(''); setDescription(''); setModalError(null); setModal({ mode: 'create' }); }
  function openRename(p: Profile) { setName(p.name); setDescription(p.description || ''); setModalError(null); setModal({ mode: 'rename', profile: p }); }

  async function handleModalSubmit() {
    if (!modal || modal.mode === 'delete') return;
    const n = name.trim();
    if (!n) { setModalError('Name is required.'); return; }
    if (n.length > 60) { setModalError('Name must be 60 characters or fewer.'); return; }
    setModalBusy(true); setModalError(null);
    try {
      if (modal.mode === 'create') {
        const { data, error } = await supabase.from('profiles').insert({ name: n, description: description.trim() || null }).select('id').single();
        if (error) throw error;
        onToast(`Profile "${n}" created`, 'success');
        setModal(null);
        await loadProfiles(false);
        setSelectedId(data.id);
      } else {
        const { error } = await supabase.from('profiles').update({ name: n, description: description.trim() || null }).eq('id', modal.profile.id);
        if (error) throw error;
        onToast('Profile updated', 'success');
        setModal(null);
        await loadProfiles(true);
      }
    } catch (err) {
      const msg = String((err as { message?: string } | null)?.message ?? '');
      setModalError(msg.includes('duplicate') || msg.includes('unique') ? 'A profile with this name already exists.' : "We couldn't save the profile.");
    } finally {
      setModalBusy(false);
    }
  }

  async function handleDelete() {
    if (!modal || modal.mode !== 'delete') return;
    setModalBusy(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', modal.profile.id);
      if (error) throw error;
      onToast(`Profile "${modal.profile.name}" deleted`, 'success');
      setModal(null);
      await loadProfiles(false);
    } catch (err) {
      const msg = String((err as { message?: string } | null)?.message ?? '');
      onToast(msg.includes('assigned to') ? msg : "We couldn't delete the profile.", 'error');
      setModal(null);
    } finally {
      setModalBusy(false);
    }
  }

  return (
    <div className="flex gap-6 min-h-[480px]">
      {/* Profile list */}
      <div className="w-72 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Profiles</h2>
          <button onClick={openCreate} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Profile
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-3">A profile defines what a user can see and do. Record visibility is defined by the role hierarchy in the Roles tab.</p>
        {loading ? (
          <p className="text-sm text-gray-400">Loading profiles...</p>
        ) : (
          <ul className="space-y-1">
            {profiles.map(pr => (
              <li key={pr.id}>
                <button
                  onClick={() => selectProfile(pr.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-md border transition-colors ${pr.id === selectedId ? 'border-blue-300 bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}
                >
                  <div className="flex items-center gap-2">
                    {pr.is_system && <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                    <span className="text-sm font-medium text-gray-900 truncate">{pr.name}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                    <Users className="w-3 h-3" /> {pr.user_count} {pr.user_count === 1 ? 'user' : 'users'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Matrix */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <p className="text-sm text-gray-400">Select a profile to edit its permissions.</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-gray-900 truncate">{selected.name}</h2>
                  {selected.is_system && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200"><Lock className="w-3 h-3" /> System profile</span>
                  )}
                </div>
                {selected.description && <p className="mt-0.5 text-sm text-gray-500">{selected.description}</p>}
                {selected.is_system && <p className="mt-1 text-xs text-gray-400">This profile always has every permission and cannot be modified.</p>}
              </div>
              {!selected.is_system && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openRename(selected)} className="p-2 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700" title="Rename"><Pencil className="w-4 h-4" /></button>
                  <button
                    onClick={() => setModal({ mode: 'delete', profile: selected })}
                    disabled={selected.user_count > 0}
                    title={selected.user_count > 0 ? 'Assigned to users — reassign them first' : 'Delete'}
                    className="p-2 rounded-md border border-gray-200 text-red-500 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-white disabled:cursor-not-allowed"
                  ><Trash2 className="w-4 h-4" /></button>
                  <button onClick={handleSave} disabled={!dirty || saving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {loadingPerms ? (
              <p className="text-sm text-gray-400">Loading permissions...</p>
            ) : (
              <div className="space-y-6">
                {/* Object access */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                    <span className="text-sm font-semibold text-gray-800">Record access</span>
                    <span className="ml-2 text-xs text-gray-500">Overrides the role hierarchy for the whole object</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500">
                        <th className="text-left px-4 py-2 font-medium">Object</th>
                        <th className="px-4 py-2 font-medium w-32"><span className="inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> View All</span></th>
                        <th className="px-4 py-2 font-medium w-32"><span className="inline-flex items-center gap-1"><Wrench className="w-3.5 h-3.5" /> Modify All</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {OWNED_OBJECTS.map(o => {
                        const a = draftObj[o.key] || { viewAll: false, modifyAll: false };
                        return (
                          <tr key={o.key} className="border-t border-gray-100">
                            <td className="px-4 py-2.5 text-gray-900">{o.label}</td>
                            <td className="px-4 py-2.5 text-center"><input type="checkbox" checked={a.viewAll} disabled={readOnly} onChange={() => toggleObject(o.key, 'viewAll')} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60" /></td>
                            <td className="px-4 py-2.5 text-center"><input type="checkbox" checked={a.modifyAll} disabled={readOnly} onChange={() => toggleObject(o.key, 'modifyAll')} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60" /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Permission groups */}
                {PERMISSION_GROUPS.map(group => {
                  const keys = group.permissions.map(p => p.key);
                  const applicable = (lvl: PermissionLevel) => group.permissions.filter(p => p.levels.includes(lvl)).map(p => p.key);
                  return (
                    <div key={group.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <span className="text-sm font-semibold text-gray-800">{group.label}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500">
                            <th className="text-left px-4 py-2 font-medium">Permission</th>
                            {LEVELS.map(l => {
                              const ks = applicable(l.id);
                              const allOn = ks.length > 0 && ks.every(k => draft[k]?.has(l.id));
                              return (
                                <th key={l.id} className="px-2 py-2 font-medium w-24">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span>{l.label}</span>
                                    {!readOnly && ks.length > 0 && (
                                      <button onClick={() => toggleGroup(keys, l.id, !allOn)} className="text-[10px] font-normal text-blue-600 hover:text-blue-700">{allOn ? 'clear' : 'all'}</button>
                                    )}
                                  </div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {group.permissions.map(p => (
                            <tr key={p.key} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <span className="block text-sm text-gray-900">{p.label}</span>
                                <span className="block text-xs text-gray-500">{p.description}</span>
                              </td>
                              {LEVELS.map(l => (
                                <td key={l.id} className="px-2 py-2 text-center">
                                  {p.levels.includes(l.id) ? (
                                    <input
                                      type="checkbox"
                                      checked={draft[p.key]?.has(l.id) ?? false}
                                      disabled={readOnly}
                                      onChange={() => toggle(p.key, l.id)}
                                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                                    />
                                  ) : (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {modal && modal.mode !== 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !modalBusy && setModal(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">{modal.mode === 'create' ? 'New Profile' : 'Rename Profile'}</h3>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input type="text" value={name} onChange={e => { setName(e.target.value); setModalError(null); }} maxLength={60} autoFocus placeholder="e.g. Pricer" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <label className="block text-xs font-medium text-gray-600 mt-3 mb-1">Description <span className="text-gray-400">(optional)</span></label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} maxLength={200} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {modalError && <p className="text-xs text-red-600 mt-2">{modalError}</p>}
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setModal(null)} disabled={modalBusy} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleModalSubmit} disabled={modalBusy || !name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">{modalBusy ? 'Saving...' : modal.mode === 'create' ? 'Create' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {modal && modal.mode === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !modalBusy && setModal(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Profile</h3>
            <p className="text-sm text-gray-600 mb-5">Delete <span className="font-medium">"{modal.profile.name}"</span>? This action can't be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setModal(null)} disabled={modalBusy} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleDelete} disabled={modalBusy} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{modalBusy ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
