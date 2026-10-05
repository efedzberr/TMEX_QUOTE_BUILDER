import { useEffect, useState } from 'react';
import { List, Lock, ChevronRight } from 'lucide-react';
import { PICKLIST_DEFS, PicklistDef, PicklistKey, getPicklistOptions, getPicklistDefault, loadPicklists, usePicklistRows } from '../../lib/picklists';
import { PicklistValuesModal } from './PicklistValuesModal';

export function GlobalPicklistsTab() {
  const [open, setOpen] = useState<PicklistDef | null>(null);
  // Subscribes this page to the shared cache so counts refresh after every change
  usePicklistRows('equipment_type');
  useEffect(() => { void loadPicklists(); }, []);

  const editable = PICKLIST_DEFS.filter(d => d.editable);
  const system = PICKLIST_DEFS.filter(d => !d.editable);

  const row = (def: PicklistDef) => {
    const values = def.editable ? getPicklistOptions(def.key as PicklistKey) : [...def.builtIn];
    const defaultValue = def.editable ? getPicklistDefault(def.key as PicklistKey) : '';
    return (
      <tr key={def.key} onClick={() => setOpen(def)} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer">
        <td className="px-4 py-2.5 text-sm font-medium text-blue-700">{def.label}</td>
        <td className="px-4 py-2.5 text-sm text-gray-600">{values.length}</td>
        <td className="px-4 py-2.5 text-sm text-gray-600">{defaultValue || <span className="text-gray-300">—</span>}</td>
        <td className="px-4 py-2.5 text-xs text-gray-500">{def.usedBy}</td>
        <td className="px-4 py-2.5 text-right"><ChevronRight className="inline w-4 h-4 text-gray-300" /></td>
      </tr>
    );
  };

  const table = (defs: PicklistDef[]) => (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Picklist</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Active Values</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Default</th>
            <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Used By</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>{defs.map(row)}</tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Global Picklists</h2>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          Value lists shared across the application. A value added here appears in every dropdown that uses the list.
        </p>
      </div>

      {table(editable)}

      <div className="mt-6 mb-2 flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        <Lock className="w-3.5 h-3.5" /> System-managed (read only)
      </div>
      {table(system)}

      {open && <PicklistValuesModal def={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
