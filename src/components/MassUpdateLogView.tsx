import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, CheckCircle, AlertTriangle, XCircle, Calendar, User, Filter, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';


interface LogEntry {
  id: string;
  run_at: string;
  run_by: string;
  filter_criteria: Record<string, string>;
  fields_modified: FieldModified[];
  total_lanes_selected: number;
  total_quotes_created: number;
  total_emails_sent: number;
  total_emails_flagged: number;
  results: LogResult[];
  created_at: string;
}

interface FieldModified {
  fieldKey: string;
  fieldLabel: string;
  section: string;
  operation: 'increase' | 'discount';
  valueType: 'percentage' | 'amount';
  value: number;
}

interface LogResult {
  account: string;
  quoteId: string | null;
  quoteNumber: string | null;
  lanesCount: number;
  email: string;
  emailSent: boolean;
  status: 'success' | 'flagged' | 'error';
  error?: string;
}

export function MassUpdateLogView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('mass_update_log')
      .select('*')
      .order('run_at', { ascending: false });

    if (!error && data) setLogs(data as LogEntry[]);
    setLoading(false);
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function getActiveFilters(criteria: Record<string, string>): string[] {
    return Object.entries(criteria)
      .filter(([, v]) => v && v.trim() !== '')
      .map(([k, v]) => {
        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
        return `${label}: ${v}`;
      });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-[1200px] mx-auto px-8 pt-10 pb-4 w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mass Update History</h1>
            <p className="mt-1 text-sm text-gray-500">{logs.length} run{logs.length !== 1 ? 's' : ''} total</p>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-[1200px] w-full mx-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <Zap className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No mass updates have been run yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map(log => {
              const isExpanded = expandedId === log.id;
              const successCount = log.results.filter(r => r.status === 'success').length;
              const flaggedCount = log.results.filter(r => r.status === 'flagged').length;
              const errorCount = log.results.filter(r => r.status === 'error').length;
              const activeFilters = getActiveFilters(log.filter_criteria || {});

              return (
                <div key={log.id} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                  <div
                    className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-center gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-900">{formatDate(log.run_at)}</span>
                          <span className="text-xs text-gray-400">{formatTime(log.run_at)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">{log.run_by}</span>
                        </div>
                      </div>
                      <div className="h-8 w-px bg-gray-200" />
                      <div className="grid grid-cols-4 gap-6 text-center">
                        <StatCell label="Lanes" value={log.total_lanes_selected} />
                        <StatCell label="Quotes" value={log.total_quotes_created} />
                        <StatCell label="Emailed" value={log.total_emails_sent} color="green" />
                        <StatCell label="Flagged" value={log.total_emails_flagged} color="amber" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        {successCount > 0 && <span className="flex items-center gap-0.5 text-xs text-emerald-600"><CheckCircle className="w-3 h-3" />{successCount}</span>}
                        {flaggedCount > 0 && <span className="flex items-center gap-0.5 text-xs text-amber-600"><AlertTriangle className="w-3 h-3" />{flaggedCount}</span>}
                        {errorCount > 0 && <span className="flex items-center gap-0.5 text-xs text-red-600"><XCircle className="w-3 h-3" />{errorCount}</span>}
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-200 px-5 py-4 space-y-4 bg-gray-50/50">
                      {activeFilters.length > 0 && (
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            <Filter className="w-3 h-3" /> Filters Applied
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {activeFilters.map((f, i) => (
                              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">{f}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {log.fields_modified && log.fields_modified.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Fields Modified</div>
                          <div className="grid grid-cols-3 gap-2">
                            {log.fields_modified.map((fm, i) => (
                              <div key={i} className="bg-white border border-gray-200 rounded px-3 py-2 text-xs">
                                <div className="font-medium text-gray-900">{fm.fieldLabel}</div>
                                <div className="text-gray-500 mt-0.5">
                                  <span className={fm.operation === 'increase' ? 'text-emerald-600' : 'text-red-600'}>
                                    {fm.operation === 'increase' ? '+' : '-'}
                                    {fm.value}{fm.valueType === 'percentage' ? '%' : ' flat'}
                                  </span>
                                  <span className="text-gray-400 ml-1">({fm.section})</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Results by Account</div>
                        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Account</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Quote #</th>
                                <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase">Lanes</th>
                                <th className="px-3 py-2 text-left font-medium text-gray-500 uppercase">Email</th>
                                <th className="px-3 py-2 text-center font-medium text-gray-500 uppercase">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {log.results.map((r, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-medium text-gray-900">{r.account}</td>
                                  <td className="px-3 py-2 text-blue-600">{r.quoteNumber || '--'}</td>
                                  <td className="px-3 py-2 text-center text-gray-600">{r.lanesCount}</td>
                                  <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">{r.email || '--'}</td>
                                  <td className="px-3 py-2 text-center">
                                    {r.status === 'success' ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-medium">
                                        <CheckCircle className="w-3 h-3" /> Sent
                                      </span>
                                    ) : r.status === 'flagged' ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[10px] font-medium">
                                        <AlertTriangle className="w-3 h-3" /> No Email
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-700 rounded-full text-[10px] font-medium">
                                        <XCircle className="w-3 h-3" /> Error
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: number; color?: 'green' | 'amber' }) {
  const valueColor = color === 'green' ? 'text-emerald-600' : color === 'amber' ? 'text-amber-600' : 'text-gray-900';
  return (
    <div>
      <div className={`text-lg font-bold ${valueColor}`}>{value}</div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}
