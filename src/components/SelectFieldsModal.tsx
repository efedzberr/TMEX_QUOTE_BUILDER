import { useState } from 'react';
import { X, ChevronUp, ChevronDown, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { QUOTE_FIELD_CATALOG, QuoteFieldDef } from '../lib/quoteFieldCatalog';
import { ListViewColumn } from './QuotesHomeHeader';

const MAX_COLUMNS = 20;

interface SelectFieldsModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: ListViewColumn[];
  onSave: (columns: ListViewColumn[]) => void;
  isReadOnly: boolean;
}

export function SelectFieldsModal({ isOpen, onClose, columns, onSave, isReadOnly }: SelectFieldsModalProps) {
  const [visible, setVisible] = useState<ListViewColumn[]>(columns);
  const [selectedAvailable, setSelectedAvailable] = useState<string | null>(null);
  const [selectedVisible, setSelectedVisible] = useState<string | null>(null);

  if (!isOpen) return null;

  const visibleKeys = new Set(visible.map(c => c.field));
  const available = QUOTE_FIELD_CATALOG.filter(f => !visibleKeys.has(f.key));
  const atMax = visible.length >= MAX_COLUMNS;

  function addField(field?: QuoteFieldDef) {
    const f = field || available.find(a => a.key === selectedAvailable);
    if (!f || atMax) return;
    setVisible([...visible, { field: f.key, label: f.label }]);
    setSelectedAvailable(null);
  }

  function removeField(key?: string) {
    const k = key || selectedVisible;
    if (!k || visible.length <= 1) return;
    setVisible(visible.filter(c => c.field !== k));
    setSelectedVisible(null);
  }

  function moveUp() {
    if (!selectedVisible) return;
    const idx = visible.findIndex(c => c.field === selectedVisible);
    if (idx <= 0) return;
    const next = [...visible];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setVisible(next);
  }

  function moveDown() {
    if (!selectedVisible) return;
    const idx = visible.findIndex(c => c.field === selectedVisible);
    if (idx < 0 || idx >= visible.length - 1) return;
    const next = [...visible];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setVisible(next);
  }

  function handleSave() {
    onSave(visible);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[700px] mx-4 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Select Fields to Display</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isReadOnly && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">View is read-only — changes won't be saved. Clone the view to keep them.</p>
          </div>
        )}

        <div className="flex-1 overflow-hidden px-6 py-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 h-full min-h-[320px]">
            {/* Available Fields */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-gray-500 uppercase mb-2">Available Fields</label>
              <div className="flex-1 border border-gray-200 rounded-lg overflow-y-auto">
                {available.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-gray-400">All fields are visible</div>
                ) : (
                  available.map(f => (
                    <button
                      key={f.key}
                      onDoubleClick={() => addField(f)}
                      onClick={() => setSelectedAvailable(f.key)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        selectedAvailable === f.key ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center justify-center gap-1.5">
              <button
                onClick={() => addField()}
                disabled={!selectedAvailable || atMax}
                title="Add field"
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => removeField()}
                disabled={!selectedVisible || visible.length <= 1}
                title="Remove field"
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <div className="h-4" />
              <button
                onClick={moveUp}
                disabled={!selectedVisible || visible.findIndex(c => c.field === selectedVisible) <= 0}
                title="Move up"
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronUp className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={moveDown}
                disabled={!selectedVisible || visible.findIndex(c => c.field === selectedVisible) >= visible.length - 1}
                title="Move down"
                className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronDown className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Visible Fields */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Visible Fields</label>
                <span className={`text-[10px] font-medium ${atMax ? 'text-red-500' : 'text-gray-400'}`}>
                  {visible.length}/{MAX_COLUMNS}
                </span>
              </div>
              <div className="flex-1 border border-gray-200 rounded-lg overflow-y-auto">
                {visible.map(col => (
                  <button
                    key={col.field}
                    onClick={() => setSelectedVisible(col.field)}
                    onDoubleClick={() => removeField(col.field)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      selectedVisible === col.field ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {col.label}
                  </button>
                ))}
              </div>
              {atMax && (
                <p className="mt-1.5 text-[11px] text-red-500">Maximum of 20 columns per view.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
