import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ListView, ListViewColumn, ListViewSort, ListViewFilter } from './QuotesHomeHeader';

export type ViewModalType = 'new' | 'clone' | 'rename' | 'sharing' | 'delete' | null;

interface ListViewModalsProps {
  modalType: ViewModalType;
  onClose: () => void;
  activeView: ListView | null;
  userId: string | null;
  isAdmin: boolean;
  effectiveColumns: ListViewColumn[];
  effectiveSorting: ListViewSort[];
  effectiveFilters: ListViewFilter[];
  effectiveFilterLogic: string;
  onViewCreated: (view: ListView) => void;
  onViewUpdated: (view: ListView) => void;
  onViewDeleted: (deletedId: string) => void;
}

export function ListViewModals({
  modalType, onClose, activeView, userId, isAdmin,
  effectiveColumns, effectiveSorting, effectiveFilters, effectiveFilterLogic,
  onViewCreated, onViewUpdated, onViewDeleted,
}: ListViewModalsProps) {
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!modalType) return;
    setError(null);
    setSaving(false);
    if (modalType === 'new') {
      setName('');
      setVisibility('private');
    } else if (modalType === 'clone') {
      setName(`Copy of ${activeView?.name || ''}`);
      setVisibility('private');
    } else if (modalType === 'rename') {
      setName(activeView?.name || '');
    } else if (modalType === 'sharing') {
      setVisibility(activeView?.visibility === 'public' ? 'public' : 'private');
    }
  }, [modalType, activeView]);

  async function validateName(n: string): Promise<string | null> {
    if (!n.trim()) return 'Name is required.';
    if (n.trim().length > 80) return 'Name must be 80 characters or fewer.';
    const { data } = await supabase
      .from('list_views')
      .select('id')
      .eq('object', 'quote')
      .ilike('name', n.trim());
    const existing = data?.filter(v => v.id !== activeView?.id) || [];
    if (existing.length > 0) return 'A view with this name already exists.';
    return null;
  }

  async function handleCreateOrClone() {
    const err = await validateName(name);
    if (err) { setError(err); return; }
    setSaving(true);

    const newView = {
      name: name.trim(),
      object: 'quote',
      owner_user_id: userId,
      visibility: (isAdmin && visibility === 'public') ? 'public' : 'private',
      is_system: false,
      columns: effectiveColumns,
      sorting: effectiveSorting,
      filters: effectiveFilters,
      filter_logic: effectiveFilterLogic,
    };

    const { data, error: dbErr } = await supabase.from('list_views').insert(newView).select().single();
    if (dbErr || !data) {
      setError(dbErr?.message || 'Failed to create view.');
      setSaving(false);
      return;
    }

    await addToRecents(data.id);
    onViewCreated(data as ListView);
    onClose();
  }

  async function handleRename() {
    if (!activeView) return;
    const err = await validateName(name);
    if (err) { setError(err); return; }
    setSaving(true);

    const { error: dbErr } = await supabase.from('list_views')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', activeView.id);
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }

    onViewUpdated({ ...activeView, name: name.trim() });
    onClose();
  }

  async function handleSharingChange() {
    if (!activeView) return;
    setSaving(true);

    const newVisibility = (isAdmin && visibility === 'public') ? 'public' : 'private';
    const { error: dbErr } = await supabase.from('list_views')
      .update({ visibility: newVisibility, updated_at: new Date().toISOString() })
      .eq('id', activeView.id);
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }

    onViewUpdated({ ...activeView, visibility: newVisibility });
    onClose();
  }

  async function handleDelete() {
    if (!activeView) return;
    setSaving(true);

    const { error: dbErr } = await supabase.from('list_views').delete().eq('id', activeView.id);
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }

    onViewDeleted(activeView.id);
    onClose();
  }

  async function addToRecents(viewId: string) {
    if (!userId) return;
    const { data: prefs } = await supabase
      .from('user_list_view_preferences')
      .select('pinned_list_view_id, recent_list_view_ids, display_prefs')
      .eq('user_id', userId).eq('object', 'quote').maybeSingle();

    const recentIds: string[] = prefs?.recent_list_view_ids || [];
    const updated = [viewId, ...recentIds.filter(id => id !== viewId)].slice(0, 10);

    await supabase.from('user_list_view_preferences').upsert({
      user_id: userId,
      object: 'quote',
      pinned_list_view_id: prefs?.pinned_list_view_id || null,
      recent_list_view_ids: updated,
      display_prefs: prefs?.display_prefs || {},
    }, { onConflict: 'user_id,object' });
  }

  if (!modalType) return null;

  if (modalType === 'delete') {
    return (
      <ModalShell onClose={onClose}>
        <h3 className="text-base font-semibold text-gray-900 mb-2">Delete List View</h3>
        <p className="text-sm text-gray-600 mb-5">
          Delete <span className="font-medium">"{activeView?.name}"</span>? This action can't be undone.
        </p>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleDelete} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors">
            {saving ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </ModalShell>
    );
  }

  if (modalType === 'rename') {
    return (
      <ModalShell onClose={onClose}>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Rename List View</h3>
        <label className="block text-xs font-medium text-gray-600 mb-1">List Name</label>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError(null); }}
          maxLength={80}
          autoFocus
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleRename} disabled={saving || !name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </ModalShell>
    );
  }

  if (modalType === 'sharing') {
    return (
      <ModalShell onClose={onClose}>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Sharing Settings</h3>
        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <input type="radio" name="vis" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="mt-0.5" />
            <div>
              <span className="text-sm font-medium text-gray-900">Only I can see this list view</span>
              <p className="text-xs text-gray-500 mt-0.5">Private to your account.</p>
            </div>
          </label>
          {isAdmin && (
            <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
              <input type="radio" name="vis" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} className="mt-0.5" />
              <div>
                <span className="text-sm font-medium text-gray-900">All users can see this list view</span>
                <p className="text-xs text-gray-500 mt-0.5">Shared with the entire team.</p>
              </div>
            </label>
          )}
        </div>
        {activeView?.visibility === 'public' && visibility === 'private' && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">Users who rely on this list will lose access.</p>
          </div>
        )}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSharingChange} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </ModalShell>
    );
  }

  // New / Clone
  return (
    <ModalShell onClose={onClose}>
      <h3 className="text-base font-semibold text-gray-900 mb-4">
        {modalType === 'new' ? 'New List View' : 'Clone List View'}
      </h3>
      <label className="block text-xs font-medium text-gray-600 mb-1">List Name</label>
      <input
        type="text"
        value={name}
        onChange={e => { setName(e.target.value); setError(null); }}
        maxLength={80}
        autoFocus
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      <div className="mt-4 space-y-3">
        <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
          <input type="radio" name="vis" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="mt-0.5" />
          <div>
            <span className="text-sm font-medium text-gray-900">Only I can see this list view</span>
            <p className="text-xs text-gray-500 mt-0.5">Private to your account.</p>
          </div>
        </label>
        {isAdmin && (
          <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
            <input type="radio" name="vis" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} className="mt-0.5" />
            <div>
              <span className="text-sm font-medium text-gray-900">All users can see this list view</span>
              <p className="text-xs text-gray-500 mt-0.5">Shared with the entire team.</p>
            </div>
          </label>
        )}
      </div>

      <div className="flex gap-3 justify-end mt-5">
        <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
        <button onClick={handleCreateOrClone} disabled={saving || !name.trim()} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        {children}
      </div>
    </div>
  );
}
