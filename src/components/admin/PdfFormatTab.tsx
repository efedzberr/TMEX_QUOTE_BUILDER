import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, RotateCcw, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Quote, QuoteLane } from '../../lib/supabase';
import type { AcceptanceConfig, FooterSectionConfig, PdfLanguage } from '../../lib/pdfConfigTypes';
import { assemblePDFDocument, type GlobalVariables } from '../../lib/pdfAssembler';
import {
  loadStandardFormat,
  saveStandardFormat,
  buildDefaultStandardFormat,
  buildQuotePdfConfig,
  DEFAULT_QUOTE_PDF_CHOICES,
  USER_CONTROLLED_FOOTER_KEYS,
  type StandardPdfFormat,
} from '../../lib/pdfStandardFormat';
import { usePermissions } from '../../lib/permissions';
import { PdfTitleConfig } from '../pdf/PdfTitleConfig';
import { PdfHeaderConfig } from '../pdf/PdfHeaderConfig';
import { PdfBannerConfig } from '../pdf/PdfBannerConfig';
import { PdfLivePreview } from '../pdf/PdfLivePreview';

interface Props { onToast: (message: string, type: 'success' | 'error') => void; }

const DEFAULT_GLOBAL_VARS: GlobalVariables = {
  fuel_rate_usd: 0,
  mxn_exchange_rate: 0,
  cad_exchange_rate: 0,
  us_fuel_difference: 0,
};

const ACCEPTANCE_FIELDS: { key: keyof AcceptanceConfig['fields']; label: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'date', label: 'Date' },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'name', label: 'Name' },
  { key: 'signature', label: 'Signature' },
];

const CARD = 'bg-white border border-gray-200 rounded-lg p-4';
const CARD_TITLE = 'text-sm font-semibold text-gray-900 mb-2';

function isUserControlled(key: string): boolean {
  return (USER_CONTROLLED_FOOTER_KEYS as readonly string[]).includes(key);
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-7 h-4 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
    </label>
  );
}

function FooterEditor({
  sections, acceptance, disabled, onSectionsChange, onAcceptanceChange,
}: {
  sections: FooterSectionConfig[];
  acceptance: AcceptanceConfig;
  disabled: boolean;
  onSectionsChange: (s: FooterSectionConfig[]) => void;
  onAcceptanceChange: (a: AcceptanceConfig) => void;
}) {
  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[idx], next[target]] = [next[target], next[idx]];
    onSectionsChange(next);
  }

  function patch(idx: number, changes: Partial<FooterSectionConfig>) {
    onSectionsChange(sections.map((s, i) => (i === idx ? { ...s, ...changes } : s)));
  }

  const acceptanceEnabled = sections.some(s => s.key === 'acceptance' && s.enabled);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {sections.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded border border-gray-100 bg-gray-50">
            <div className="flex flex-col">
              <button type="button" onClick={() => move(idx, -1)} disabled={disabled || idx === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move up">
                <ArrowUp className="w-3 h-3" />
              </button>
              <button type="button" onClick={() => move(idx, 1)} disabled={disabled || idx === sections.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move down">
                <ArrowDown className="w-3 h-3" />
              </button>
            </div>
            <span className="flex-1 min-w-0 text-xs font-medium text-gray-700 truncate">{s.label}</span>
            <label className="flex items-center gap-1 text-[10px] text-gray-500 flex-shrink-0">
              <input type="checkbox" checked={!!s.newPage} disabled={disabled} onChange={e => patch(idx, { newPage: e.target.checked })} className="w-3 h-3 rounded border-gray-300" />
              New page
            </label>
            {isUserControlled(s.key) ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 flex-shrink-0">Chosen by the user in each quote</span>
            ) : (
              <Switch checked={s.enabled} disabled={disabled} onChange={v => patch(idx, { enabled: v })} />
            )}
          </div>
        ))}
      </div>

      {acceptanceEnabled && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Acceptance block</p>
          <input
            type="text"
            value={acceptance.label}
            disabled={disabled}
            onChange={e => onAcceptanceChange({ ...acceptance, label: e.target.value })}
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50"
          />
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {ACCEPTANCE_FIELDS.map(f => (
              <label key={f.key} className="flex items-center gap-1 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={acceptance.fields[f.key]}
                  disabled={disabled}
                  onChange={e => onAcceptanceChange({ ...acceptance, fields: { ...acceptance.fields, [f.key]: e.target.checked } })}
                  className="w-3 h-3 rounded border-gray-300"
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PdfFormatTab({ onToast }: Props) {
  const { can } = usePermissions();
  const canEdit = can('admin.pdf_format', 'edit');

  const [format, setFormat] = useState<StandardPdfFormat>(buildDefaultStandardFormat);
  const [savedFormat, setSavedFormat] = useState<StandardPdfFormat>(buildDefaultStandardFormat);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');
  const [previewLanes, setPreviewLanes] = useState<QuoteLane[]>([]);
  const [globalVars, setGlobalVars] = useState<GlobalVariables>(DEFAULT_GLOBAL_VARS);
  const [previewLanguage, setPreviewLanguage] = useState<PdfLanguage>('en');

  useEffect(() => {
    (async () => {
      const [loaded, quotesRes, gvRes] = await Promise.all([
        loadStandardFormat(),
        supabase.from('quotes').select('*').order('updated_at', { ascending: false }).limit(20),
        supabase.from('global_variables').select('*').limit(1).maybeSingle(),
      ]);
      setFormat(loaded);
      setSavedFormat(loaded);
      if (quotesRes.error) {
        onToast('Could not load quotes for the preview', 'error');
      } else {
        const list = (quotesRes.data || []) as Quote[];
        setQuotes(list);
        if (list.length > 0) setSelectedQuoteId(list[0].id);
      }
      if (gvRes.data) {
        setGlobalVars({
          fuel_rate_usd: gvRes.data.fuel_rate_usd || 0,
          mxn_exchange_rate: gvRes.data.mxn_exchange_rate || 0,
          cad_exchange_rate: gvRes.data.cad_exchange_rate || 0,
          us_fuel_difference: gvRes.data.us_fuel_difference || 0,
        });
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedQuoteId) { setPreviewLanes([]); return; }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('quote_lanes').select('*').eq('quote_id', selectedQuoteId);
      if (cancelled) return;
      setPreviewLanes(error ? [] : ((data || []) as QuoteLane[]));
    })();
    return () => { cancelled = true; };
  }, [selectedQuoteId]);

  const previewQuote = useMemo(() => quotes.find(q => q.id === selectedQuoteId) || null, [quotes, selectedQuoteId]);

  const pdfDocument = useMemo(() => {
    if (!previewQuote) return null;
    const previewConfig = buildQuotePdfConfig(previewQuote.id, format, { ...DEFAULT_QUOTE_PDF_CHOICES, language: previewLanguage }, undefined);
    return assemblePDFDocument({ quote: previewQuote, lanes: previewLanes, configuration: previewConfig, globalVariables: globalVars });
  }, [previewQuote, previewLanes, format, previewLanguage, globalVars]);

  const dirty = useMemo(() => JSON.stringify(format) !== JSON.stringify(savedFormat), [format, savedFormat]);

  function handleRestoreDefaults() {
    if (!window.confirm('Restore the default format? Unsaved changes will be lost.')) return;
    setFormat(buildDefaultStandardFormat());
  }

  async function handleSave() {
    if (!canEdit || !dirty) return;
    setSaving(true);
    const ok = await saveStandardFormat(format);
    setSaving(false);
    if (ok) {
      setSavedFormat(format);
      onToast('PDF format saved', 'success');
    } else {
      onToast('Could not save the PDF format', 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-gray-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading format...
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Quote PDF Format</h2>
          <p className="text-xs text-gray-500">Standard format used by every quote PDF. The body columns, colors and fonts are fixed.</p>
          {!canEdit && <p className="text-xs text-gray-400 mt-1">You can view this format but not change it.</p>}
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
            <button
              onClick={handleRestoreDefaults}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Restore defaults
            </button>
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save format
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-5">
        <fieldset disabled={!canEdit} className="w-[420px] flex-shrink-0 space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
          <div className={CARD}>
            <h3 className={CARD_TITLE}>Title bar (logo)</h3>
            <p className="text-xs text-gray-500 mb-2">Upload or replace the logo here. Recommended: PNG or JPG under 300 KB.</p>
            <PdfTitleConfig config={format.title_config} onChange={tc => setFormat(f => ({ ...f, title_config: tc }))} hideStyling />
          </div>
          <div className={CARD}>
            <h3 className={CARD_TITLE}>Header fields</h3>
            <PdfHeaderConfig
              headerLeft={format.header_left}
              headerMiddle={format.header_middle}
              headerRight={format.header_right}
              onUpdate={(column, fields) => setFormat(f => ({ ...f, [column]: fields }))}
            />
          </div>
          <div className={CARD}>
            <h3 className={CARD_TITLE}>Banner</h3>
            <PdfBannerConfig config={format.banner_config} onChange={bc => setFormat(f => ({ ...f, banner_config: bc }))} hideStyling />
          </div>
          <div className={CARD}>
            <h3 className={CARD_TITLE}>Footer</h3>
            <FooterEditor
              sections={format.footer_sections}
              acceptance={format.footer_acceptance}
              disabled={!canEdit}
              onSectionsChange={s => setFormat(f => ({ ...f, footer_sections: s }))}
              onAcceptanceChange={a => setFormat(f => ({ ...f, footer_acceptance: a }))}
            />
          </div>
        </fieldset>

        <div className="flex-1 min-w-0">
          {quotes.length === 0 || !pdfDocument ? (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-sm text-gray-500">
              Create at least one quote to see the preview.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <label className="text-xs font-medium text-gray-600">Preview with quote</label>
                <select
                  value={selectedQuoteId}
                  onChange={e => setSelectedQuoteId(e.target.value)}
                  className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-blue-400 max-w-xs"
                >
                  {quotes.map(q => (
                    <option key={q.id} value={q.id}>{q.quote_number}{q.partner_account ? ` — ${q.partner_account}` : ''}</option>
                  ))}
                </select>
                <div className="inline-flex rounded-md border border-gray-200 overflow-hidden ml-auto">
                  {(['en', 'es'] as PdfLanguage[]).map(lang => (
                    <button
                      key={lang}
                      onClick={() => setPreviewLanguage(lang)}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${previewLanguage === lang ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                      {lang === 'en' ? 'English' : 'Español'}
                    </button>
                  ))}
                </div>
              </div>
              <PdfLivePreview pdfDocument={pdfDocument} onReset={() => setFormat(savedFormat)} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
