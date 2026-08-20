import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, Pin, PinOff, Search, Check, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sortLabelFromCatalog } from '../lib/quoteFieldCatalog';

export interface ListView {
  id: string;
  name: string;
  object: string;
  owner_user_id: string | null;
  visibility: string;
  is_system: boolean;
  filters: ListViewFilter[];
  filter_logic: string | null;
  columns: ListViewColumn[];
  sorting: ListViewSort[];
}

export interface ListViewFilter {
  field?: string;
  operator?: string;
  value?: string;
  special?: string;
}

export interface ListViewColumn {
  field: string;
  label: string;
}

export interface ListViewSort {
  field: string;
  direction: 'asc' | 'desc';
}

interface QuotesHomeHeaderProps {
  activeView: ListView | null;
  onViewChange: (view: ListView) => void;
  itemCount: number;
  lastUpdated: Date | null;
  effectiveSorting?: ListViewSort[];
  filterCount?: number;
  hasSearch?: boolean;
}

function relativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'a few seconds ago';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}



export function QuotesHomeHeader({ activeView, onViewChange, itemCount, lastUpdated, effectiveSorting, filterCount, hasSearch }: QuotesHomeHeaderProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [allViews, setAllViews] = useState<ListView[]>([]);
  const [recentViewIds, setRecentViewIds] = useState<string[]>([]);
  const [pinnedViewId, setPinnedViewId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadViews();
    loadPreferences();
  }, []);

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function loadViews() {
    const { data } = await supabase
      .from('list_views')
      .select('*')
      .eq('object', 'quote')
      .order('name');
    if (data) setAllViews(data as ListView[]);
  }

  async function loadPreferences() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('user_list_view_preferences')
      .select('*')
      .eq('user_id', user.id)
      .eq('object', 'quote')
      .maybeSingle();
    if (data) {
      setPinnedViewId(data.pinned_list_view_id);
      setRecentViewIds((data.recent_list_view_ids as string[]) || []);
    }
  }

  const togglePin = useCallback(async () => {
    if (!activeView) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newPinned = pinnedViewId === activeView.id ? null : activeView.id;
    setPinnedViewId(newPinned);

    await supabase
      .from('user_list_view_preferences')
      .upsert({
        user_id: user.id,
        object: 'quote',
        pinned_list_view_id: newPinned,
        recent_list_view_ids: recentViewIds,
      }, { onConflict: 'user_id,object' });
  }, [activeView, pinnedViewId, recentViewIds]);

  const selectView = useCallback(async (view: ListView) => {
    setOpen(false);
    setSearch('');
    onViewChange(view);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updated = [view.id, ...recentViewIds.filter(id => id !== view.id)].slice(0, 6);
    setRecentViewIds(updated);

    await supabase
      .from('user_list_view_preferences')
      .upsert({
        user_id: user.id,
        object: 'quote',
        pinned_list_view_id: pinnedViewId,
        recent_list_view_ids: updated,
      }, { onConflict: 'user_id,object' });
  }, [onViewChange, recentViewIds, pinnedViewId]);

  const filtered = search.trim()
    ? allViews.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
    : allViews;

  const recentViews = recentViewIds
    .map(id => allViews.find(v => v.id === id))
    .filter(Boolean)
    .slice(0, 4) as ListView[];

  const otherViews = filtered.filter(v => !recentViewIds.slice(0, 4).includes(v.id));

  const isPinned = activeView && pinnedViewId === activeView.id;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-4 h-4 text-gray-400" />
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Quotes</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 text-xl font-bold text-gray-900 hover:text-blue-700 transition-colors"
          >
            {activeView?.name || 'All Quotes'}
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
              <div className="p-3 border-b border-gray-100">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search lists..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="max-h-[360px] overflow-y-auto">
                {!search.trim() && recentViews.length > 0 && (
                  <div>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Recent List Views</span>
                    </div>
                    {recentViews.map(view => (
                      <button
                        key={view.id}
                        onClick={() => selectView(view)}
                        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors text-left"
                      >
                        <span className="text-sm text-gray-700">{view.name}</span>
                        {activeView?.id === view.id && <Check className="w-4 h-4 text-blue-600" />}
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      {search.trim() ? 'Results' : 'All List Views'}
                    </span>
                  </div>
                  {(search.trim() ? filtered : otherViews).map(view => (
                    <button
                      key={view.id}
                      onClick={() => selectView(view)}
                      className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors text-left"
                    >
                      <span className="text-sm text-gray-700">{view.name}</span>
                      {activeView?.id === view.id && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  ))}
                  {(search.trim() ? filtered : otherViews).length === 0 && (
                    <div className="px-4 py-4 text-sm text-gray-400 text-center">No views found</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={togglePin}
          title={isPinned ? 'Unpin this view' : 'Pin this view as default'}
          className={`p-1.5 rounded-md transition-colors ${isPinned ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
        >
          {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
        </button>
      </div>

      <p className="mt-1.5 text-xs text-gray-500">
        {itemCount} {itemCount === 1 ? 'item' : 'items'}
        {(effectiveSorting || activeView?.sorting || []).length > 0 && (
          <> &bull; Sorted by {sortLabelFromCatalog(effectiveSorting || activeView?.sorting || [])}</>
        )}
        {(filterCount ?? 0) > 0 && (
          <> &bull; {filterCount} filter{filterCount !== 1 ? 's' : ''} applied</>
        )}
        {hasSearch && <> &bull; filtered by search</>}
        {lastUpdated && (
          <> &bull; Updated {relativeTime(lastUpdated)}</>
        )}
      </p>
    </div>
  );
}
