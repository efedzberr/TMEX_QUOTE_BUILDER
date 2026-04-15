import { useState, useRef } from 'react';
import { X, Plus, Upload, Image as ImageIcon } from 'lucide-react';
import type { TitleConfig, TitleElement, TitleElementType, TitleImageSize } from '../../lib/pdfConfigTypes';
import { HEADER_FIELD_OPTIONS } from '../../lib/pdfConfigTypes';

interface Props {
  config: TitleConfig;
  onChange: (config: TitleConfig) => void;
}

const ZONE_KEYS = ['left', 'center', 'right'] as const;
type ZoneKey = typeof ZONE_KEYS[number];

const ZONE_LABELS: Record<ZoneKey, string> = {
  left: 'Left Zone',
  center: 'Center Zone',
  right: 'Right Zone',
};

const IMAGE_SIZE_LABELS: Record<TitleImageSize, string> = {
  small: 'S',
  medium: 'M',
  large: 'L',
};

function ElementEditor({
  element,
  onUpdate,
  onRemove,
}: {
  element: TitleElement;
  onUpdate: (el: TitleElement) => void;
  onRemove: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onUpdate({ ...element, imageData: reader.result as string, imageName: file.name });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-start gap-1.5 p-1.5 rounded border border-gray-100 bg-gray-50 group">
      <select
        value={element.type}
        onChange={(e) => onUpdate({ ...element, type: e.target.value as TitleElementType })}
        className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white flex-shrink-0 w-14"
      >
        <option value="empty">Empty</option>
        <option value="image">Image</option>
        <option value="text">Text</option>
        <option value="field">Field</option>
      </select>

      <div className="flex-1 min-w-0">
        {element.type === 'image' && (
          <div className="flex items-center gap-1.5">
            {element.imageData ? (
              <img src={element.imageData} alt="" className="w-8 h-8 object-contain rounded border border-gray-200" />
            ) : element.imageName ? (
              <div className="flex items-center gap-1 text-[10px] text-gray-500">
                <ImageIcon className="w-3 h-3" />
                <span className="truncate max-w-[60px]">{element.imageName}</span>
              </div>
            ) : null}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[10px] text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
            >
              <Upload className="w-3 h-3" />
              {element.imageData || element.imageName ? 'Replace' : 'Upload'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            <div className="flex rounded border border-gray-200 overflow-hidden ml-auto">
              {(['small', 'medium', 'large'] as TitleImageSize[]).map(size => (
                <button
                  key={size}
                  onClick={() => onUpdate({ ...element, imageSize: size })}
                  className={`px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                    (element.imageSize || 'medium') === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {IMAGE_SIZE_LABELS[size]}
                </button>
              ))}
            </div>
          </div>
        )}

        {element.type === 'text' && (
          <div className="space-y-1">
            <input
              type="text"
              value={element.text || ''}
              onChange={(e) => onUpdate({ ...element, text: e.target.value })}
              placeholder="Enter text..."
              className="w-full px-1.5 py-0.5 text-[11px] border border-gray-200 rounded bg-white focus:ring-1 focus:ring-blue-400"
            />
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] text-gray-500">
                <input
                  type="checkbox"
                  checked={element.bold || false}
                  onChange={(e) => onUpdate({ ...element, bold: e.target.checked })}
                  className="w-3 h-3 rounded border-gray-300"
                />
                Bold
              </label>
              <select
                value={element.fontSize || 8}
                onChange={(e) => onUpdate({ ...element, fontSize: Number(e.target.value) })}
                className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white"
              >
                <option value={6}>6pt</option>
                <option value={7}>7pt</option>
                <option value={8}>8pt</option>
                <option value={9}>9pt</option>
                <option value={10}>10pt</option>
                <option value={11}>11pt</option>
                <option value={12}>12pt</option>
              </select>
            </div>
          </div>
        )}

        {element.type === 'field' && (
          <div className="space-y-1">
            <select
              value={element.fieldKey || ''}
              onChange={(e) => onUpdate({ ...element, fieldKey: e.target.value })}
              className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Select field...</option>
              {HEADER_FIELD_OPTIONS.map(f => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[10px] text-gray-500">
                <input
                  type="checkbox"
                  checked={element.bold || false}
                  onChange={(e) => onUpdate({ ...element, bold: e.target.checked })}
                  className="w-3 h-3 rounded border-gray-300"
                />
                Bold
              </label>
              <select
                value={element.fontSize || 8}
                onChange={(e) => onUpdate({ ...element, fontSize: Number(e.target.value) })}
                className="text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white"
              >
                <option value={6}>6pt</option>
                <option value={7}>7pt</option>
                <option value={8}>8pt</option>
                <option value={9}>9pt</option>
                <option value={10}>10pt</option>
                <option value={11}>11pt</option>
                <option value={12}>12pt</option>
              </select>
            </div>
          </div>
        )}

        {element.type === 'empty' && (
          <span className="text-[10px] text-gray-400 italic">Empty slot</span>
        )}
      </div>

      <button
        onClick={onRemove}
        className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

function ZoneEditor({
  label,
  zone,
  onChange,
}: {
  label: string;
  zone: { elements: TitleElement[] };
  onChange: (elements: TitleElement[]) => void;
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">{label}</div>
      <div className="space-y-1">
        {zone.elements.map((el, idx) => (
          <ElementEditor
            key={idx}
            element={el}
            onUpdate={(updated) => {
              const next = [...zone.elements];
              next[idx] = updated;
              onChange(next);
            }}
            onRemove={() => onChange(zone.elements.filter((_, i) => i !== idx))}
          />
        ))}
      </div>
      {zone.elements.length < 3 && (
        <button
          onClick={() => onChange([...zone.elements, { type: 'empty' }])}
          className="flex items-center gap-1 mt-1.5 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
        >
          <Plus className="w-3 h-3" />
          Add Element
        </button>
      )}
    </div>
  );
}

export function PdfTitleConfig({ config, onChange }: Props) {
  const [showStyling, setShowStyling] = useState(false);

  function updateZone(zone: ZoneKey, elements: TitleElement[]) {
    onChange({ ...config, [zone]: { elements } });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {ZONE_KEYS.map(key => (
          <ZoneEditor
            key={key}
            label={ZONE_LABELS[key]}
            zone={config[key]}
            onChange={(elements) => updateZone(key, elements)}
          />
        ))}
      </div>

      <div className="border-t border-gray-100 pt-2">
        <button
          onClick={() => setShowStyling(!showStyling)}
          className="text-[11px] text-gray-500 hover:text-gray-700 font-medium"
        >
          {showStyling ? 'Hide' : 'Show'} Styling Options
        </button>

        {showStyling && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-600">Background</span>
              <input
                type="color"
                value={config.bgColor}
                onChange={(e) => onChange({ ...config, bgColor: e.target.value })}
                className="w-6 h-6 rounded border border-gray-200 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-600">Bottom Border</span>
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.borderEnabled}
                    onChange={(e) => onChange({ ...config, borderEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-7 h-4 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
                </label>
                {config.borderEnabled && (
                  <input
                    type="color"
                    value={config.borderColor}
                    onChange={(e) => onChange({ ...config, borderColor: e.target.value })}
                    className="w-5 h-5 rounded border border-gray-200 cursor-pointer"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-600">Height</span>
              <div className="flex items-center gap-2">
                <select
                  value={config.heightMode}
                  onChange={(e) => onChange({ ...config, heightMode: e.target.value as 'auto' | 'fixed' })}
                  className="text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-white"
                >
                  <option value="auto">Auto</option>
                  <option value="fixed">Fixed</option>
                </select>
                {config.heightMode === 'fixed' && (
                  <input
                    type="number"
                    value={config.heightPt}
                    onChange={(e) => onChange({ ...config, heightPt: Number(e.target.value) })}
                    className="w-14 text-[10px] border border-gray-200 rounded px-1.5 py-0.5"
                    min={20}
                    max={120}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-600">Display</span>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[10px]">
                <button
                  className={`px-2 py-1 font-medium transition-colors ${config.firstPageOnly ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => onChange({ ...config, firstPageOnly: true })}
                >
                  First Page
                </button>
                <button
                  className={`px-2 py-1 font-medium transition-colors ${!config.firstPageOnly ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  onClick={() => onChange({ ...config, firstPageOnly: false })}
                >
                  Every Page
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
