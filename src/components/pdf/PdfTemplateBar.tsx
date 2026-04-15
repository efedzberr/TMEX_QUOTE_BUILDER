import { useState } from 'react';
import { BookOpen, Save, ChevronDown, Trash2, Shield } from 'lucide-react';
import type { PdfConfigTemplate } from '../../lib/pdfConfigTypes';

interface Props {
  templates: PdfConfigTemplate[];
  onLoadTemplate: (template: PdfConfigTemplate) => void;
  onSaveTemplate: (name: string) => void;
  onDeleteTemplate: (id: string) => void;
}

export function PdfTemplateBar({ templates, onLoadTemplate, onSaveTemplate, onDeleteTemplate }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newName, setNewName] = useState('');

  function handleSave() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onSaveTemplate(trimmed);
    setNewName('');
    setShowSaveInput(false);
  }

  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
        >
          <BookOpen className="w-3.5 h-3.5" />
          Load Template
          <ChevronDown className="w-3 h-3" />
        </button>
        {showDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
            <div className="absolute z-20 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
              {templates.length === 0 ? (
                <div className="px-3 py-4 text-xs text-gray-400 text-center">No templates available</div>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 transition-colors group"
                    >
                      <button
                        onClick={() => { onLoadTemplate(t); setShowDropdown(false); }}
                        className="flex-1 text-left text-xs text-gray-800 flex items-center gap-1.5"
                      >
                        {t.is_system && <Shield className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                        <span>{t.name}</span>
                      </button>
                      {!t.is_system && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteTemplate(t.id); }}
                          className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showSaveInput ? (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSaveInput(false); }}
            placeholder="Template name..."
            className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-40"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={!newName.trim()}
            className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => { setShowSaveInput(false); setNewName(''); }}
            className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSaveInput(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
        >
          <Save className="w-3.5 h-3.5" />
          Save as Template
        </button>
      )}
    </div>
  );
}
