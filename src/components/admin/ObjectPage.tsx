import { useEffect, useState } from 'react';
import { Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminObjectFor } from '../../lib/adminObjectCatalog';

interface ObjectPageProps {
  objectId: string;
  /** the existing management screen, rendered under the Content tab */
  children?: React.ReactNode;
}

export function ObjectPage({ objectId, children }: ObjectPageProps) {
  const def = adminObjectFor(objectId);
  const [tab, setTab] = useState<'content' | 'fields'>(def?.fieldsOnly ? 'fields' : 'content');
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    setTab(def?.fieldsOnly ? 'fields' : 'content');
    setCount(null);
    if (!def?.table) return;
    let cancelled = false;
    let q = supabase.from(def.table).select('*', { count: 'exact', head: true });
    if (def.countFlag) q = q.eq(def.countFlag, true);
    q.then(({ count: c }) => { if (!cancelled) setCount(c ?? null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectId]);

  if (!def) return <>{children}</>;

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">{def.label}</h2>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          Object: <span className="font-mono">{def.table || '—'}</span>
          {count !== null && <> · {count.toLocaleString()} record{count === 1 ? '' : 's'}</>}
          {def.note && <> · {def.note}</>}
        </p>
      </div>

      <div className="flex gap-6 border-b border-gray-200 mb-5">
        {!def.fieldsOnly && (
          <button onClick={() => setTab('content')} className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'content' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            Content
          </button>
        )}
        <button onClick={() => setTab('fields')} className={`pb-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === 'fields' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Fields <span className="ml-1 text-xs text-gray-400">({def.fields.length})</span>
        </button>
      </div>

      {tab === 'content' && !def.fieldsOnly ? (
        <div>{children}</div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Field Label</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Column</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Required</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody>
              {def.fields.map(f => (
                <tr key={f.column} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-900">{f.label}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{f.column}</td>
                  <td className="px-4 py-2.5"><span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-50 border border-gray-200 text-gray-600">{f.type}</span></td>
                  <td className="px-4 py-2.5">{f.required ? <span className="text-red-600 font-medium">Yes</span> : <span className="text-gray-400">No</span>}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{f.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
