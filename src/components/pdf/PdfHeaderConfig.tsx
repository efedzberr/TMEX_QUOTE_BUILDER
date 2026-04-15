import { useState } from 'react';
import { GripVertical, X, Plus } from 'lucide-react';
import { useDragReorder } from '../../lib/useDragReorder';
import type { HeaderField } from '../../lib/pdfConfigTypes';
import { HEADER_FIELD_OPTIONS, genId } from '../../lib/pdfConfigTypes';

interface ColumnProps {
  title: string;
  fields: HeaderField[];
  onReorder: (fields: HeaderField[]) => void;
  onRemove: (id: string) => void;
  onLabelChange: (id: string, label: string) => void;
  onAdd: (field: { key: string; label: string }) => void;
}

function FieldPickerPopover({ onSelect, onClose, existingKeys }: { onSelect: (f: { key: string; label: string }) => void; onClose: () => void; existingKeys: Set<string> }) {
  const [search, setSearch] = useState('');
  const filtered = HEADER_FIELD_OPTIONS.filter(f =>
    f.label.toLowerCase().includes(search.toLowerCase()) || f.key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="absolute z-20 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
      <div className="p-2 border-b border-gray-100">
        <input
          type="text"
          placeholder="Search fields..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          autoFocus
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.map(f => (
          <button
            key={f.key}
            onClick={() => { onSelect({ key: f.key, label: f.label }); onClose(); }}
            className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition-colors flex items-center justify-between"
          >
            <span className="text-gray-900">{f.label}</span>
            {existingKeys.has(f.key) && <span className="text-[10px] text-gray-400">added</span>}
          </button>
        ))}
        {filtered.length === 0 && <div className="px-3 py-4 text-xs text-gray-400 text-center">No fields found</div>}
      </div>
    </div>
  );
}

function HeaderColumn({ title, fields, onReorder, onRemove, onLabelChange, onAdd }: ColumnProps) {
  const [showPicker, setShowPicker] = useState(false);
  const { dragIndex, overIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useDragReorder(fields, onReorder);
  const existingKeys = new Set(fields.map(f => f.key));

  return (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</div>
      <div className="space-y-1 min-h-[40px]">
        {fields.map((field, idx) => (
          <div
            key={field.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-1 p-1.5 rounded border transition-all group ${
              dragIndex === idx ? 'opacity-40 border-blue-300 bg-blue-50' :
              overIndex === idx ? 'border-blue-400 bg-blue-50' :
              'border-gray-100 bg-gray-50 hover:border-gray-200'
            }`}
          >
            <GripVertical className="w-3 h-3 text-gray-300 cursor-grab flex-shrink-0" />
            <input
              type="text"
              value={field.label}
              onChange={(e) => onLabelChange(field.id, e.target.value)}
              className="flex-1 min-w-0 px-1.5 py-0.5 text-[11px] border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded text-gray-800"
            />
            <button
              onClick={() => onRemove(field.id)}
              className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
      <div className="relative mt-2">
        <button
          onClick={() => { if (fields.length < 8) setShowPicker(!showPicker); }}
          disabled={fields.length >= 8}
          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed font-medium"
        >
          <Plus className="w-3 h-3" />
          Add Field {fields.length >= 8 && '(max 8)'}
        </button>
        {showPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
            <FieldPickerPopover
              existingKeys={existingKeys}
              onSelect={(f) => onAdd(f)}
              onClose={() => setShowPicker(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}

interface Props {
  headerLeft: HeaderField[];
  headerMiddle: HeaderField[];
  headerRight: HeaderField[];
  onUpdate: (column: 'header_left' | 'header_middle' | 'header_right', fields: HeaderField[]) => void;
}

export function PdfHeaderConfig({ headerLeft, headerMiddle, headerRight, onUpdate }: Props) {
  function handleAdd(column: 'header_left' | 'header_middle' | 'header_right', f: { key: string; label: string }) {
    const current = column === 'header_left' ? headerLeft : column === 'header_middle' ? headerMiddle : headerRight;
    if (current.length >= 8) return;
    const newField: HeaderField = { id: genId(), key: f.key, label: f.label };
    onUpdate(column, [...current, newField]);
  }

  function handleRemove(column: 'header_left' | 'header_middle' | 'header_right', id: string) {
    const current = column === 'header_left' ? headerLeft : column === 'header_middle' ? headerMiddle : headerRight;
    onUpdate(column, current.filter(f => f.id !== id));
  }

  function handleLabelChange(column: 'header_left' | 'header_middle' | 'header_right', id: string, label: string) {
    const current = column === 'header_left' ? headerLeft : column === 'header_middle' ? headerMiddle : headerRight;
    onUpdate(column, current.map(f => f.id === id ? { ...f, label } : f));
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <HeaderColumn
          title="Left Column"
          fields={headerLeft}
          onReorder={(fields) => onUpdate('header_left', fields)}
          onRemove={(id) => handleRemove('header_left', id)}
          onLabelChange={(id, label) => handleLabelChange('header_left', id, label)}
          onAdd={(f) => handleAdd('header_left', f)}
        />
        <div className="w-px bg-gray-200" />
        <HeaderColumn
          title="Middle Column"
          fields={headerMiddle}
          onReorder={(fields) => onUpdate('header_middle', fields)}
          onRemove={(id) => handleRemove('header_middle', id)}
          onLabelChange={(id, label) => handleLabelChange('header_middle', id, label)}
          onAdd={(f) => handleAdd('header_middle', f)}
        />
        <div className="w-px bg-gray-200" />
        <HeaderColumn
          title="Right Column"
          fields={headerRight}
          onReorder={(fields) => onUpdate('header_right', fields)}
          onRemove={(id) => handleRemove('header_right', id)}
          onLabelChange={(id, label) => handleLabelChange('header_right', id, label)}
          onAdd={(f) => handleAdd('header_right', f)}
        />
      </div>
    </div>
  );
}
