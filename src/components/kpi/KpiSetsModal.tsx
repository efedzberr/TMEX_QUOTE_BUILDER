import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Star, X, Check, Users } from 'lucide-react';
import {
  KpiSet, ProfileKpiDefault,
  fetchKpiSets, createKpiSet, updateKpiSet, deleteKpiSet, fetchProfilesKpiDefaults, setProfileKpiDefault,
} from '../../lib/kpiTiles';

interface KpiSetsModalProps {
  object: string;
  onClose: () => void;
  /** called whenever sets change so the strip can refresh its selector */
  onChanged: (sets: KpiSet[]) => void;
  onError?: (message: string) => void;
}

export function KpiSetsModal({ object, onClose, onChanged, onError }: KpiSetsModalProps) {
  const [sets, setSets] = useState<KpiSet[]>([]);
  const [profiles, setProfiles] = useState<ProfileKpiDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: string | null; name: string; description: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<KpiSet | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([fetchKpiSets(object), fetchProfilesKpiDefaults()]);
      setSets(s); setProfiles(p); onChanged(s);
    } catch (err) {
      console.error('Error loading KPI sets:', err);
      onError?.("We couldn't load the KPI sets.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [object]);

  async function handleSave() {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) { setError('Name is required.'); return; }
    setBusy(true); setError(null);
    try {
      if (editing.id) await updateKpiSet(editing.id, { name, description: editing.description.trim() || null });
      else await createKpiSet(object, name, editing.description.trim() || null);
      setEditing(null);
      await load();
    } catch (err) {
      const msg = String((err as { message?: string } | null)?.message ?? '');
      setError(msg.includes('duplicate') || msg.includes('unique') ? 'A set with this name already exists.' : "We couldn't save the set.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMakeDefault(set: KpiSet) {
    setBusy(true);
    try { await updateKpiSet(set.id, { is_default: true }); await load(); }
    catch (err) { console.error(err); onError?.("We couldn't change the default set."); }
    finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    try { await deleteKpiSet(confirmDelete.id); setConfirmDelete(null); await load(); }
    catch (err) {
      const msg = String((err as { message?: string } | null)?.message ?? '');
      onError?.(msg.includes('default') ? msg : "We couldn't delete the set.");
      setConfirmDelete(null);
    } finally { setBusy(false); }
  }

  async function handleProfileDefault(profile: ProfileKpiDefault, setId: string | null) {
    setBusy(true);
    try { await setProfileKpiDefault(profile.id, setId); setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, default_kpi_set_id: setId } : p)); }
    catch (err) { console.error(err); onError?.("We couldn't update the profile default."); }
    finally { setBusy(false); }
  }

  const usedBy = (setId: string) => profiles.filter(p => p.default_kpi_set_id === setId).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black bg-opacity-40" onClick={() => !busy && onClose()} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-base font-semibold text-gray-900">Manage KPI Sets</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">A set is a shared strip of up to 8 KPIs. Users pick which set (or their personal strip) to show. The default set is shown to anyone who has not chosen yet. To edit a set's tiles, select it in the strip.</p>

        {/* Sets */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-800">Sets</h4>
          <button onClick={() => { setEditing({ id: null, name: '', description: '' }); setError(null); }} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"><Plus className="w-3.5 h-3.5" /> New set</button>
        </div>
        {loading ? <p className="text-sm text-gray-400">Loading...</p> : (
          <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100 mb-5">
            {sets.map(set => (
              <li key={set.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{set.name}</span>
                    {set.is_default && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200"><Star className="w-3 h-3" /> Default</span>}
                    {usedBy(set.id) > 0 && <span className="inline-flex items-center gap-1 text-[10px] text-gray-500"><Users className="w-3 h-3" /> {usedBy(set.id)} {usedBy(set.id) === 1 ? 'profile' : 'profiles'}</span>}
                  </div>
                  {set.description && <p className="text-xs text-gray-500 truncate">{set.description}</p>}
                </div>
                {!set.is_default && (
                  <button onClick={() => handleMakeDefault(set)} disabled={busy} className="text-xs text-gray-500 hover:text-amber-700" title="Make this the system default">Make default</button>
                )}
                <button onClick={() => { setEditing({ id: set.id, name: set.name, description: set.description || '' }); setError(null); }} className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Rename"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setConfirmDelete(set)} disabled={set.is_default || busy} title={set.is_default ? 'The default set cannot be deleted' : 'Delete'} className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}

        {/* Profile defaults */}
        <h4 className="text-sm font-semibold text-gray-800 mb-1">Default set per profile</h4>
        <p className="text-xs text-gray-500 mb-2">Users of a profile see this set the first time they open the list (they can still switch).</p>
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
          <table className="w-full text-sm">
            <tbody>
              {profiles.map(p => (
                <tr key={p.id} className="border-b border-gray-100 last:border-b-0">
                  <td className="px-3 py-2 text-gray-900">{p.name}</td>
                  <td className="px-3 py-2 w-64">
                    <select value={p.default_kpi_set_id || ''} disabled={busy} onChange={e => handleProfileDefault(p, e.target.value || null)} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">— System default —</option>
                      {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Create / rename inline form */}
        {editing && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => !busy && setEditing(null)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">{editing.id ? 'Rename Set' : 'New KPI Set'}</h3>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input type="text" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} maxLength={60} autoFocus placeholder="e.g. KPIs Pricer" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <label className="block text-xs font-medium text-gray-600 mt-3 mb-1">Description <span className="text-gray-400">(optional)</span></label>
              <input type="text" value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })} maxLength={200} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
              <div className="flex gap-3 justify-end mt-5">
                <button onClick={() => setEditing(null)} disabled={busy} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={busy || !editing.name.trim()} className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"><Check className="w-4 h-4" /> {busy ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {confirmDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" onClick={() => !busy && setConfirmDelete(null)} />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm mx-4 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-2">Delete KPI Set</h3>
              <p className="text-sm text-gray-600 mb-5">Delete <span className="font-medium">"{confirmDelete.name}"</span> and its tiles? Users showing it will fall back to their default.</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setConfirmDelete(null)} disabled={busy} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={handleDelete} disabled={busy} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50">{busy ? 'Deleting...' : 'Delete'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
