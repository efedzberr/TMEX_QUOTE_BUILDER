import { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Zap, Check, Search, X, AlertTriangle, CheckCircle, XCircle, Loader2, Mail, ChevronDown, ChevronUp, History } from 'lucide-react';
import { supabase, Quote, QuoteLane } from '../lib/supabase';
import { EQUIPMENT_TYPES, OWNERS, formatCurrencyOrDash, buildQuoteName, CurrencyCode } from '../lib/constants';
import { generateReviewToken } from '../lib/customerPortalHelpers';
import { LaneBadge } from './LaneBadge';

interface MassUpdateViewProps {
  onBack: () => void;
  onViewLog: () => void;
}

type MassUpdateStep = 'filter' | 'configure' | 'preview' | 'processing';

interface FilterState {
  originCity: string;
  destinationCity: string;
  borderCrossingCity: string;
  market: string;
  serviceType: string;
  tripType: string;
  equipmentType: string;
  partnerAccount: string;
  shipper: string;
  bcoPartner: string;
  effectiveDateFrom: string;
  effectiveDateTo: string;
  expirationDateFrom: string;
  expirationDateTo: string;
  createdDateFrom: string;
  createdDateTo: string;
  modifiedDateFrom: string;
  modifiedDateTo: string;
}

const EMPTY_FILTERS: FilterState = {
  originCity: '', destinationCity: '', borderCrossingCity: '', market: '',
  serviceType: '', tripType: '', equipmentType: '', partnerAccount: '',
  shipper: '', bcoPartner: '', effectiveDateFrom: '', effectiveDateTo: '',
  expirationDateFrom: '', expirationDateTo: '', createdDateFrom: '',
  createdDateTo: '', modifiedDateFrom: '', modifiedDateTo: '',
};

interface FieldConfig {
  fieldKey: string;
  fieldLabel: string;
  section: string;
  included: boolean;
  operation: 'increase' | 'discount';
  valueType: 'percentage' | 'amount';
  value: number;
}

const UPDATABLE_FIELDS: Omit<FieldConfig, 'included' | 'operation' | 'valueType' | 'value'>[] = [
  { fieldKey: 'us_rate', fieldLabel: 'US Line Haul', section: 'US' },
  { fieldKey: 'us_rate_per_mile', fieldLabel: 'US Rate Per Mile', section: 'US' },
  { fieldKey: 'us_fuel_rate', fieldLabel: 'US Fuel Rate Per Mile', section: 'US' },
  { fieldKey: 'us_accessorials_amount', fieldLabel: 'US Accessorials', section: 'US' },
  { fieldKey: 'mx_rate', fieldLabel: 'MX Line Haul', section: 'MX' },
  { fieldKey: 'mx_rate_per_mile', fieldLabel: 'MX Rate Per Mile', section: 'MX' },
  { fieldKey: 'mx_fuel_rate', fieldLabel: 'MX Fuel Rate Per Mile', section: 'MX' },
  { fieldKey: 'mx_accessorials_amount', fieldLabel: 'MX Accessorials', section: 'MX' },
  { fieldKey: 'border_crossing_fee', fieldLabel: 'Border Crossing Fee', section: 'General' },
];

type LaneWithQuote = QuoteLane & { quotes: Partial<Quote> };

interface AccountGroup {
  partnerAccount: string;
  lanes: LaneWithQuote[];
  email: string;
  originalQuoteId: string;
}

interface MassUpdateResult {
  account: string;
  quoteId: string | null;
  quoteNumber: string | null;
  lanesCount: number;
  email: string;
  emailSent: boolean;
  status: 'success' | 'flagged' | 'error';
  error?: string;
}

function calculateNewValue(currentValue: number, operation: 'increase' | 'discount', valueType: 'percentage' | 'amount', value: number): number {
  if (valueType === 'percentage') {
    const factor = operation === 'increase' ? 1 + value / 100 : 1 - value / 100;
    return currentValue * factor;
  }
  return operation === 'increase' ? currentValue + value : currentValue - value;
}

function calculateLaneTotal(lane: Partial<QuoteLane>): number {
  const usRate = lane.us_rate || 0;
  const mxRate = lane.mx_rate || 0;
  const bcf = lane.border_crossing_fee || 0;
  const accessorials = (lane.accessorials_amount || 0) + (lane.us_accessorials_amount || 0) + (lane.mx_accessorials_amount || 0);
  const usFuel = lane.us_fuel_included_in_line_haul ? 0 : (lane.us_miles || 0) * (lane.us_fuel_rate || 0);
  const mxFuel = lane.mx_fuel_included_in_line_haul ? 0 : (lane.mx_miles || 0) * (lane.mx_fuel_rate || 0);
  if (lane.service_type === 'Loop') return mxRate + mxFuel + bcf + accessorials;
  if (lane.service_type === 'Domestic') return usRate + usFuel + accessorials;
  if (lane.border_crossing_only) return usRate + usFuel + bcf;
  return usRate + mxRate + usFuel + mxFuel + bcf + accessorials;
}

const STEPS: { key: MassUpdateStep; label: string }[] = [
  { key: 'filter', label: 'Filter Lanes' },
  { key: 'configure', label: 'Configure Updates' },
  { key: 'preview', label: 'Preview & Confirm' },
  { key: 'processing', label: 'Processing' },
];

export function MassUpdateView({ onBack, onViewLog }: MassUpdateViewProps) {
  const [step, setStep] = useState<MassUpdateStep>('filter');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [lanes, setLanes] = useState<LaneWithQuote[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [markets, setMarkets] = useState<string[]>([]);
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>(
    UPDATABLE_FIELDS.map(f => ({ ...f, included: false, operation: 'increase' as const, valueType: 'percentage' as const, value: 0 }))
  );
  const [accountEmails, setAccountEmails] = useState<Record<string, string>>({});
  const [results, setResults] = useState<MassUpdateResult[]>([]);
  const [currentProcessing, setCurrentProcessing] = useState('');
  const [processingDone, setProcessingDone] = useState(false);

  const selectedLanes = useMemo(() => lanes.filter(l => selectedIds.has(l.id)), [lanes, selectedIds]);
  const accountGroups = useMemo(() => buildAccountGroups(selectedLanes, accountEmails), [selectedLanes, accountEmails]);

  const stepIndex = STEPS.findIndex(s => s.key === step);

  useState(() => {
    supabase.from('cities').select('market_name').not('market_name', 'is', null).then(({ data }) => {
      const unique = [...new Set((data || []).map(d => d.market_name).filter(Boolean))].sort();
      setMarkets(unique);
    });
  });

  const handleApplyFilters = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const data = await fetchFilteredLanes(filters);
      setLanes(data);
      setSelectedIds(new Set());
    } catch {
      setLanes([]);
    }
    setLoading(false);
  }, [filters]);

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setLanes([]);
    setSelectedIds(new Set());
    setSearched(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(lanes.map(l => l.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const goToConfig = () => setStep('configure');
  const goToPreview = async () => {
    const emails: Record<string, string> = {};
    const accounts = [...new Set(selectedLanes.map(l => l.quotes?.partner_account).filter(Boolean))];
    for (const acct of accounts) {
      const { data } = await supabase.from('accounts').select('customer_email').eq('account_name', acct).maybeSingle();
      emails[acct as string] = data?.customer_email || '';
    }
    setAccountEmails(emails);
    setStep('preview');
  };

  const goToProcessing = async () => {
    setStep('processing');
    setProcessingDone(false);
    setResults([]);
    const runBy = OWNERS[0];
    const finalResults = await runMassUpdate(accountGroups, fieldConfigs, runBy, filters, setCurrentProcessing, setResults);
    setResults(finalResults);
    setProcessingDone(true);
  };

  const hasIncludedFields = fieldConfigs.some(f => f.included && f.value > 0);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-amber-500" />
            <h1 className="text-lg font-bold text-gray-900">Mass Lane Price Update</h1>
          </div>
          <button onClick={onViewLog} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <History className="w-4 h-4" /> View History
          </button>
        </div>
      </header>

      <StepIndicator steps={STEPS} currentIndex={stepIndex} />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-4">
        {step === 'filter' && (
          <FilterStep
            filters={filters} setFilters={setFilters} markets={markets}
            lanes={lanes} selectedIds={selectedIds} loading={loading} searched={searched}
            onApply={handleApplyFilters} onClear={handleClearFilters}
            onToggle={toggleSelect} onSelectAll={selectAll} onDeselectAll={deselectAll}
            onBack={onBack} onNext={goToConfig}
          />
        )}
        {step === 'configure' && (
          <ConfigureStep
            selectedLanes={selectedLanes} fieldConfigs={fieldConfigs}
            setFieldConfigs={setFieldConfigs}
            onBack={() => setStep('filter')} onNext={goToPreview}
            hasIncludedFields={hasIncludedFields}
          />
        )}
        {step === 'preview' && (
          <PreviewStep
            accountGroups={accountGroups} fieldConfigs={fieldConfigs}
            accountEmails={accountEmails} setAccountEmails={setAccountEmails}
            onBack={() => setStep('configure')} onRun={goToProcessing}
          />
        )}
        {step === 'processing' && (
          <ProcessingStep
            accountGroups={accountGroups} results={results}
            currentProcessing={currentProcessing} done={processingDone}
            onBack={onBack} onViewLog={onViewLog}
            onRunAnother={() => { setStep('filter'); setLanes([]); setSelectedIds(new Set()); setSearched(false); setResults([]); setProcessingDone(false); }}
          />
        )}
      </main>
    </div>
  );
}

function StepIndicator({ steps, currentIndex }: { steps: typeof STEPS; currentIndex: number }) {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-[1440px] mx-auto px-6 py-3">
        <div className="flex items-center justify-center">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < currentIndex ? 'bg-emerald-500 text-white' :
                  i === currentIndex ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {i < currentIndex ? <Check className="w-4 h-4" /> : i + 1}
                </div>
                <span className={`text-sm font-medium ${i === currentIndex ? 'text-blue-600' : i < currentIndex ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && <div className={`w-16 h-0.5 mx-3 ${i < currentIndex ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ====================== STEP 1 — FILTER ====================== */

function FilterStep({ filters, setFilters, markets, lanes, selectedIds, loading, searched, onApply, onClear, onToggle, onSelectAll, onDeselectAll, onBack, onNext }: {
  filters: FilterState; setFilters: (f: FilterState) => void; markets: string[];
  lanes: LaneWithQuote[]; selectedIds: Set<string>; loading: boolean; searched: boolean;
  onApply: () => void; onClear: () => void; onToggle: (id: string) => void;
  onSelectAll: () => void; onDeselectAll: () => void; onBack: () => void; onNext: () => void;
}) {
  const upd = (key: keyof FilterState, val: string) => setFilters({ ...filters, [key]: val });
  const curr = 'USD' as CurrencyCode;

  return (
    <div className="flex gap-4 items-start" style={{ minHeight: 'calc(100vh - 180px)' }}>
      <div className="w-[300px] flex-shrink-0 bg-white border border-gray-200 rounded-lg p-4 space-y-4 sticky top-4">
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Filters</h3>

        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lane Filters</div>
          <div className="space-y-2">
            <FilterInput label="Origin City" value={filters.originCity} onChange={v => upd('originCity', v)} placeholder="e.g. Laredo" />
            <FilterInput label="Destination City" value={filters.destinationCity} onChange={v => upd('destinationCity', v)} placeholder="e.g. Guadalajara" />
            <FilterInput label="Border Crossing" value={filters.borderCrossingCity} onChange={v => upd('borderCrossingCity', v)} placeholder="e.g. Laredo" />
            <FilterSelect label="Market" value={filters.market} onChange={v => upd('market', v)} options={[{ value: '', label: 'All Markets' }, ...markets.map(m => ({ value: m, label: m }))]} />
            <FilterSelect label="Service Type" value={filters.serviceType} onChange={v => upd('serviceType', v)} options={[{ value: '', label: 'All' }, { value: 'Loop', label: 'Loop' }, { value: 'Door to Door', label: 'Door to Door' }, { value: 'Domestic', label: 'Domestic' }]} />
            <FilterSelect label="Trip Type" value={filters.tripType} onChange={v => upd('tripType', v)} options={[{ value: '', label: 'All' }, { value: 'One Way', label: 'One Way' }, { value: 'Round Trip', label: 'Round Trip' }, { value: 'Circuit', label: 'Circuit' }]} />
            <FilterSelect label="Equipment Type" value={filters.equipmentType} onChange={v => upd('equipmentType', v)} options={[{ value: '', label: 'All' }, ...EQUIPMENT_TYPES.map(e => ({ value: e, label: e }))]} />
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quote Filters</div>
          <div className="space-y-2">
            <FilterInput label="Partner Account" value={filters.partnerAccount} onChange={v => upd('partnerAccount', v)} placeholder="e.g. PACCAR" />
            <FilterInput label="Shipper" value={filters.shipper} onChange={v => upd('shipper', v)} />
            <FilterInput label="BCO / Partner" value={filters.bcoPartner} onChange={v => upd('bcoPartner', v)} />
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Date Filters</div>
          <div className="space-y-2">
            <DateRange label="Effective Date" from={filters.effectiveDateFrom} to={filters.effectiveDateTo} onFromChange={v => upd('effectiveDateFrom', v)} onToChange={v => upd('effectiveDateTo', v)} />
            <DateRange label="Expiration Date" from={filters.expirationDateFrom} to={filters.expirationDateTo} onFromChange={v => upd('expirationDateFrom', v)} onToChange={v => upd('expirationDateTo', v)} />
            <DateRange label="Created Date" from={filters.createdDateFrom} to={filters.createdDateTo} onFromChange={v => upd('createdDateFrom', v)} onToChange={v => upd('createdDateTo', v)} />
            <DateRange label="Last Modified" from={filters.modifiedDateFrom} to={filters.modifiedDateTo} onFromChange={v => upd('modifiedDateFrom', v)} onToChange={v => upd('modifiedDateTo', v)} />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onApply} disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            <Search className="w-3.5 h-3.5" /> Apply Filters
          </button>
          <button onClick={onClear} className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="bg-white border border-gray-200 rounded-lg flex-1 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {loading ? 'Searching...' : searched ? `${lanes.length} lanes found \u2014 ${selectedIds.size} selected` : 'Apply filters to find lanes'}
            </span>
            {lanes.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={onSelectAll} className="text-xs text-blue-600 hover:underline">Select All</button>
                <span className="text-gray-300">|</span>
                <button onClick={onDeselectAll} className="text-xs text-blue-600 hover:underline">Deselect All</button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : !searched ? (
            <div className="flex-1 flex items-center justify-center py-20 text-gray-400 text-sm">
              Apply filters above to find lanes from Published quotes
            </div>
          ) : lanes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-20 text-gray-400 text-sm">
              No lanes found matching your filters
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-[12px]">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-center w-8"><input type="checkbox" checked={selectedIds.size === lanes.length && lanes.length > 0} onChange={() => selectedIds.size === lanes.length ? onDeselectAll() : onSelectAll()} className="rounded" /></th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase w-10"></th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Origin</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Destination</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">BC City</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trip</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Partner Account</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quote #</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">US LH</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">MX LH</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">BCF</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lanes.map((lane, i) => {
                    const total = calculateLaneTotal(lane);
                    const selected = selectedIds.has(lane.id);
                    return (
                      <tr key={lane.id} className={`hover:bg-gray-50 ${selected ? 'bg-blue-50/40' : ''}`}>
                        <td className="px-3 py-2 text-center"><input type="checkbox" checked={selected} onChange={() => onToggle(lane.id)} className="rounded" /></td>
                        <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2"><LaneBadge serviceType={lane.service_type || ''} tripType={lane.trip_type || ''} isSplitBilling={!!lane.split_billing_group} /></td>
                        <td className="px-3 py-2 text-gray-900 max-w-[120px] truncate">{lane.origin_city}</td>
                        <td className="px-3 py-2 text-gray-900 max-w-[120px] truncate">{lane.destination_city}</td>
                        <td className="px-3 py-2 text-gray-600 max-w-[100px] truncate">{lane.border_crossing || '\u2014'}</td>
                        <td className="px-3 py-2 text-gray-600">{lane.service_type || '\u2014'}</td>
                        <td className="px-3 py-2 text-gray-600">{lane.trip_type || '\u2014'}</td>
                        <td className="px-3 py-2 text-gray-900 font-medium max-w-[130px] truncate">{lane.quotes?.partner_account || '\u2014'}</td>
                        <td className="px-3 py-2 text-blue-600 text-[11px]">{lane.quotes?.quote_number || lane.quotes?.generated_quote_name || '\u2014'}</td>
                        <td className="px-3 py-2 text-right text-gray-800">{formatCurrencyOrDash(lane.us_rate, curr)}</td>
                        <td className="px-3 py-2 text-right text-gray-800">{formatCurrencyOrDash(lane.mx_rate, curr)}</td>
                        <td className="px-3 py-2 text-right text-gray-800">{formatCurrencyOrDash(lane.border_crossing_fee, curr)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrencyOrDash(total, curr)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Quotes
          </button>
          <button onClick={onNext} disabled={selectedIds.size === 0} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
            Next: Configure Updates <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">{label}</label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-white">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function DateRange({ label, from, to, onFromChange, onToChange }: { label: string; from: string; to: string; onFromChange: (v: string) => void; onToChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-0.5">{label}</label>
      <div className="flex gap-1.5">
        <input type="date" value={from} onChange={e => onFromChange(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={to} onChange={e => onToChange(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500" />
      </div>
    </div>
  );
}

/* ====================== STEP 2 — CONFIGURE ====================== */

function ConfigureStep({ selectedLanes, fieldConfigs, setFieldConfigs, onBack, onNext, hasIncludedFields }: {
  selectedLanes: LaneWithQuote[]; fieldConfigs: FieldConfig[];
  setFieldConfigs: (fc: FieldConfig[]) => void;
  onBack: () => void; onNext: () => void; hasIncludedFields: boolean;
}) {
  const uniqueAccounts = new Set(selectedLanes.map(l => l.quotes?.partner_account).filter(Boolean));

  const updateField = (index: number, updates: Partial<FieldConfig>) => {
    setFieldConfigs(fieldConfigs.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const avgForField = (fieldKey: string): number => {
    const vals = selectedLanes.map(l => Number((l as Record<string, unknown>)[fieldKey]) || 0).filter(v => v > 0);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };

  let lastSection = '';

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        Updating <strong>{selectedLanes.length}</strong> lanes across <strong>{uniqueAccounts.size}</strong> Parent Account{uniqueAccounts.size !== 1 ? 's' : ''}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-12">Include</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Field</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase w-36">Operation</th>
              <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase w-24">Type</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-28">Value</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-48">Preview</th>
            </tr>
          </thead>
          <tbody>
            {fieldConfigs.map((fc, i) => {
              const showSection = fc.section !== lastSection;
              lastSection = fc.section;
              const avg = avgForField(fc.fieldKey);
              const newVal = fc.included && fc.value > 0 ? calculateNewValue(avg, fc.operation, fc.valueType, fc.value) : avg;

              return (
                <Fragment key={fc.fieldKey}>
                  {showSection && (
                    <tr><td colSpan={6} className="px-4 py-1.5 bg-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">{fc.section} Section</td></tr>
                  )}
                  <tr className={`border-b border-gray-100 ${!fc.included ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2 text-center">
                      <input type="checkbox" checked={fc.included} onChange={() => updateField(i, { included: !fc.included })} className="rounded" />
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-800">{fc.fieldLabel}</td>
                    <td className="px-4 py-2">
                      <select value={fc.operation} onChange={e => updateField(i, { operation: e.target.value as 'increase' | 'discount' })} disabled={!fc.included} className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white disabled:bg-gray-100">
                        <option value="increase">Increase {'\u2191'}</option>
                        <option value="discount">Discount {'\u2193'}</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-center">
                        <div className="inline-flex border border-gray-300 rounded overflow-hidden">
                          <button onClick={() => updateField(i, { valueType: 'percentage' })} disabled={!fc.included} className={`px-2.5 py-1 text-xs font-medium transition-colors ${fc.valueType === 'percentage' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>%</button>
                          <button onClick={() => updateField(i, { valueType: 'amount' })} disabled={!fc.included} className={`px-2.5 py-1 text-xs font-medium transition-colors ${fc.valueType === 'amount' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>$</button>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <input type="number" min={0} step={0.01} value={fc.value || ''} onChange={e => updateField(i, { value: parseFloat(e.target.value) || 0 })} disabled={!fc.included} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right disabled:bg-gray-100" placeholder="0.00" />
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-gray-500">
                      {avg > 0 ? (
                        <span>Avg: ${avg.toFixed(2)} {'\u2192'} <span className={fc.included && fc.value > 0 ? 'font-semibold text-gray-900' : ''}>${newVal.toFixed(2)}</span></span>
                      ) : '\u2014'}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back: Reselect Lanes
        </button>
        <button onClick={onNext} disabled={!hasIncludedFields} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors">
          Next: Preview <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

import { Fragment } from 'react';

/* ====================== STEP 3 — PREVIEW ====================== */

function PreviewStep({ accountGroups, fieldConfigs, accountEmails, setAccountEmails, onBack, onRun }: {
  accountGroups: AccountGroup[]; fieldConfigs: FieldConfig[];
  accountEmails: Record<string, string>; setAccountEmails: (e: Record<string, string>) => void;
  onBack: () => void; onRun: () => void;
}) {
  const included = fieldConfigs.filter(f => f.included && f.value > 0);
  const totalLanes = accountGroups.reduce((s, g) => s + g.lanes.length, 0);
  const emailsReady = accountGroups.filter(g => g.email).length;
  const flagged = accountGroups.length - emailsReady;

  const updateEmail = (account: string, email: string) => {
    setAccountEmails({ ...accountEmails, [account]: email });
  };

  const saveEmail = async (account: string) => {
    const email = accountEmails[account];
    if (!email) return;
    await supabase.from('accounts').update({ customer_email: email }).eq('account_name', account);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <SummaryTile icon={<Zap className="w-4 h-4" />} label="Lanes Selected" value={totalLanes} color="blue" />
        <SummaryTile icon={<CheckCircle className="w-4 h-4" />} label="New Quotes" value={accountGroups.length} color="green" />
        <SummaryTile icon={<Mail className="w-4 h-4" />} label="Emails Ready" value={emailsReady} color="green" />
        <SummaryTile icon={<AlertTriangle className="w-4 h-4" />} label="Flagged" value={flagged} color="amber" />
      </div>

      <div className="space-y-3">
        {accountGroups.map(group => (
          <AccountPreviewCard key={group.partnerAccount} group={group} included={included} accountEmails={accountEmails} onEmailChange={updateEmail} onSaveEmail={saveEmail} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back: Reconfigure
        </button>
        <button onClick={onRun} className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors shadow-sm">
          <Zap className="w-4 h-4" /> Run Mass Update
        </button>
      </div>
    </div>
  );
}

function SummaryTile({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'blue' | 'green' | 'amber' }) {
  const styles = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  return (
    <div className={`rounded-lg border px-4 py-3 ${styles[color]}`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-semibold uppercase tracking-wider">{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function AccountPreviewCard({ group, included, accountEmails, onEmailChange, onSaveEmail }: {
  group: AccountGroup; included: FieldConfig[];
  accountEmails: Record<string, string>;
  onEmailChange: (account: string, email: string) => void;
  onSaveEmail: (account: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const email = accountEmails[group.partnerAccount] || '';
  const hasEmail = !!email;
  const borderColor = hasEmail ? 'border-l-emerald-500' : 'border-l-amber-500';

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm border-l-4 ${borderColor} overflow-hidden`}>
      <div className="px-4 py-3 flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div>
          <div className="font-bold text-gray-900">{group.partnerAccount}</div>
          <div className="text-xs text-gray-500 mt-0.5">{group.lanes.length} lane{group.lanes.length !== 1 ? 's' : ''} &middot; 1 new quote to be created</div>
        </div>
        <div className="flex items-center gap-3">
          {hasEmail ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
              <CheckCircle className="w-3.5 h-3.5" /> {email}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="w-3 h-3" /> No email</span>
              <input type="email" value={email} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); onEmailChange(group.partnerAccount, e.target.value); }} placeholder="customer@company.com" className="px-2 py-1 border border-gray-300 rounded text-xs w-48 focus:ring-1 focus:ring-blue-500" />
              <button onClick={e => { e.stopPropagation(); onSaveEmail(group.partnerAccount); }} className="px-2 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50">Save</button>
            </div>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {group.lanes.map((lane, i) => {
            const currentTotal = calculateLaneTotal(lane);
            const updated = applyUpdates(lane, included);
            const newTotal = calculateLaneTotal(updated);
            return (
              <div key={lane.id} className="border border-gray-100 rounded p-3">
                <div className="text-xs font-medium text-gray-700 mb-2">
                  Lane {i + 1} &mdash; {lane.origin_city} {'\u2192'} {lane.destination_city} {lane.border_crossing ? `| ${lane.border_crossing}` : ''}
                </div>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-100">
                      <th className="text-left py-1 font-medium">Field</th>
                      <th className="text-right py-1 font-medium">Current</th>
                      <th className="text-right py-1 font-medium">New</th>
                      <th className="text-right py-1 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {included.map(fc => {
                      const curr = Number((lane as Record<string, unknown>)[fc.fieldKey]) || 0;
                      const nv = Number((updated as Record<string, unknown>)[fc.fieldKey]) || 0;
                      const diff = nv - curr;
                      const pct = curr > 0 ? (diff / curr * 100) : 0;
                      return (
                        <tr key={fc.fieldKey} className="border-b border-gray-50">
                          <td className="py-1 text-gray-700">{fc.fieldLabel}</td>
                          <td className="py-1 text-right text-gray-600">${curr.toFixed(2)}</td>
                          <td className="py-1 text-right font-semibold text-gray-900">${nv.toFixed(2)}</td>
                          <td className={`py-1 text-right font-medium ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {diff > 0 ? '+' : ''}{fc.valueType === 'percentage' ? `${pct.toFixed(1)}%` : `$${diff.toFixed(2)}`}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="font-semibold">
                      <td className="py-1 text-gray-900">Lane Total</td>
                      <td className="py-1 text-right text-gray-600">${currentTotal.toFixed(2)}</td>
                      <td className="py-1 text-right text-gray-900">${newTotal.toFixed(2)}</td>
                      <td className={`py-1 text-right ${newTotal - currentTotal > 0 ? 'text-emerald-600' : newTotal - currentTotal < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {newTotal - currentTotal > 0 ? '+' : ''}${(newTotal - currentTotal).toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ====================== STEP 4 — PROCESSING ====================== */

function ProcessingStep({ accountGroups, results, currentProcessing, done, onBack, onViewLog, onRunAnother }: {
  accountGroups: AccountGroup[]; results: MassUpdateResult[];
  currentProcessing: string; done: boolean;
  onBack: () => void; onViewLog: () => void; onRunAnother: () => void;
}) {
  const completed = results.length;
  const total = accountGroups.length;
  const successCount = results.filter(r => r.status === 'success').length;
  const flaggedCount = results.filter(r => r.status === 'flagged').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  if (done) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-4">Mass Update Complete</h2>
          <div className="grid grid-cols-2 gap-3 mb-6 text-left max-w-sm mx-auto">
            <div className="text-sm text-gray-600">Quotes created:</div><div className="text-sm font-bold text-gray-900">{results.filter(r => r.quoteId).length}</div>
            <div className="text-sm text-gray-600">PDFs emailed:</div><div className="text-sm font-bold text-gray-900">{successCount}</div>
            <div className="text-sm text-gray-600">Flagged (no email):</div><div className="text-sm font-bold text-amber-600">{flaggedCount}</div>
            <div className="text-sm text-gray-600">Failures:</div><div className="text-sm font-bold text-red-600">{errorCount}</div>
          </div>

          {errorCount > 0 && (
            <div className="mb-4 text-left bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="text-xs font-bold text-red-700 uppercase mb-1">Errors</div>
              {results.filter(r => r.status === 'error').map((r, i) => (
                <div key={i} className="text-xs text-red-600">{r.account}: {r.error}</div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-center gap-3">
            <button onClick={onBack} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">View All Quotes</button>
            <button onClick={onViewLog} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">View History Log</button>
            <button onClick={onRunAnother} className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600">Run Another</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-bold text-gray-900 mb-3">Processing Mass Update</h3>
        <div className="space-y-2">
          {accountGroups.map(g => {
            const result = results.find(r => r.account === g.partnerAccount);
            const isCurrent = currentProcessing === g.partnerAccount && !result;
            return (
              <div key={g.partnerAccount} className="flex items-center gap-3 py-1.5">
                <div className="w-5 h-5 flex items-center justify-center">
                  {result?.status === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
                   result?.status === 'flagged' ? <AlertTriangle className="w-4 h-4 text-amber-500" /> :
                   result?.status === 'error' ? <XCircle className="w-4 h-4 text-red-500" /> :
                   isCurrent ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> :
                   <div className="w-3 h-3 rounded-full bg-gray-300" />}
                </div>
                <div className="flex-1">
                  <span className={`text-sm font-medium ${result ? 'text-gray-900' : isCurrent ? 'text-blue-700' : 'text-gray-400'}`}>{g.partnerAccount}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {result?.status === 'success' ? `Quote created \u00B7 Email sent` :
                     result?.status === 'flagged' ? `Quote created \u00B7 No email` :
                     result?.status === 'error' ? result.error :
                     isCurrent ? 'Creating quote...' : 'Waiting...'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{completed} of {total} complete</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================== HELPERS ====================== */

function applyUpdates(lane: LaneWithQuote, included: FieldConfig[]): Partial<QuoteLane> {
  const updated: Record<string, unknown> = { ...lane };
  delete updated.quotes;
  for (const fc of included) {
    const currentVal = Number((lane as Record<string, unknown>)[fc.fieldKey]) || 0;
    updated[fc.fieldKey] = calculateNewValue(currentVal, fc.operation, fc.valueType, fc.value);
  }
  return updated as Partial<QuoteLane>;
}

function buildAccountGroups(lanes: LaneWithQuote[], emails: Record<string, string>): AccountGroup[] {
  const map = new Map<string, LaneWithQuote[]>();
  for (const lane of lanes) {
    const acct = lane.quotes?.partner_account || 'Unknown';
    if (!map.has(acct)) map.set(acct, []);
    map.get(acct)!.push(lane);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([acct, acctLanes]) => {
    const sorted = [...acctLanes].sort((a, b) => new Date(b.quotes?.created_at || 0).getTime() - new Date(a.quotes?.created_at || 0).getTime());
    return {
      partnerAccount: acct,
      lanes: acctLanes,
      email: emails[acct] || '',
      originalQuoteId: sorted[0]?.quote_id || '',
    };
  });
}

async function fetchFilteredLanes(filters: FilterState): Promise<LaneWithQuote[]> {
  let query = supabase
    .from('quote_lanes')
    .select(`*, quotes!inner(id, quote_number, generated_quote_name, partner_account, bill_to_customer, shipper, bco_partner, stage, owner_name, mx_sales_rep, us_sales_rep, currency, type_of_service, exchange_rate, cad_exchange_rate, today_fuel_rate, created_at)`)
    .eq('quotes.stage', 'Published');

  if (filters.originCity) query = query.ilike('origin_city', `%${filters.originCity}%`);
  if (filters.destinationCity) query = query.ilike('destination_city', `%${filters.destinationCity}%`);
  if (filters.borderCrossingCity) query = query.ilike('border_crossing', `%${filters.borderCrossingCity}%`);
  if (filters.serviceType) query = query.eq('service_type', filters.serviceType);
  if (filters.tripType) query = query.eq('trip_type', filters.tripType);
  if (filters.equipmentType) query = query.eq('equipment_type', filters.equipmentType);
  if (filters.partnerAccount) query = query.ilike('quotes.partner_account', `%${filters.partnerAccount}%`);
  if (filters.shipper) query = query.ilike('quotes.shipper', `%${filters.shipper}%`);
  if (filters.bcoPartner) query = query.ilike('quotes.bco_partner', `%${filters.bcoPartner}%`);
  if (filters.effectiveDateFrom) query = query.gte('effective_from_date', filters.effectiveDateFrom);
  if (filters.effectiveDateTo) query = query.lte('effective_from_date', filters.effectiveDateTo);
  if (filters.expirationDateFrom) query = query.gte('effective_to_date', filters.expirationDateFrom);
  if (filters.expirationDateTo) query = query.lte('effective_to_date', filters.expirationDateTo);
  if (filters.createdDateFrom) query = query.gte('created_at', filters.createdDateFrom);
  if (filters.createdDateTo) query = query.lte('created_at', filters.createdDateTo);
  if (filters.modifiedDateFrom) query = query.gte('updated_at', filters.modifiedDateFrom);
  if (filters.modifiedDateTo) query = query.lte('updated_at', filters.modifiedDateTo);

  const { data, error } = await query.order('sort_order', { ascending: true });
  if (error) throw error;

  let result = (data || []) as LaneWithQuote[];

  if (filters.market) {
    const { data: marketCities } = await supabase.from('cities').select('city_name').eq('market_name', filters.market);
    const cityNames = (marketCities || []).map(c => c.city_name.toLowerCase());
    result = result.filter(lane =>
      cityNames.some(name => lane.origin_city?.toLowerCase().includes(name) || lane.destination_city?.toLowerCase().includes(name))
    );
  }

  return result;
}

async function runMassUpdate(
  accountGroups: AccountGroup[],
  fieldConfigs: FieldConfig[],
  runBy: string,
  currentFilters: FilterState,
  setCurrentProcessing: (a: string) => void,
  setResults: (r: MassUpdateResult[]) => void,
): Promise<MassUpdateResult[]> {
  const results: MassUpdateResult[] = [];
  const included = fieldConfigs.filter(f => f.included && f.value > 0);

  for (const group of accountGroups) {
    setCurrentProcessing(group.partnerAccount);
    try {
      const newQuoteId = await createMassUpdateQuote(group);
      await createUpdatedLanes(newQuoteId, group.lanes, included);

      const token = generateReviewToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase.from('quotes').update({
        review_token: token,
        token_generated_at: new Date().toISOString(),
        token_expires_at: expiresAt.toISOString(),
        customer_review_status: 'pending',
        customer_email: group.email || '',
        stage: 'Sent to Customer',
      }).eq('id', newQuoteId);

      let emailSent = false;
      if (group.email) {
        try {
          await supabase.functions.invoke('send-quote-email', {
            body: {
              type: 'send_to_customer',
              quoteId: newQuoteId,
              customerEmail: group.email,
              customerName: group.partnerAccount,
              personalMessage: 'This is an automated mass price update notification for your current lanes with TransMex.',
            }
          });
          emailSent = true;
        } catch {
          // Email send failed but quote was created
        }
      }

      const { data: newQuoteData } = await supabase.from('quotes').select('quote_number').eq('id', newQuoteId).maybeSingle();

      results.push({
        account: group.partnerAccount,
        quoteId: newQuoteId,
        quoteNumber: newQuoteData?.quote_number || null,
        lanesCount: group.lanes.length,
        email: group.email || '',
        emailSent,
        status: emailSent ? 'success' : 'flagged',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        account: group.partnerAccount,
        quoteId: null,
        quoteNumber: null,
        lanesCount: group.lanes.length,
        email: group.email || '',
        emailSent: false,
        status: 'error',
        error: msg,
      });
    }
    setResults([...results]);
  }

  await supabase.from('mass_update_log').insert({
    run_by: runBy,
    filter_criteria: currentFilters,
    fields_modified: fieldConfigs.filter(f => f.included),
    total_lanes_selected: accountGroups.reduce((s, g) => s + g.lanes.length, 0),
    total_quotes_created: results.filter(r => r.quoteId).length,
    total_emails_sent: results.filter(r => r.emailSent).length,
    total_emails_flagged: results.filter(r => r.status === 'flagged').length,
    results,
  });

  return results;
}

async function createMassUpdateQuote(group: AccountGroup): Promise<string> {
  const { data: lastQuote } = await supabase.from('quotes').select('quote_number').order('quote_number', { ascending: false }).limit(1).maybeSingle();
  const lastNum = lastQuote ? parseInt(lastQuote.quote_number?.replace('TMQ-', '') || '0') : 0;
  const quoteNumber = `TMQ-${String(lastNum + 1).padStart(8, '0')}`;

  const { data: lastSeq } = await supabase.from('quotes').select('quote_name_sequence').order('quote_name_sequence', { ascending: false }).limit(1).maybeSingle();
  const nextSequence = (lastSeq?.quote_name_sequence || 0) + 1;

  const { data: accountData } = await supabase.from('accounts').select('account_code').eq('account_name', group.partnerAccount).maybeSingle();
  const accountCode = accountData?.account_code || 'XXXXXX';

  const originalQuote = group.lanes[0]?.quotes || {};
  const generatedQuoteName = buildQuoteName({
    mxSalesRep: (originalQuote as Record<string, string>).mx_sales_rep || '',
    ownerName: (originalQuote as Record<string, string>).owner_name || '',
    accountCode,
    createdAt: new Date().toISOString(),
    sequence: nextSequence,
    version: 1,
  });

  const { data: newQuote, error } = await supabase.from('quotes').insert({
    quote_number: quoteNumber,
    quote_name_sequence: nextSequence,
    quote_name_version: 1,
    generated_quote_name: generatedQuoteName,
    owner_name: (originalQuote as Record<string, string>).owner_name || '',
    mx_sales_rep: (originalQuote as Record<string, string>).mx_sales_rep || '',
    us_sales_rep: (originalQuote as Record<string, string>).us_sales_rep || '',
    partner_account: group.partnerAccount,
    bill_to_customer: (originalQuote as Record<string, string>).bill_to_customer || '',
    shipper: (originalQuote as Record<string, string>).shipper || '',
    bco_partner: (originalQuote as Record<string, string>).bco_partner || '',
    status: 'New',
    stage: 'New',
    currency: (originalQuote as Record<string, string>).currency || 'USD',
    units: 'Miles',
    type_of_service: (originalQuote as Record<string, string>).type_of_service || 'Dry Van',
    total_amount: 0,
    us_portion: 0,
    mx_rate: 0,
    border_crossing_fee: 0,
    exchange_rate: (originalQuote as Record<string, number>).exchange_rate || 0,
    cad_exchange_rate: (originalQuote as Record<string, number>).cad_exchange_rate || 0,
    today_fuel_rate: (originalQuote as Record<string, number>).today_fuel_rate || 0,
    is_mass_update: true,
  }).select().single();

  if (error) throw error;
  return newQuote.id;
}

async function createUpdatedLanes(newQuoteId: string, originalLanes: LaneWithQuote[], included: FieldConfig[]): Promise<void> {
  const LANE_FIELDS_TO_COPY = [
    'origin_city', 'destination_city', 'border_crossing', 'border_crossing_fee', 'border_crossing_rate',
    'us_rate', 'mx_rate', 'equipment_type', 'effective_from_date', 'effective_to_date',
    'additional_accessories', 'comments', 'commitment_type', 'frequency', 'fuel_rate_type',
    'load_frequency', 'load_volume', 'mx_fuel_rate', 'mx_miles', 'mx_rate_per_mile',
    'requested_discount_percent', 'requested_price', 'un_number', 'us_fuel_rate', 'us_miles',
    'us_rate_per_mile', 'volume', 'msds', 'weight', 'dimensions', 'invoice_value',
    'temperature', 'temperature_unit', 'packaging', 'units_type', 'currency_type',
    'trip_type', 'toll_rate', 'display_mode', 'rate_type', 'us_rate_type', 'mx_rate_type',
    'lane_type', 'priority', 'type_of_service', 'target', 'product', 'tarps',
    'vin_dimensions', 'number_of_vins', 'live_load_or_drop', 'service_type',
    'split_billing_group', 'split_billing_index', 'accessorials_amount', 'accessorials_list',
    'currency_code', 'units_code', 'border_crossing_only', 'us_fuel_included_in_line_haul',
    'mx_fuel_included_in_line_haul', 'stops_before', 'stops_after', 'origin_country_code',
    'destination_country_code', 'us_accessorials_list', 'us_accessorials_amount',
    'mx_accessorials_list', 'mx_accessorials_amount', 'estimated_total_us_section',
    'estimated_total_mx_section', 'us_fuel_difference', 'mx_fuel_difference',
  ];

  const newLanes = originalLanes.map((lane, index) => {
    const row: Record<string, unknown> = {
      quote_id: newQuoteId,
      sort_order: index + 1,
      lane_origin: 'Mass Update',
      lane_status: 'New',
    };

    for (const field of LANE_FIELDS_TO_COPY) {
      const val = (lane as Record<string, unknown>)[field];
      if (val !== undefined) row[field] = val;
    }

    for (const fc of included) {
      const currentVal = Number((lane as Record<string, unknown>)[fc.fieldKey]) || 0;
      row[fc.fieldKey] = calculateNewValue(currentVal, fc.operation, fc.valueType, fc.value);
    }

    return row;
  });

  const { error } = await supabase.from('quote_lanes').insert(newLanes);
  if (error) throw error;
}
