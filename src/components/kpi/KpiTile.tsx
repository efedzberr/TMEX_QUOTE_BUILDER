import { useEffect, useRef, useState } from 'react';
import { GripVertical, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { KpiTile as KpiTileData } from '../../lib/kpiTiles';
import { kpiColorHex, kpiColorTint } from '../../lib/kpiPalette';

interface KpiTileProps {
  tile: KpiTileData;
  count: number | null | undefined; // undefined = loading
  active: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  // drag & drop (native HTML5)
  dragging: boolean;
  dropTarget: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

export function KpiTile({
  tile, count, active, onClick, onEdit, onDelete,
  dragging, dropTarget, onDragStart, onDragEnter, onDragEnd, onDrop,
}: KpiTileProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const unavailable = !tile.list_view;
  const hex = unavailable ? '#9CA3AF' : kpiColorHex(tile.color);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const display = unavailable || count === null ? '\u2014' : count === undefined ? '' : count.toLocaleString('en-US');

  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tile.id); onDragStart(); }}
      onDragEnter={e => { e.preventDefault(); onDragEnter(); }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={e => { e.preventDefault(); onDrop(); }}
      onDragEnd={onDragEnd}
      className={`group relative flex-1 min-w-0 rounded-lg border-2 bg-white transition-all ${unavailable ? 'cursor-default' : 'cursor-pointer hover:shadow-md'} ${dragging ? 'opacity-40' : ''} ${dropTarget && !dragging ? 'ring-2 ring-blue-400 ring-offset-2' : ''}`}
      style={{
        borderColor: active ? hex : kpiColorTint(hex, 0.45),
        backgroundColor: active ? kpiColorTint(hex, 0.08) : '#FFFFFF',
      }}
      onClick={() => { if (!unavailable) onClick(); }}
      title={unavailable ? 'View not available' : tile.list_view?.name}
    >
      <div className="px-3 pt-2 pb-2" style={{ textAlign: tile.align || 'left' }}>
        <div className="flex items-start gap-1">
          <GripVertical className="w-3 h-3 -ml-1.5 mt-0.5 text-gray-300 opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
          <p className={`flex-1 min-w-0 text-[11px] font-semibold uppercase tracking-wide truncate ${unavailable ? 'text-gray-400' : 'text-[#0F2A5C]'}`}>{tile.title}</p>
          <div className="relative -mr-1.5 -mt-1" ref={menuRef}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
              className={`p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              title="Options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-20 w-36 bg-white border border-gray-200 rounded-md shadow-lg py-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => { setMenuOpen(false); onEdit(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 text-left">
                  <Pencil className="w-3.5 h-3.5 text-gray-400" /> Edit
                </button>
                <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 text-left">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="mt-0.5 text-2xl font-bold leading-none tabular-nums" style={{ color: hex }}>
          {display || <span className="inline-block w-8 h-6 bg-gray-100 rounded animate-pulse" />}
        </p>
        {unavailable && <p className="mt-1 text-[10px] text-gray-400 italic">View not available</p>}
      </div>
    </div>
  );
}
