import { useState } from 'react';
import type { BannerConfig, BannerCell } from '../../lib/pdfConfigTypes';
import { HEADER_FIELD_OPTIONS } from '../../lib/pdfConfigTypes';

interface Props {
  config: BannerConfig;
  onChange: (config: BannerConfig) => void;
}

function CellEditor({
  index,
  cell,
  onUpdate,
}: {
  index: number;
  cell: BannerCell;
  onUpdate: (cell: BannerCell) => void;
}) {
  return (
    <div className="p-1.5 rounded border border-gray-100 bg-gray-50 space-y-1">
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-gray-400 w-3 flex-shrink-0">{index + 1}</span>
        <select
          value={cell.fieldKey}
          onChange={(e) => onUpdate({ ...cell, fieldKey: e.target.value })}
          className="flex-1 min-w-0 text-[10px] border border-gray-200 rounded px-1 py-0.5 bg-white focus:ring-1 focus:ring-blue-400"
        >
          <option value="">Empty</option>
          {HEADER_FIELD_OPTIONS.map(f => (
            <option key={f.key} value={f.key}>{f.label}</option>
          ))}
        </select>
      </div>
      {cell.fieldKey && (
        <div className="flex items-center gap-1.5 pl-4">
          <input
            type="text"
            value={cell.label}
            onChange={(e) => onUpdate({ ...cell, label: e.target.value })}
            placeholder="Label"
            className="flex-1 min-w-0 px-1 py-0.5 text-[10px] border border-gray-200 rounded bg-white focus:ring-1 focus:ring-blue-400"
          />
          <label className="flex items-center gap-0.5 text-[9px] text-gray-500 flex-shrink-0">
            <input
              type="checkbox"
              checked={cell.showLabel}
              onChange={(e) => onUpdate({ ...cell, showLabel: e.target.checked })}
              className="w-3 h-3 rounded border-gray-300"
            />
            Label
          </label>
        </div>
      )}
    </div>
  );
}

export function PdfBannerConfig({ config, onChange }: Props) {
  const [showStyling, setShowStyling] = useState(false);

  function updateCell(idx: number, cell: BannerCell) {
    const next = [...config.cells];
    next[idx] = cell;
    onChange({ ...config, cells: next });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-600">Show Banner</span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
            className="sr-only peer"
          />
          <div className="w-7 h-4 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
        </label>
      </div>

      {config.enabled && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            {config.cells.map((cell, idx) => (
              <CellEditor
                key={idx}
                index={idx}
                cell={cell}
                onUpdate={(c) => updateCell(idx, c)}
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
                  <span className="text-[11px] text-gray-600">Text Color</span>
                  <input
                    type="color"
                    value={config.textColor}
                    onChange={(e) => onChange({ ...config, textColor: e.target.value })}
                    className="w-6 h-6 rounded border border-gray-200 cursor-pointer"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-600">Borders</span>
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
                  <span className="text-[11px] text-gray-600">Height (pt)</span>
                  <input
                    type="number"
                    value={config.heightPt}
                    onChange={(e) => onChange({ ...config, heightPt: Number(e.target.value) })}
                    className="w-14 text-[10px] border border-gray-200 rounded px-1.5 py-0.5"
                    min={10}
                    max={40}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
