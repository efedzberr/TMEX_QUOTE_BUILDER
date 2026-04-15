import { useState, useRef, useEffect, useCallback } from 'react';
import { GripVertical, X, ChevronRight, ChevronDown } from 'lucide-react';
import { useDragReorder } from '../../lib/useDragReorder';
import type {
  ViewType, CondensedColumn, FullViewSectionConfig,
  FullViewColorConfig, FullViewFieldToggle, FullViewFontColorConfig,
} from '../../lib/pdfConfigTypes';
import { CONDENSED_COLUMN_OPTIONS, genId, suggestFontColor } from '../../lib/pdfConfigTypes';

const SECTION_DEFAULT_COLORS: Record<string, string> = {
  general: '#1E40AF',
  us: '#DC2626',
  mx: '#166534',
  additional: '#374151',
};

const COLOR_PALETTE = [
  ['#1E3A5F', '#1E40AF', '#2563EB', '#3B82F6', '#60A5FA', '#BFDBFE'],
  ['#14532D', '#166534', '#16A34A', '#22C55E', '#86EFAC', '#DCFCE7'],
  ['#7F1D1D', '#DC2626', '#F59E0B', '#FBBF24', '#FDE68A', '#FEF3C7'],
  ['#111827', '#374151', '#6B7280', '#9CA3AF', '#E5E7EB', '#FFFFFF'],
];

interface Props {
  viewType: ViewType;
  condensedColumns: CondensedColumn[];
  fullViewSections: FullViewSectionConfig;
  fullViewColors: FullViewColorConfig;
  fullViewFontColors: FullViewFontColorConfig;
  onCondensedColumnsChange: (columns: CondensedColumn[]) => void;
  onFullViewSectionsChange: (sections: FullViewSectionConfig) => void;
  onFullViewColorsChange: (colors: FullViewColorConfig) => void;
  onFullViewFontColorsChange: (fontColors: FullViewFontColorConfig) => void;
}

function CondensedColumnConfig({ columns, onChange }: { columns: CondensedColumn[]; onChange: (cols: CondensedColumn[]) => void }) {
  const [showAvailable, setShowAvailable] = useState(false);
  const { dragIndex, overIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useDragReorder(columns, onChange);
  const selectedKeys = new Set(columns.map(c => c.key));
  const available = CONDENSED_COLUMN_OPTIONS.filter(c => !selectedKeys.has(c.key));

  function handleAddColumn(opt: typeof CONDENSED_COLUMN_OPTIONS[0]) {
    if (columns.length >= 15) return;
    onChange([...columns, { id: genId(), key: opt.key, label: opt.label }]);
  }

  function handleRemove(id: string) {
    onChange(columns.filter(c => c.id !== id));
  }

  function handleLabelChange(id: string, label: string) {
    onChange(columns.map(c => c.id === id ? { ...c, label } : c));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">
          Selected Columns ({columns.length}/15)
        </span>
        <button
          onClick={() => setShowAvailable(!showAvailable)}
          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
        >
          {showAvailable ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {showAvailable ? 'Hide' : 'Show'} Available ({available.length})
        </button>
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
        {columns.map((col, idx) => (
          <div
            key={col.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-1.5 p-1.5 rounded border transition-all group ${
              dragIndex === idx ? 'opacity-40 border-blue-300 bg-blue-50' :
              overIndex === idx ? 'border-blue-400 bg-blue-50' :
              'border-gray-100 bg-gray-50 hover:border-gray-200'
            }`}
          >
            <GripVertical className="w-3 h-3 text-gray-300 cursor-grab flex-shrink-0" />
            <span className="text-[10px] text-gray-400 w-4 text-center flex-shrink-0">{idx + 1}</span>
            <input
              type="text"
              value={col.label}
              onChange={(e) => handleLabelChange(col.id, e.target.value)}
              className="flex-1 min-w-0 px-1.5 py-0.5 text-[11px] border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded text-gray-800"
            />
            <button
              onClick={() => handleRemove(col.id)}
              className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {showAvailable && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
            Available Columns
          </div>
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
            {available.map(opt => (
              <button
                key={opt.key}
                onClick={() => handleAddColumn(opt)}
                disabled={columns.length >= 15}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between"
              >
                <span className="text-gray-800">{opt.label}</span>
                <span className="text-blue-600 text-[10px] font-medium">+ Add</span>
              </button>
            ))}
            {available.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-400 text-center">All columns selected</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type SectionKey = 'general' | 'us' | 'mx' | 'additional';

const SECTION_META: { key: SectionKey; title: string }[] = [
  { key: 'general', title: 'General Information' },
  { key: 'us', title: 'US Section' },
  { key: 'mx', title: 'MX Section' },
  { key: 'additional', title: 'Additional Information' },
];

function getColorLabel(colorValue: string, sectionKey: SectionKey): string {
  if (colorValue === 'full' || colorValue === SECTION_DEFAULT_COLORS[sectionKey]) return 'Full Color';
  if (colorValue === 'gray' || colorValue === '#6B7280') return 'Gray';
  if (colorValue === 'white' || colorValue === '#FFFFFF') return 'White';
  if (colorValue === 'none' || colorValue === 'transparent') return 'None';
  return `Custom: ${colorValue}`;
}

function getDisplayColor(colorValue: string, sectionKey: SectionKey): string {
  if (colorValue === 'full') return SECTION_DEFAULT_COLORS[sectionKey];
  if (colorValue === 'gray') return '#6B7280';
  if (colorValue === 'white') return '#FFFFFF';
  if (colorValue === 'none' || colorValue === 'transparent') return '#FFFFFF';
  return colorValue;
}

function ColorPalettePicker({
  currentColor, sectionKey, onChange, onClose, anchorRef,
}: {
  currentColor: string; sectionKey: SectionKey;
  onChange: (c: string) => void; onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement>;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const computePosition = useCallback(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popupW = 210;
    const popupH = 180;
    let left = rect.right + 8;
    if (left + popupW > window.innerWidth - 8) {
      left = rect.left - popupW - 8;
    }
    if (left < 8) left = 8;
    let top = rect.top;
    if (top + popupH > window.innerHeight - 8) {
      top = rect.bottom - popupH;
    }
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchorRef]);

  useEffect(() => {
    computePosition();
    window.addEventListener('scroll', computePosition, true);
    window.addEventListener('resize', computePosition);
    return () => {
      window.removeEventListener('scroll', computePosition, true);
      window.removeEventListener('resize', computePosition);
    };
  }, [computePosition]);

  const resolvedCurrent = getDisplayColor(currentColor, sectionKey);

  return (
    <>
      <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={onClose} />
      <div
        ref={popupRef}
        className="fixed bg-white rounded-lg shadow-xl border border-gray-200 p-3 w-[210px]"
        style={{ zIndex: 9999, top: pos.top, left: pos.left }}
      >
        <div className="grid grid-cols-6 gap-1 mb-3">
          {COLOR_PALETTE.flat().map(hex => (
            <button
              key={hex}
              onClick={() => { onChange(hex); onClose(); }}
              className="w-6 h-6 rounded border transition-all hover:scale-110"
              style={{
                backgroundColor: hex,
                borderColor: resolvedCurrent === hex ? '#111827' : '#D1D5DB',
                borderWidth: resolvedCurrent === hex ? 2 : 1,
                boxShadow: resolvedCurrent === hex ? '0 0 0 1px #111827' : 'none',
              }}
            />
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => { onChange(SECTION_DEFAULT_COLORS[sectionKey]); onClose(); }}
            className="flex-1 px-2 py-1 text-[10px] font-medium border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            Full Color
          </button>
          <button
            onClick={() => { onChange('#6B7280'); onClose(); }}
            className="flex-1 px-2 py-1 text-[10px] font-medium border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            Gray
          </button>
          <button
            onClick={() => { onChange('none'); onClose(); }}
            className="flex-1 px-2 py-1 text-[10px] font-medium border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            None
          </button>
        </div>
      </div>
    </>
  );
}

function NoneColorSwatch() {
  return (
    <span className="relative w-4 h-4 rounded-sm border border-gray-300 flex-shrink-0 overflow-hidden bg-white">
      <span className="absolute inset-0" style={{ background: 'linear-gradient(to bottom right, transparent calc(50% - 1px), #EF4444 calc(50% - 1px), #EF4444 calc(50% + 1px), transparent calc(50% + 1px))' }} />
    </span>
  );
}

function FontColorToggle({
  fontColor,
  onFontColorChange,
  bgColor,
  sectionKey,
}: {
  fontColor: string;
  onFontColorChange: (color: string) => void;
  bgColor: string;
  sectionKey: SectionKey;
}) {
  const displayBg = getDisplayColor(bgColor, sectionKey);
  const suggested = suggestFontColor(displayBg);

  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500">Header Text Color</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => onFontColorChange('#FFFFFF')}
            className="w-5 h-5 rounded border-2 transition-all bg-white"
            style={{ borderColor: fontColor === '#FFFFFF' ? '#3B82F6' : '#D1D5DB' }}
            title="White"
          />
          <button
            onClick={() => onFontColorChange('#111827')}
            className="w-5 h-5 rounded border-2 transition-all"
            style={{ backgroundColor: '#111827', borderColor: fontColor === '#111827' ? '#3B82F6' : '#D1D5DB' }}
            title="Black"
          />
        </div>
      </div>
      {suggested === fontColor && (
        <span className="text-[9px] text-gray-400 italic">Auto-suggested based on background color</span>
      )}
    </div>
  );
}

function FullViewSectionCard({
  sectionKey, title, fields, colorValue, fontColor,
  onFieldsChange, onColorChange, onFontColorChange,
}: {
  sectionKey: SectionKey;
  title: string;
  fields: FullViewFieldToggle[];
  colorValue: string;
  fontColor: string;
  onFieldsChange: (fields: FullViewFieldToggle[]) => void;
  onColorChange: (val: string) => void;
  onFontColorChange: (color: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const swatchBtnRef = useRef<HTMLButtonElement>(null);
  const displayColor = getDisplayColor(colorValue, sectionKey);
  const isNone = colorValue === 'none' || colorValue === 'transparent';

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
      >
        {isNone ? (
          <NoneColorSwatch />
        ) : (
          <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-gray-300" style={{ backgroundColor: displayColor }} />
        )}
        {collapsed ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
        <span className="text-xs font-semibold text-gray-800">{title}</span>
        <span className="text-[10px] text-gray-400 ml-auto">{fields.filter(f => f.visible).length}/{fields.length}</span>
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 space-y-1">
          {fields.map((field, idx) => (
            <div key={field.key} className="flex items-center gap-2 py-0.5">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={field.visible}
                  onChange={() => {
                    const updated = [...fields];
                    updated[idx] = { ...field, visible: !field.visible };
                    onFieldsChange(updated);
                  }}
                  className="sr-only peer"
                />
                <div className="w-7 h-4 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
              </label>
              <input
                type="text"
                value={field.label}
                onChange={(e) => {
                  const updated = [...fields];
                  updated[idx] = { ...field, label: e.target.value };
                  onFieldsChange(updated);
                }}
                className="flex-1 min-w-0 px-1.5 py-0.5 text-[11px] border-0 bg-transparent focus:ring-1 focus:ring-blue-400 rounded text-gray-700"
              />
            </div>
          ))}

          <div className="mt-2 flex items-center gap-2">
            <button
              ref={swatchBtnRef}
              onClick={() => setShowPalette(!showPalette)}
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
            >
              {isNone ? (
                <NoneColorSwatch />
              ) : (
                <span
                  className="w-4 h-4 rounded-sm border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: displayColor }}
                />
              )}
              <span className="text-[10px] text-gray-600">{getColorLabel(colorValue, sectionKey)}</span>
            </button>
            {showPalette && (
              <ColorPalettePicker
                currentColor={colorValue}
                sectionKey={sectionKey}
                onChange={(c) => {
                  onColorChange(c);
                  const suggested = suggestFontColor(getDisplayColor(c, sectionKey));
                  onFontColorChange(suggested);
                }}
                onClose={() => setShowPalette(false)}
                anchorRef={swatchBtnRef}
              />
            )}
          </div>

          <FontColorToggle
            fontColor={fontColor}
            onFontColorChange={onFontColorChange}
            bgColor={colorValue}
            sectionKey={sectionKey}
          />
        </div>
      )}
    </div>
  );
}

export function PdfBodyConfig({ viewType, condensedColumns, fullViewSections, fullViewColors, fullViewFontColors, onCondensedColumnsChange, onFullViewSectionsChange, onFullViewColorsChange, onFullViewFontColorsChange }: Props) {
  return (
    <div className="space-y-3">
      {viewType === 'condensed' ? (
        <CondensedColumnConfig columns={condensedColumns} onChange={onCondensedColumnsChange} />
      ) : (
        <div className="space-y-2">
          {SECTION_META.map(s => (
            <FullViewSectionCard
              key={s.key}
              sectionKey={s.key}
              title={s.title}
              fields={fullViewSections[s.key]}
              colorValue={fullViewColors[s.key]}
              fontColor={fullViewFontColors[s.key]}
              onFieldsChange={(fields) => onFullViewSectionsChange({ ...fullViewSections, [s.key]: fields })}
              onColorChange={(val) => onFullViewColorsChange({ ...fullViewColors, [s.key]: val })}
              onFontColorChange={(c) => onFullViewFontColorsChange({ ...fullViewFontColors, [s.key]: c })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
