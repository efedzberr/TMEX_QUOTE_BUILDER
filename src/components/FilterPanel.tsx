import { useState, useEffect } from 'react';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
import { QUOTE_FIELD_CATALOG } from '../lib/quoteFieldCatalog';
import {
  FilterCriterion, OwnerScope, getOperatorsForType,
  getPicklistValues, validateFilterLogic, rewriteFilterLogicOnRemove,
} from '../lib/quoteFilterEngine';
import {
  RELATIVE_TOKENS_BY_UNIT, RELATIVE_TOKEN_MAP, RelativeUnit,
  parseRelativeValue, serializeRelativeValue, isValidRelativeN,
  RelativeValue,
} from '../lib/relativeDates';

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  criteria: FilterCriterion[];
  filterLogic: string;
  ownerScope: OwnerScope;
  ownerProfiles: { id: string; display_name: string }[];
  isReadOnly: boolean;
  onSave: (criteria: FilterCriterion[], filterLogic: string, ownerScope: OwnerScope) => void;
}

export function FilterPanel({ isOpen, onClose, criteria, filterLogic, ownerScope, ownerProfiles, isReadOnly, onSave }: FilterPanelProps) {
  const [localCriteria, setLocalCriteria] = useState<FilterCriterion[]>(criteria);
  const [localLogic, setLocalLogic] = useState(filterLogic);
  const [localScope, setLocalScope] = useState<OwnerScope>(ownerScope);
  const [showLogicInput, setShowLogicInput] = useState(filterLogic.trim().length > 0);
  const [logicError, setLogicError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalCriteria(criteria);
      setLocalLogic(filterLogic);
      setLocalScope(ownerScope);
      setShowLogicInput(filterLogic.trim().length > 0);
      setLogicError(null);
    }
  }, [isOpen, criteria, filterLogic, ownerScope]);

  useEffect(() => {
    if (localLogic.trim()) {
      const err = validateFilterLogic(localLogic, localCriteria.length);
      setLogicError(err);
    } else {
      setLogicError(null);
    }
  }, [localLogic, localCriteria.length]);

  function addCriterion() {
    const firstField = QUOTE_FIELD_CATALOG[0];
    const ops = getOperatorsForType(firstField.dataType);
    setLocalCriteria([...localCriteria, {
      id: crypto.randomUUID(),
      field: firstField.key,
      operator: ops[0].value,
      value: '',
    }]);
  }

  function removeCriterion(index: number) {
    if (localLogic.trim()) {
      const rewritten = rewriteFilterLogicOnRemove(localLogic, index + 1, localCriteria.length);
      if (rewritten === null) {
        setLocalLogic('');
        setShowLogicInput(false);
      } else {
        setLocalLogic(rewritten);
      }
    }
    setLocalCriteria(localCriteria.filter((_, i) => i !== index));
  }

  function updateCriterion(index: number, updates: Partial<FilterCriterion>) {
    setLocalCriteria(localCriteria.map((c, i) => {
      if (i !== index) return c;
      const updated = { ...c, ...updates };
      if (updates.field && updates.field !== c.field) {
        const newFieldDef = QUOTE_FIELD_CATALOG.find(f => f.key === updates.field);
        const ops = newFieldDef ? getOperatorsForType(newFieldDef.dataType) : [];
        updated.operator = ops[0]?.value || '';
        updated.value = '';
      }
      return updated;
    }));
  }

  function handleSave() {
    if (logicError) return;
    // Block save if any relative-date criterion has invalid N
    for (const c of localCriteria) {
      const fd = QUOTE_FIELD_CATALOG.find(f => f.key === c.field);
      if (fd && (fd.dataType === 'date' || fd.dataType === 'datetime')) {
        const rel = parseRelativeValue(c.value);
        if (rel) {
          const def = RELATIVE_TOKEN_MAP.get(rel.token);
          if (def?.takesN && !isValidRelativeN(rel.n)) return;
        }
      }
    }
    onSave(localCriteria, localLogic, localScope);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-[420px] bg-white shadow-2xl flex flex-col h-full animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Filters</h2>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={!!logicError}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
          </div>
        </div>

        {isReadOnly && (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700">View is read-only — filter changes are session-only.</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Owner scope */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Filter by Owner</label>
            <div className="flex gap-2">
              <button
                onClick={() => setLocalScope('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${localScope === 'all' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                All Quotes
              </button>
              <button
                onClick={() => setLocalScope('mine')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${localScope === 'mine' ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                My Quotes
              </button>
            </div>
          </div>

          {/* Criteria */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Filter Criteria</label>
            {localCriteria.length === 0 && (
              <p className="text-xs text-gray-400 italic">No filters added.</p>
            )}
            <div className="space-y-3">
              {localCriteria.map((criterion, idx) => (
                <CriterionRow
                  key={criterion.id}
                  index={idx}
                  criterion={criterion}
                  ownerProfiles={ownerProfiles}
                  onUpdate={(updates) => updateCriterion(idx, updates)}
                  onRemove={() => removeCriterion(idx)}
                />
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <button onClick={addCriterion} className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Filter
              </button>
              {localCriteria.length > 0 && (
                <button
                  onClick={() => { setLocalCriteria([]); setLocalLogic(''); setShowLogicInput(false); }}
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
                  Remove All
                </button>
              )}
            </div>
          </div>

          {/* Filter logic */}
          {localCriteria.length >= 2 && (
            <div>
              {!showLogicInput ? (
                <button
                  onClick={() => setShowLogicInput(true)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Add Filter Logic
                </button>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Filter Logic</label>
                    <button
                      onClick={() => { setShowLogicInput(false); setLocalLogic(''); setLogicError(null); }}
                      className="text-[10px] text-gray-400 hover:text-gray-600"
                    >
                      Remove logic
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mb-1.5">
                    Default: Match all (AND). Use numbers and AND/OR with parentheses, e.g. "1 AND (2 OR 3)"
                  </p>
                  <input
                    type="text"
                    value={localLogic}
                    onChange={e => setLocalLogic(e.target.value)}
                    placeholder="e.g. 1 AND (2 OR 3)"
                    className={`w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 ${logicError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200'}`}
                  />
                  {logicError && (
                    <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> {logicError}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Individual criterion row ---

function CriterionRow({ index, criterion, ownerProfiles, onUpdate, onRemove }: {
  index: number;
  criterion: FilterCriterion;
  ownerProfiles: { id: string; display_name: string }[];
  onUpdate: (updates: Partial<FilterCriterion>) => void;
  onRemove: () => void;
}) {
  const fieldDef = QUOTE_FIELD_CATALOG.find(f => f.key === criterion.field);
  const operators = fieldDef ? getOperatorsForType(fieldDef.dataType) : [];
  const picklistValues = criterion.field ? getPicklistValues(criterion.field) : null;
  const isOwnerField = criterion.field === 'owner_name';
  const isDateField = fieldDef?.dataType === 'date' || fieldDef?.dataType === 'datetime';

  const relValue = isDateField ? parseRelativeValue(criterion.value) : null;
  const dateMode: 'specific' | 'relative' = relValue ? 'relative' : 'specific';

  function setDateMode(mode: 'specific' | 'relative') {
    if (mode === 'specific') {
      onUpdate({ value: '' });
    } else {
      onUpdate({ value: serializeRelativeValue({ token: 'TODAY' }) });
    }
  }

  function updateRelativeToken(token: string) {
    const def = RELATIVE_TOKEN_MAP.get(token);
    const newVal: RelativeValue = { token };
    if (def?.takesN) newVal.n = relValue?.n || 7;
    onUpdate({ value: serializeRelativeValue(newVal) });
  }

  function updateRelativeN(n: number) {
    if (!relValue) return;
    onUpdate({ value: serializeRelativeValue({ token: relValue.token, n }) });
  }

  return (
    <div className="p-3 rounded-lg border border-gray-200 bg-gray-50/50 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase">Filter {index + 1}</span>
        <button onClick={onRemove} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Field */}
      <select
        value={criterion.field}
        onChange={e => onUpdate({ field: e.target.value })}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
      >
        {QUOTE_FIELD_CATALOG.filter(f => !f.computed || f.key === 'total_amount').map(f => (
          <option key={f.key} value={f.key}>{f.label}</option>
        ))}
      </select>
      {/* Operator */}
      <select
        value={criterion.operator}
        onChange={e => onUpdate({ operator: e.target.value })}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
      >
        {operators.map(op => (
          <option key={op.value} value={op.value}>{op.label}</option>
        ))}
      </select>
      {/* Value */}
      {picklistValues ? (
        <select
          value={criterion.value}
          onChange={e => onUpdate({ value: e.target.value })}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          <option value="">-- Select --</option>
          {picklistValues.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      ) : isOwnerField ? (
        <select
          value={criterion.value}
          onChange={e => onUpdate({ value: e.target.value })}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
        >
          <option value="">-- Select Owner --</option>
          {ownerProfiles.map(p => (
            <option key={p.id} value={p.display_name}>{p.display_name}</option>
          ))}
        </select>
      ) : isDateField ? (
        <DateValueInput
          mode={dateMode}
          onModeChange={setDateMode}
          specificValue={dateMode === 'specific' ? criterion.value : ''}
          onSpecificChange={v => onUpdate({ value: v })}
          relativeValue={relValue}
          onTokenChange={updateRelativeToken}
          onNChange={updateRelativeN}
        />
      ) : fieldDef?.dataType === 'number' || fieldDef?.dataType === 'currency' ? (
        <input
          type="number"
          step="any"
          value={criterion.value}
          onChange={e => onUpdate({ value: e.target.value })}
          placeholder="Enter value"
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
      ) : (
        <input
          type="text"
          value={criterion.value}
          onChange={e => onUpdate({ value: e.target.value })}
          placeholder="Enter value"
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
      )}
    </div>
  );
}

// --- Date value input with specific/relative modes ---

const UNIT_LABELS: Record<RelativeUnit, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

function DateValueInput({ mode, onModeChange, specificValue, onSpecificChange, relativeValue, onTokenChange, onNChange }: {
  mode: 'specific' | 'relative';
  onModeChange: (m: 'specific' | 'relative') => void;
  specificValue: string;
  onSpecificChange: (v: string) => void;
  relativeValue: RelativeValue | null;
  onTokenChange: (token: string) => void;
  onNChange: (n: number) => void;
}) {
  const currentDef = relativeValue ? RELATIVE_TOKEN_MAP.get(relativeValue.token) : null;
  const nValid = !currentDef?.takesN || isValidRelativeN(relativeValue?.n);

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex rounded-md border border-gray-200 overflow-hidden">
        <button
          type="button"
          onClick={() => onModeChange('specific')}
          className={`flex-1 px-2.5 py-1 text-xs font-medium transition-colors ${mode === 'specific' ? 'bg-blue-50 text-blue-700 border-r border-gray-200' : 'bg-white text-gray-500 hover:bg-gray-50 border-r border-gray-200'}`}
        >
          Specific date
        </button>
        <button
          type="button"
          onClick={() => onModeChange('relative')}
          className={`flex-1 px-2.5 py-1 text-xs font-medium transition-colors ${mode === 'relative' ? 'bg-blue-50 text-blue-700' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
        >
          Relative value
        </button>
      </div>

      {mode === 'specific' ? (
        <input
          type="date"
          value={specificValue}
          onChange={e => onSpecificChange(e.target.value)}
          className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
      ) : (
        <div className="space-y-1.5">
          <select
            value={relativeValue?.token || 'TODAY'}
            onChange={e => onTokenChange(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
          >
            {(Object.keys(RELATIVE_TOKENS_BY_UNIT) as RelativeUnit[]).map(unit => (
              <optgroup key={unit} label={UNIT_LABELS[unit]}>
                {RELATIVE_TOKENS_BY_UNIT[unit].map(t => (
                  <option key={t.token} value={t.token}>{t.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {currentDef?.takesN && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 shrink-0">N =</span>
              <input
                type="number"
                min={1}
                value={relativeValue?.n ?? ''}
                onChange={e => onNChange(parseInt(e.target.value, 10) || 0)}
                className={`w-20 px-2.5 py-1.5 text-sm border rounded-md bg-white focus:outline-none focus:ring-1 ${!nValid ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-300'}`}
              />
              {!nValid && (
                <span className="text-[10px] text-red-500">Must be 1 or more</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
