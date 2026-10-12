import { useState, useEffect, useMemo, useRef } from 'react';
import { FileDown, Loader2, ChevronDown, ExternalLink, Send, RefreshCw, Copy } from 'lucide-react';
import type { Quote, QuoteLane } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import type { CurrencyMode, UnitsMode, FooterSectionConfig } from '../../lib/pdfConfigTypes';
import { assemblePDFDocument, type GlobalVariables, type PDFDocument } from '../../lib/pdfAssembler';
import {
  generatePdfBlob,
  buildPdfFileName,
  downloadBlob,
  openBlobInNewTab,
  validateForPdfGeneration,
} from '../../lib/pdfGenerator';
import {
  loadStandardFormat,
  buildQuotePdfConfig,
  buildDefaultStandardFormat,
  DEFAULT_QUOTE_PDF_CHOICES,
  type QuotePdfChoices,
  type StandardPdfFormat,
} from '../../lib/pdfStandardFormat';
import { PdfLivePreview } from './PdfLivePreview';
import { PdfPortalStatusBar } from './PdfPortalStatusBar';
import { PdfSendToCustomerModal } from './PdfSendToCustomerModal';
import { AttachmentsSection } from './PdfFooterConfig';

interface Props {
  quote: Quote;
  lanes: QuoteLane[];
  onToast?: (message: string, type: 'success' | 'error') => void;
  onQuoteUpdate?: (updates: Partial<Quote>) => void;
  onViewResponse?: () => void;
}

const DEFAULT_GLOBAL_VARS: GlobalVariables = {
  fuel_rate_usd: 0,
  mxn_exchange_rate: 0,
  cad_exchange_rate: 0,
  us_fuel_difference: 0,
};

const CARD = 'bg-white border border-gray-200 rounded-lg p-4 space-y-4';
const LABEL = 'block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5';
const SELECT = 'w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:ring-1 focus:ring-blue-400';

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
        <div className="w-7 h-4 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all" />
      </label>
    </div>
  );
}

function sectionEnabled(sections: FooterSectionConfig[] | null | undefined, key: string): boolean {
  const s = (sections || []).find(x => x.key === key);
  return s ? s.enabled : true;
}

export function PdfSimpleTab({ quote, lanes, onToast, onQuoteUpdate, onViewResponse }: Props) {
  const [format, setFormat] = useState<StandardPdfFormat>(buildDefaultStandardFormat);
  const [choices, setChoices] = useState<QuotePdfChoices>(DEFAULT_QUOTE_PDF_CHOICES);
  const [existingConfigId, setExistingConfigId] = useState<string | undefined>(undefined);
  const [globalVars, setGlobalVars] = useState<GlobalVariables>(DEFAULT_GLOBAL_VARS);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalResend, setSendModalResend] = useState(false);
  const [showResendConfirm, setShowResendConfirm] = useState(false);
  const [portalUrlToShow, setPortalUrlToShow] = useState<string | null>(null);
  const [portalUrlCopied, setPortalUrlCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [loadedFormat, gvRes, cfgRes] = await Promise.all([
        loadStandardFormat(),
        supabase.from('global_variables').select('*').limit(1).maybeSingle(),
        supabase.from('pdf_configurations').select('*').eq('quote_id', quote.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setFormat(loadedFormat);
      if (gvRes.data) {
        setGlobalVars({
          fuel_rate_usd: gvRes.data.fuel_rate_usd || 0,
          mxn_exchange_rate: gvRes.data.mxn_exchange_rate || 0,
          cad_exchange_rate: gvRes.data.cad_exchange_rate || 0,
          us_fuel_difference: gvRes.data.us_fuel_difference || 0,
        });
      }
      const row = cfgRes.data;
      if (row) {
        setExistingConfigId(row.id);
        setChoices({
          language: row.language || DEFAULT_QUOTE_PDF_CHOICES.language,
          currency: row.currency_mode || DEFAULT_QUOTE_PDF_CHOICES.currency,
          units: row.units_mode || DEFAULT_QUOTE_PDF_CHOICES.units,
          includeTerms: sectionEnabled(row.footer_sections, 'terms'),
          includeAccessorials: sectionEnabled(row.footer_sections, 'accessorials'),
          attachedFiles: row.attached_files || [],
        });
      } else {
        setExistingConfigId(undefined);
        setChoices(DEFAULT_QUOTE_PDF_CHOICES);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [quote.id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const config = useMemo(
    () => buildQuotePdfConfig(quote.id, format, choices, existingConfigId),
    [quote.id, format, choices, existingConfigId],
  );
  const pdfDocument: PDFDocument = useMemo(
    () => assemblePDFDocument({ quote, lanes, configuration: config, globalVariables: globalVars }),
    [quote, lanes, config, globalVars],
  );

  async function saveConfig(): Promise<boolean> {
    const payload = {
      quote_id: config.quote_id,
      view_type: config.view_type,
      orientation: config.orientation,
      page_size: config.page_size,
      language: config.language,
      currency_mode: config.currency_mode,
      units_mode: config.units_mode,
      font_family: config.font_family,
      font_size: config.font_size,
      header_left: config.header_left,
      header_middle: config.header_middle,
      header_right: config.header_right,
      condensed_columns: config.condensed_columns,
      full_view_sections: config.full_view_sections,
      full_view_colors: config.full_view_colors,
      full_view_font_colors: config.full_view_font_colors,
      title_config: config.title_config,
      banner_config: config.banner_config,
      footer_sections: config.footer_sections,
      footer_accessorials: config.footer_accessorials,
      footer_terms: config.footer_terms,
      footer_acceptance: config.footer_acceptance,
      attached_files: config.attached_files,
      updated_at: new Date().toISOString(),
    };
    if (existingConfigId) {
      const { error } = await supabase.from('pdf_configurations').update(payload).eq('id', existingConfigId);
      return !error;
    }
    const { data, error } = await supabase.from('pdf_configurations').insert(payload).select().single();
    if (error || !data) return false;
    setExistingConfigId(data.id);
    return true;
  }

  function validate(): boolean {
    setGenError(null);
    const validation = validateForPdfGeneration(
      lanes as any,
      config.header_left,
      config.header_middle,
      config.header_right,
      'condensed',
      config.condensed_columns,
      config.full_view_sections
    );
    if (!validation.valid) {
      setGenError(validation.error || 'Validation failed');
      return false;
    }
    return true;
  }

  async function runGeneration(action: 'download' | 'open'): Promise<boolean> {
    setGenerating(true);
    setGenError(null);
    try {
      const saved = await saveConfig();
      if (!saved) {
        onToast?.('Could not save PDF settings', 'error');
        return false;
      }

      const blob = await generatePdfBlob(pdfDocument, choices.attachedFiles, choices.attachedFiles.length > 0);
      if (action === 'open') {
        openBlobInNewTab(blob);
      } else {
        downloadBlob(blob, buildPdfFileName(quote));
      }

      const currencyLabel = choices.currency === 'default' ? 'Per Lane' : choices.currency;
      const unitsLabel = choices.units === 'default' ? 'Per Lane' : choices.units;
      await supabase.from('quote_history').insert({
        quote_id: quote.id,
        date: new Date().toISOString(),
        user_name: quote.owner_name || 'System',
        action: 'PDF Generated',
        notes: `PDF generated (standard format) in ${choices.language === 'es' ? 'Spanish' : 'English'}, ${currencyLabel} currency, ${unitsLabel} units, T&C: ${choices.includeTerms ? 'Yes' : 'No'}, Accessorials: ${choices.includeAccessorials ? 'Yes' : 'No'}, Attachments: ${choices.attachedFiles.length}`,
      });

      onToast?.('PDF generated successfully', 'success');
      return true;
    } catch (err) {
      console.error('PDF generation error:', err);
      onToast?.('PDF generation failed. Please try again before sending.', 'error');
      return false;
    } finally {
      setGenerating(false);
    }
  }

  function beginGenerate(action: 'download' | 'open') {
    setShowDropdown(false);
    if (!validate()) return;
    runGeneration(action);
  }

  async function handleGenerateAndSend() {
    setShowDropdown(false);
    if (!validate()) return;
    const success = await runGeneration('download');
    if (!success) return;
    setSendModalResend(false);
    setShowSendModal(true);
  }

  async function handleGenerateAndResend() {
    setShowDropdown(false);
    if (quote.customer_review_status === 'pending') {
      setShowResendConfirm(true);
      return;
    }
    if (!validate()) return;
    const success = await runGeneration('download');
    if (!success) return;
    setSendModalResend(true);
    setShowSendModal(true);
  }

  async function confirmResendAndGenerate() {
    setShowResendConfirm(false);
    if (!validate()) return;
    const success = await runGeneration('download');
    if (!success) return;
    setSendModalResend(true);
    setShowSendModal(true);
  }

  function handleResendFromStatusBar() {
    if (quote.customer_review_status === 'pending') {
      setShowResendConfirm(true);
    } else {
      setSendModalResend(true);
      setShowSendModal(true);
    }
  }

  function handleSendSuccess(updates: Partial<Quote>, portalUrl: string, emailSuccess: boolean) {
    onQuoteUpdate?.(updates);
    setShowSendModal(false);
    setPortalUrlToShow(portalUrl);

    if (emailSuccess) {
      onToast?.(`Quote sent to ${updates.customer_email} successfully. Link copied to clipboard.`, 'success');
    } else {
      onToast?.('Quote saved but email could not be delivered. Link copied to clipboard -- please share it manually. Check browser console for details.', 'error');
    }

    navigator.clipboard.writeText(portalUrl).catch(() => {});
  }

  function handleCopyPortalUrl() {
    if (!portalUrlToShow) return;
    navigator.clipboard.writeText(portalUrlToShow).then(() => {
      setPortalUrlCopied(true);
      setTimeout(() => setPortalUrlCopied(false), 2000);
    }).catch(() => {});
  }

  const alreadySent = quote.customer_review_status === 'pending' || quote.customer_review_status === 'expired';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading configuration...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Quote PDF</h2>
          <p className="text-xs text-gray-500">Standard format — choose language, currency, units and what to include</p>
        </div>

        <div className="relative" ref={dropdownRef}>
          <div className="flex">
            <button
              onClick={handleGenerateAndSend}
              disabled={generating}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-l-lg hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Generate PDF & Send Email'}
            </button>
            <button
              onClick={() => setShowDropdown(prev => !prev)}
              disabled={generating}
              className="flex items-center px-2 py-2 text-white bg-blue-600 rounded-r-lg border-l border-blue-500 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-30 py-1">
              <button
                onClick={handleGenerateAndSend}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                <Send className="w-4 h-4 text-blue-600" />
                Generate PDF & Send Email
              </button>
              {alreadySent && (
                <button
                  onClick={handleGenerateAndResend}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                  Generate PDF & Resend to Customer
                </button>
              )}
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={() => beginGenerate('download')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <FileDown className="w-4 h-4 text-gray-400" />
                Download PDF
              </button>
              <button
                onClick={() => beginGenerate('open')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-gray-400" />
                Open in New Tab
              </button>
            </div>
          )}
        </div>
      </div>

      <PdfPortalStatusBar
        quote={quote}
        onResend={handleResendFromStatusBar}
        onViewResponse={onViewResponse}
        onToast={onToast}
      />

      {portalUrlToShow && (
        <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-xs font-semibold text-blue-800 mb-1">Portal link:</p>
            <p className="text-xs text-blue-700 truncate font-mono">{portalUrlToShow}</p>
          </div>
          <button
            onClick={handleCopyPortalUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-300 rounded-md hover:bg-blue-50 transition-colors flex-shrink-0"
          >
            <Copy className="w-3 h-3" />
            {portalUrlCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}

      {genError && (
        <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Cannot generate PDF: {genError}
        </div>
      )}

      {pdfDocument.meta.exchangeRateWarning && config.currency_mode !== 'default' && (
        <div className="mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          {pdfDocument.meta.exchangeRateWarning}
        </div>
      )}

      {showResendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Generate a new link?</h3>
            <p className="text-sm text-gray-500 mb-4">The customer's current link will stop working.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResendConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmResendAndGenerate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Generate New Link
              </button>
            </div>
          </div>
        </div>
      )}

      {showSendModal && (
        <PdfSendToCustomerModal
          quote={quote}
          lanes={lanes}
          pdfGenerated={true}
          isResend={sendModalResend}
          expiredDate={quote.customer_review_status === 'expired' ? quote.token_expires_at : undefined}
          onClose={() => setShowSendModal(false)}
          onSuccess={handleSendSuccess}
        />
      )}

      <div className="flex gap-5">
        <div className="w-80 flex-shrink-0 space-y-3">
          <div className={CARD}>
            <h3 className="text-sm font-semibold text-gray-900">Format options</h3>
            <div>
              <span className={LABEL}>Language</span>
              <div className="inline-flex w-full rounded-md border border-gray-200 overflow-hidden">
                {(['en', 'es'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setChoices(c => ({ ...c, language: lang }))}
                    className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${choices.language === lang ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    {lang === 'en' ? 'English' : 'Español'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={LABEL}>Currency</label>
              <select
                value={choices.currency}
                onChange={e => setChoices(c => ({ ...c, currency: e.target.value as CurrencyMode }))}
                className={SELECT}
              >
                <option value="default">Per lane (default)</option>
                <option value="USD">USD</option>
                <option value="MXN">MXN</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>Units</label>
              <select
                value={choices.units}
                onChange={e => setChoices(c => ({ ...c, units: e.target.value as UnitsMode }))}
                className={SELECT}
              >
                <option value="default">Per lane (default)</option>
                <option value="miles">Miles</option>
                <option value="kilometers">Kilometers</option>
              </select>
            </div>
          </div>

          <div className={CARD}>
            <h3 className="text-sm font-semibold text-gray-900">Include in the PDF</h3>
            <Switch label="Terms & Conditions" checked={choices.includeTerms} onChange={v => setChoices(c => ({ ...c, includeTerms: v }))} />
            <Switch label="Accessorials" checked={choices.includeAccessorials} onChange={v => setChoices(c => ({ ...c, includeAccessorials: v }))} />
          </div>

          <div className={CARD}>
            <h3 className="text-sm font-semibold text-gray-900">Attached PDFs</h3>
            <AttachmentsSection files={choices.attachedFiles} onChange={files => setChoices(c => ({ ...c, attachedFiles: files }))} />
            <p className="text-xs text-gray-500">Appended at the end of the quote PDF.</p>
          </div>

          <p className="text-xs text-gray-400 px-1">Logo, header, banner and footer layout are defined by the administrator.</p>
        </div>

        <div className="flex-1 min-w-0">
          <PdfLivePreview pdfDocument={pdfDocument} onReset={() => setChoices(DEFAULT_QUOTE_PDF_CHOICES)} />
        </div>
      </div>
    </div>
  );
}
