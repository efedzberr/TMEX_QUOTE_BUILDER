import { useState } from 'react';
import { X, GripVertical, Plus, Star, Lock } from 'lucide-react';
import { usePermissions } from '../../lib/permissions';
import { useDragReorder } from '../../lib/useDragReorder';
import { logActivity } from '../../lib/activityLog';
import {
  PicklistDef, PicklistKey, PicklistValue,
  usePicklistRows, addPicklistValue, reorderPicklistValues, setPicklistDefault, setPicklistValueActive,
} from '../../lib/picklists';

interface PicklistValuesModalProps {
  def: PicklistDef;
  /** e.g. "Quote Lanes · Equipment Type" when opened from Objects & Fields */
  context?: string;
  onClose: () => void;
}

export function PicklistValuesModal({ def, context, onClose }: PicklistValuesModalProps) {
  const { can } = usePermissions();
  const canEdit = def.editable && can('admin.picklists', 'edit');
  const rows = usePicklistRows(def.editable ? (def.key as PicklistKey) : null);
  const [newValue, setNewValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<string | null>, event: string, details: string) => {
    setBusy(true);
    setError('');
    const message = await action();
    setBusy(false);
    if (message) {
      setError(message);
      return false;
    }
    logActivity(event, { object: 'picklist', recordLabel: def.label, details });
    return true;
  };

  const drag = useDragReorder<PicklistValue>(rows, (items) => {
    void run(() => reorderPicklistValues(def.key as PicklistKey, items.map(i => i.id)), 'Picklist Reordered', items.map(i => i.value).join(', '));
  });

  const handleAdd = async () => {
    const value = newValue.trim();
    if (!value) return;
    const ok = await run(() => addPicklistValue(def.key as PicklistKey, value), 'Picklist Value Added', value);
    if (ok) setNewValue('');
  };

  const toggleDefault = (row: PicklistValue) => {
    void run(
      () => setPicklistDefault(def.key as PicklistKey, row.is_default ? null : row.id),
      'Picklist Default Changed',
      row.is_default ? 'No default' : row.value,
    );
  };

  const toggleActive = (row: PicklistValue) => {
    void run(
      () => setPicklistValueActive(row.id, !row.is_active),
      row.is_active ? 'Picklist Value Deactivated' : 'Picklist Value Reactivated',
      row.value,
    );
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[88vh] flex flex-col">
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{def.label}</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {context ? <>{context} · </> : null}Global picklist · Used by: {def.usedBy}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          {!def.editable ? (
            <>
              <div className="mb-3 flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <Lock className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
                <div>System-managed list. Its values drive business rules, so they cannot be changed from Administration.</div>
              </div>
              <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {def.builtIn.map(value => (
                  <li key={value} className="px-3 py-2 text-sm text-gray-800">{value}</li>
                ))}
              </ul>
            </>
          ) : (
            <>
              {canEdit && (
                <div className="mb-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newValue}
                      maxLength={80}
                      onChange={e => { setNewValue(e.target.value); if (error) setError(''); }}
                      onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); }}
                      placeholder="New value"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => void handleAdd()}
                      disabled={busy || !newValue.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Drag to reorder. The star marks the default value. Values cannot be renamed or deleted; values you added can be deactivated.
                  </p>
                </div>
              )}
              {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

              {rows.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-gray-500">Loading values...</div>
              ) : (
                <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {rows.map((row, index) => (
                    <li
                      key={row.id}
                      draggable={canEdit && !busy}
                      onDragStart={() => drag.handleDragStart(index)}
                      onDragOver={e => drag.handleDragOver(e, index)}
                      onDrop={e => drag.handleDrop(e, index)}
                      onDragEnd={drag.handleDragEnd}
                      className={`flex items-center gap-2 px-3 py-2 text-sm ${drag.overIndex === index && drag.dragIndex !== index ? 'bg-blue-50' : 'bg-white'} ${drag.dragIndex === index ? 'opacity-50' : ''}`}
                    >
                      {canEdit && <GripVertical className="w-4 h-4 text-gray-300 cursor-grab flex-shrink-0" />}
                      <span className={`flex-1 min-w-0 truncate ${row.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{row.value}</span>
                      {row.is_system && <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-500">Built-in</span>}
                      {!row.is_active && <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-500">Inactive</span>}
                      {row.is_default && !canEdit && <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-700">Default</span>}
                      {canEdit && row.is_active && (
                        <button
                          onClick={() => toggleDefault(row)}
                          disabled={busy}
                          title={row.is_default ? 'Default value — click to clear' : 'Set as default'}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-50"
                        >
                          <Star className={`w-4 h-4 ${row.is_default ? 'text-amber-500 fill-amber-400' : 'text-gray-300'}`} />
                        </button>
                      )}
                      {canEdit && !row.is_system && (
                        <button
                          onClick={() => toggleActive(row)}
                          disabled={busy}
                          className="px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded disabled:opacity-50"
                        >
                          {row.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!canEdit && (
                <p className="mt-3 text-xs text-gray-500">Only profiles with the Global Picklists permission can change this list.</p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end px-6 py-3 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded hover:bg-gray-50 transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
}
