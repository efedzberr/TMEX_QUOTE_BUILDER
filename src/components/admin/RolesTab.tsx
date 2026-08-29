import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Users, X, ChevronRight, ChevronDown, GitBranch, Shield, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { OWNED_OBJECTS } from '../../lib/permissionCatalog';

interface RolesTabProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

interface Role {
  id: string;
  name: string;
  parent_id: string | null;
  description: string | null;
  user_count: number;
}

type SharingAccess = 'private' | 'public_read' | 'public_read_write';

const SHARING_OPTIONS: { value: SharingAccess; label: string; hint: string }[] = [
  { value: 'private', label: 'Private', hint: 'Users see their own records, records without owner, and records owned by users below them in the role hierarchy.' },
  { value: 'public_read', label: 'Public Read Only', hint: 'Everyone can see every record; editing follows ownership and the hierarchy.' },
  { value: 'public_read_write', label: 'Public Read/Write', hint: 'Everyone can see and edit every record.' },
];

type ModalState = { mode: 'create'; parentId: string | null } | { mode: 'edit'; role: Role } | { mode: 'delete'; role: Role } | null;

export function RolesTab({ onToast }: RolesTabProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalBusy, setModalBusy] = useState(false);

  const [sharingSaved, setSharingSaved] = useState<Record<string, SharingAccess>>({});
  const [sharingDraft, setSharingDraft] = useState<Record<string, SharingAccess>>({});
  const [sharingSaving, setSharingSaving] = useState(false);
  const [usersWithoutRole, setUsersWithoutRole] = useState(0);

  async function load() {
    setLoading(true);
    try {
      const [{ data: roleRows, error }, { data: profiles }, { data: sharing }] = await Promise.all([
        supabase.from('roles').select('id,name,parent_id,description').order('name'),
        supabase.from('user_profiles').select('role_id,is_admin'),
        supabase.from('sharing_defaults').select('object,default_access'),
      ]);
      if (error) throw error;
      const counts = new Map<string, number>();
      let noRole = 0;
      for (const p of (profiles || []) as { role_id: string | null; is_admin: boolean }[]) {
        if (p.role_id) counts.set(p.role_id, (counts.get(p.role_id) || 0) + 1);
        else if (!p.is_admin) noRole += 1;
      }
      setUsersWithoutRole(noRole);
      setRoles(((roleRows || []) as Omit<Role, 'user_count'>[]).map(r => ({ ...r, user_count: counts.get(r.id) || 0 })));
      const s: Record<string, SharingAccess> = {};
      for (const o of OWNED_OBJECTS) s[o.key] = 'private';
      for (const row of (sharing || []) as { object: string; default_access: SharingAccess }[]) s[row.object] = row.default_access;
      setSharingSaved(s); setSharingDraft({ ...s });
    } catch (err) {
      console.error('Error loading roles:', err);
      onToast("We couldn't load the roles.", 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const childrenOf = useMemo(() => {
    const m = new Map<string | null, Role[]>();
    for (const r of roles) {
      const list = m.get(r.parent_id) || [];
      list.push(r);
      m.set(r.parent_id, list);
    }
    return m;
  }, [roles]);

  /** ids of a role and all its descendants (cannot become its own parent) */
  function subtreeIds(id: string): Set<string> {
    const out = new Set<string>([id]);
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      for (const c of childrenOf.get(cur) || []) { if (!out.has(c.id)) { out.add(c.id); stack.push(c.id); } }
    }
    return out;
  }

  function rolePath(id: string | null): string {
    const parts: string[] = [];
    let cur = roles.find(r => r.id === id);
    let guard = 0;
    while (cur && guard++ < 100) { parts.unshift(cur.name); cur = roles.find(r => r.id === cur!.parent_id); }
    return parts.join(' \u203A ');
  }

  function openCreate(parent: string | null) { setName(''); setDescription(''); setParentId(parent || ''); setModalError(null); setModal({ mode: 'create', parentId: parent }); }
  function openEdit(role: Role) { setName(role.name); setDescription(role.description || ''); setParentId(role.parent_id || ''); setModalError(null); setModal({ mode: 'edit', role }); }

  async function handleModalSubmit() {
    if (!modal || modal.mode === 'delete') return;
    const n = name.trim();
    if (!n) { setModalError('Name is required.'); return; }
    if (n.length > 60) { setModalError('Name must be 60 characters or fewer.'); return; }
    setModalBusy(true); setModalError(null);
    try {
      if (modal.mode === 'create') {
        const { error } = await supabase.from('roles').insert({ name: n, description: description.trim() || null, parent_id: parentId || null });
        if (error) throw error;
        onToast(`Role "${n}" created`, 'success');
      } else {
        const { error } = await supabase.from('roles').update({ name: n, description: description.trim() || null, parent_id: parentId || null }).eq('id', modal.role.id);
        if (error) throw error;
        onToast('Role updated', 'success');
      }
      setModal(null);
      await load();
    } catch (err) {
      const msg = String((err as { message?: string } | null)?.message ?? '');
      setModalError(msg.includes('duplicate') || msg.includes('unique') ? 'A role with this name already exists.' : msg.includes('ancestor') ? 'A role cannot be moved under one of its own sub-roles.' : "We couldn't save the role.");
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
      await load();
    } catch (err) {
      const msg = String((err as { message?: string } | null)?.message ?? '');
      onToast(msg.includes('cannot be deleted') ? msg : "We couldn't delete the role.", 'error');
      setModal(null);
    } finally {
      setModalBusy(false);
    }
  }

  async function handleSaveSharing() {
    setSharingSaving(true);
    try {
      const rows = OWNED_OBJECTS.map(o => ({ object: o.key, default_access: sharingDraft[o.key] || 'private' }));
      const { error } = await supabase.from('sharing_defaults').upsert(rows, { onConflict: 'object' });
      if (error) throw error;
      setSharingSaved({ ...sharingDraft });
      onToast('Sharing settings saved. They apply immediately to every user.', 'success');
    } catch (err) {
      console.error('Error saving sharing defaults:', err);
      onToast("We couldn't save the sharing settings.", 'error');
    } finally {
      setSharingSaving(false);
    }
  }

  const sharingDirty = JSON.stringify(sharingSaved) !== JSON.stringify(sharingDraft);
  const goingPrivate = OWNED_OBJECTS.some(o => sharingDraft[o.key] === 'private' && sharingSaved[o.key] !== 'private');

  function renderNode(role: Role, depth: number) {
    const kids = childrenOf.get(role.id) || [];
    const isCollapsed = collapsed.has(role.id);
    return (
      <div key={role.id}>
        <div className="group flex items-center gap-2 py-1.5 pr-2 rounded-md hover:bg-gray-50" style={{ paddingLeft: depth * 24 + 4 }}>
          <button
            onClick={() => setCollapsed(prev => { const n = new Set(prev); if (n.has(role.id)) n.delete(role.id); else n.add(role.id); return n; })}
            className={`p-0.5 rounded text-gray-400 hover:text-gray-600 ${kids.length === 0 ? 'invisible' : ''}`}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <GitBranch className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900">{role.name}</span>
          {role.description && <span className="text-xs text-gray-400 truncate hidden md:inline">— {role.description}</span>}
          <span className="ml-1 inline-flex items-center gap-1 text-xs text-gray-500"><Users className="w-3 h-3" /> {role.user_count}</span>
          <span className="flex-1" />
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
            <button onClick={() => openCreate(role.id)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Add sub-role"><Plus className="w-4 h-4" /></button>
            <button onClick={() => openEdit(role)} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Edit"><Pencil className="w-4 h-4" /></button>
            <button
              onClick={() => setModal({ mode: 'delete', role })}
              disabled={role.user_count > 0 || kids.length > 0}
              title={role.user_count > 0 ? 'Assigned to users — reassign them first' : kids.length > 0 ? 'Has sub-roles — move or delete them first' : 'Delete'}
              className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            ><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
        {!isCollapsed && kids.map(k => renderNode(k, depth + 1))}
      </div>
    );
  }

  const roots = childrenOf.get(null) || [];

  return (
    <div className="space-y-8">
      {/* Hierarchy */}
      <section>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><GitBranch className="w-4 h-4 text-gray-400" /> Role Hierarchy</h2>
            <p className="mt-1 text-sm text-gray-500">A role is a position in the organization. Users see and edit records owned by users in roles below theirs. Users at the same level do not see each other's records. Admins always see everything.</p>
          </div>
          <button onClick={() => openCreate(null)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex-shrink-0">
            <Plus className="w-3.5 h-3.5" /> New Top-Level Role
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : roots.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
            No roles yet. Create a top-level role (e.g. "Director") and add sub-roles under it.
          </div>
        ) : (
          <div className="border border-gray-200 rounded-lg p-2">{roots.map(r => renderNode(r, 0))}</div>
        )}
        {usersWithoutRole > 0 && (
          <p className="mt-2 text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {usersWithoutRole} non-admin {usersWithoutRole === 1 ? 'user has' : 'users have'} no role. With Private sharing they only see their own records. Assign roles in Admin → Users.</p>
        )}
      </section>

      {/* Sharing defaults */}
      <section>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><Shield className="w-4 h-4 text-gray-400" /> Sharing Defaults</h2>
            <p className="mt-1 text-sm text-gray-500">Organization-wide default access per object. Profiles with "View All" or "Modify All" and admins are not affected.</p>
          </div>
          <button onClick={handleSaveSharing} disabled={!sharingDirty || sharingSaving} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0">
            <Save className="w-4 h-4" /> {sharingSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Object</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Default access</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {OWNED_OBJECTS.map(o => {
                const v = sharingDraft[o.key] || 'private';
                return (
                  <tr key={o.key} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{o.label}</td>
                    <td className="px-4 py-3">
                      <select value={v} onChange={e => setSharingDraft(prev => ({ ...prev, [o.key]: e.target.value as SharingAccess }))} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {SHARING_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{SHARING_OPTIONS.find(s => s.value === v)?.hint}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {goingPrivate && (
          <p className="mt-2 text-xs text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Switching to Private takes effect immediately: users without a role will only see records they own or that have no owner.</p>
        )}
      </section>

      {/* Modals */}
      {modal && modal.mode !== 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !modalBusy && setModal(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">{modal.mode === 'create' ? 'New Role' : 'Edit Role'}</h3>
              <button onClick={() => setModal(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input type="text" value={name} onChange={e => { setName(e.target.value); setModalError(null); }} maxLength={60} autoFocus placeholder="e.g. Pricing Coordinator" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <label className="block text-xs font-medium text-gray-600 mt-3 mb-1">Reports to <span className="text-gray-400">(parent role)</span></label>
            <select value={parentId} onChange={e => setParentId(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Top level —</option>
              {roles
                .filter(r => modal.mode !== 'edit' || !subtreeIds(modal.role.id).has(r.id))
                .map(r => <option key={r.id} value={r.id}>{rolePath(r.id)}</option>)}
            </select>
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
            <h3 className="text-base font-semibold text-gray-900 mb-2">Delete Role</h3>
            <p className="text-sm text-gray-600 mb-5">Delete <span className="font-medium">"{modal.role.name}"</span>? This action can't be undone.</p>
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
