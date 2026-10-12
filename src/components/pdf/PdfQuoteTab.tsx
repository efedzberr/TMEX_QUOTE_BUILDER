import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Save, FileDown, Loader2, ChevronDown, ChevronRight, ExternalLink, Columns2 as Columns, LayoutList, FileText, LayoutGrid as Layout, Table, Layers, Crown, Flag, Send, RefreshCw, Copy } from 'lucide-react';
import type { Quote, QuoteLane } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import type { PdfConfig, PdfConfigTemplate } from '../../lib/pdfConfigTypes';
import { buildDefaultConfig, buildDefaultTitleConfig, buildDefaultBannerConfig, buildDefaultFullViewFontColors } from '../../lib/pdfConfigTypes';
import { assemblePDFDocument, type GlobalVariables, type PDFDocument } from '../../lib/pdfAssembler';
import {
  generatePdfBlob,
  buildPdfFileName,
  downloadBlob,
  openBlobInNewTab,
  validateForPdfGeneration,
} from '../../lib/pdfGenerator';
import { getPortalUrl } from '../../lib/customerPortalHelpers';
import { PdfTemplateBar } from './PdfTemplateBar';
import { PdfGlobalOptions } from './PdfGlobalOptions';
import { PdfHeaderConfig } from './PdfHeaderConfig';
import { PdfBodyConfig } from './PdfBodyConfig';
import { PdfFooterConfig } from './PdfFooterConfig';
import { PdfLivePreview } from './PdfLivePreview';
import { PdfTitleConfig } from './PdfTitleConfig';
import { PdfBannerConfig } from './PdfBannerConfig';
import { PdfPortalStatusBar } from './PdfPortalStatusBar';
import { PdfSendToCustomerModal } from './PdfSendToCustomerModal';

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

function CollapsibleSection({
  title, icon, collapsed, onToggle, summary, children,
}: {
  title: string;
  icon: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  summary?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        {icon}
        <span className="text-sm font-semibold text-gray-900 flex-1">{title}</span>
        {collapsed && summary && (
          <span className="text-[10px] text-gray-400 mr-2 truncate max-w-[180px]">{summary}</span>
        )}
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </button>
      <div
        className="transition-all duration-200 ease-in-out overflow-hidden"
        style={{ maxHeight: collapsed ? 0 : 2000, opacity: collapsed ? 0 : 1 }}
      >
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export function PdfQuoteTab({ quote, lanes, onToast, onQuoteUpdate, onViewResponse }: Props) {
  const [config, setConfig] = useState<PdfConfig>(() => buildDefaultConfig(quote.id));
  const [templates, setTemplates] = useState<PdfConfigTemplate[]>([]);
  const [globalVars, setGlobalVars] = useState<GlobalVariables>(DEFAULT_GLOBAL_VARS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendModalResend, setSendModalResend] = useState(false);
  const [showResendConfirm, setShowResendConfirm] = useState(false);
  const [portalUrlCopied, setPortalUrlCopied] = useState(false);
  const [portalUrlToShow, setPortalUrlToShow] = useState<string | null>(null);
  const pendingAction = useRef<{ type: 'download' | 'open' | 'condensed' | 'full' } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    global: true,
    title: true,
    banner: true,
    header: true,
    body: true,
    footer: true,
  });

  function toggleSection(key: string) {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    loadConfig();
    loadTemplates();
    loadGlobalVariables();
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

  async function loadGlobalVariables() {
    const { data } = await supabase
      .from('global_variables')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) {
      setGlobalVars({
        fuel_rate_usd: data.fuel_rate_usd || 0,
        mxn_exchange_rate: data.mxn_exchange_rate || 0,
        cad_exchange_rate: data.cad_exchange_rate || 0,
        us_fuel_difference: data.us_fuel_difference || 0,
      });
    }
  }

  async function loadConfig() {
    setLoading(true);
    const { data } = await supabase
      .from('pdf_configurations')
      .select('*')
      .eq('quote_id', quote.id)
      .maybeSingle();

    if (data) {
      const defaults = buildDefaultConfig(quote.id);
      setConfig({
        id: data.id,
        quote_id: data.quote_id,
        view_type: data.view_type,
        orientation: data.orientation,
        page_size: data.page_size || 'letter',
        language: data.language,
        currency_mode: data.currency_mode,
        units_mode: data.units_mode,
        font_family: data.font_family || 'Helvetica',
        font_size: data.font_size || 'medium',
        header_left: data.header_left || [],
        header_middle: data.header_middle || [],
        header_right: data.header_right || [],
        condensed_columns: data.condensed_columns || [],
        full_view_sections: data.full_view_sections || defaults.full_view_sections,
        full_view_colors: data.full_view_colors || defaults.full_view_colors,
        full_view_font_colors: data.full_view_font_colors || buildDefaultFullViewFontColors(),
        title_config: data.title_config || buildDefaultTitleConfig(),
        banner_config: data.banner_config || buildDefaultBannerConfig(),
        footer_sections: data.footer_sections || defaults.footer_sections,
        footer_accessorials: data.footer_accessorials || { quoteLevel: {}, laneLevel: {} },
        footer_terms: data.footer_terms || {},
        footer_acceptance: data.footer_acceptance || defaults.footer_acceptance,
        attached_files: data.attached_files || [],
      });
    } else {
      setConfig(buildDefaultConfig(quote.id));
    }
    setLoading(false);
  }

  async function loadTemplates() {
    const { data } = await supabase.from('pdf_config_templates').select('*').order('is_system', { ascending: false }).order('name');
    if (data) setTemplates(data);
  }

  const updateConfig = useCallback((field: string, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  const pdfDocument: PDFDocument = useMemo(() => {
    return assemblePDFDocument({
      quote,
      lanes,
      configuration: config,
      globalVariables: globalVars,
    });
  }, [quote, lanes, config, globalVars]);

  async function saveConfigSilent(): Promise<boolean> {
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

    if (config.id) {
      const { error } = await supabase.from('pdf_configurations').update(payload).eq('id', config.id);
      return !error;
    } else {
      const { data, error } = await supabase.from('pdf_configurations').insert(payload).select().single();
      if (!error && data) {
        setConfig(prev => ({ ...prev, id: data.id }));
        return true;
      }
      return false;
    }
  }

  async function saveConfig() {
    setSaving(true);
    const ok = await saveConfigSilent();
    onToast?.(ok ? 'Configuration saved' : 'Failed to save configuration', ok ? 'success' : 'error');
    setSaving(false);
  }

  function handleLoadTemplate(template: PdfConfigTemplate) {
    const tData = template.config_data as any;
    setConfig(prev => ({
      ...prev,
      view_type: tData.view_type || prev.view_type,
      orientation: tData.orientation || prev.orientation,
      page_size: tData.page_size || prev.page_size,
      language: tData.language || prev.language,
      currency_mode: tData.currency_mode || prev.currency_mode,
      units_mode: tData.units_mode || prev.units_mode,
      font_family: tData.font_family || prev.font_family,
      font_size: tData.font_size || prev.font_size,
      header_left: tData.header_left || prev.header_left,
      header_middle: tData.header_middle || prev.header_middle,
      header_right: tData.header_right || prev.header_right,
      condensed_columns: tData.condensed_columns || prev.condensed_columns,
      full_view_sections: tData.full_view_sections || prev.full_view_sections,
      full_view_colors: tData.full_view_colors || prev.full_view_colors,
      full_view_font_colors: tData.full_view_font_colors || prev.full_view_font_colors,
      title_config: tData.title_config || prev.title_config,
      banner_config: tData.banner_config || prev.banner_config,
      footer_sections: tData.footer_sections || prev.footer_sections,
      footer_acceptance: tData.footer_acceptance || prev.footer_acceptance,
    }));
    onToast?.(`Template "${template.name}" loaded`, 'success');
  }

  async function handleSaveTemplate(name: string) {
    const configData = {
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
      footer_acceptance: config.footer_acceptance,
    };
    const { error } = await supabase.from('pdf_config_templates').insert({ name, is_system: false, config_data: configData });
    if (!error) {
      loadTemplates();
      onToast?.(`Template "${name}" saved`, 'success');
    } else {
      onToast?.('Failed to save template', 'error');
    }
  }

  async function handleDeleteTemplate(id: string) {
    await supabase.from('pdf_config_templates').delete().eq('id', id);
    loadTemplates();
  }

  function handleReset() {
    setConfig(prev => ({ ...buildDefaultConfig(quote.id), id: prev.id, quote_id: prev.quote_id }));
    onToast?.('Configuration reset to defaults', 'success');
  }

  function validateAction(actionType: 'download' | 'open' | 'condensed' | 'full'): boolean {
    setGenError(null);
    const validation = validateForPdfGeneration(
      lanes as any,
      config.header_left,
      config.header_middle,
      config.header_right,
      actionType === 'condensed' ? 'condensed' : actionType === 'full' ? 'full' : config.view_type,
      config.condensed_columns,
      config.full_view_sections
    );
    if (!validation.valid) {
      setGenError(validation.error || 'Validation failed');
      return false;
    }
    return true;
  }

  async function runGeneration(actionType: 'download' | 'open' | 'condensed' | 'full'): Promise<boolean> {
    setGenerating(true);
    setGenError(null);

    try {
      let docToRender = pdfDocument;
      if (actionType === 'condensed' || actionType === 'full') {
        const overriddenConfig = { ...config, view_type: actionType as 'condensed' | 'full' };
        docToRender = assemblePDFDocument({
          quote,
          lanes,
          configuration: overriddenConfig,
          globalVariables: globalVars,
        });
      }

      const attachmentsSection = config.footer_sections.find(s => s.key === 'attachments');
      const attachmentsEnabled = attachmentsSection?.enabled ?? false;
      const blob = await generatePdfBlob(docToRender, config.attached_files, attachmentsEnabled);
      const fileName = buildPdfFileName(quote);

      if (actionType === 'open') {
        openBlobInNewTab(blob);
      } else {
        downloadBlob(blob, fileName);
      }

      const resolvedCurrency = config.currency_mode === 'default' ? 'Per Lane' : config.currency_mode;
      const resolvedUnits = config.units_mode === 'default' ? 'Per Lane' : config.units_mode;
      const viewUsed = actionType === 'condensed' ? 'condensed' : actionType === 'full' ? 'full' : config.view_type;

      await supabase.from('quote_history').insert({
        quote_id: quote.id,
        date: new Date().toISOString(),
        user_name: quote.owner_name || 'System',
        action: 'PDF Generated',
        notes: `PDF generated in ${config.language === 'es' ? 'Spanish' : 'English'}, ${viewUsed} view, ${resolvedCurrency} currency, ${resolvedUnits} units`,
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

  function beginGenerate(actionType: 'download' | 'open' | 'condensed' | 'full') {
    if (!validateAction(actionType)) return;
    pendingAction.current = { type: actionType };
    runGeneration(actionType);
  }

  async function handleGenerateAndSend() {
    setShowDropdown(false);
    if (!validateAction('download')) return;

    const success = await runGeneration('download');
    if (!success) return;

    setSendModalResend(false);
    setShowSendModal(true);
  }

  async function handleGenerateAndResend() {
    setShowDropdown(false);
    const status = quote.customer_review_status;

    if (status === 'pending') {
      setShowResendConfirm(true);
      return;
    }

    if (!validateAction('download')) return;
    const success = await runGeneration('download');
    if (!success) return;

    setSendModalResend(true);
    setShowSendModal(true);
  }

  async function confirmResendAndGenerate() {
    setShowResendConfirm(false);
    if (!validateAction('download')) return;
    const success = await runGeneration('download');
    if (!success) return;

    setSendModalResend(true);
    setShowSendModal(true);
  }

  function handleResendFromStatusBar() {
    const status = quote.customer_review_status;
    if (status === 'pending') {
      setShowResendConfirm(true);
    } else {
      setSendModalResend(true);
      setShowSendModal(true);
    }
  }

  function beginSaveAndGenerate() {
    if (!validateAction('download')) return;
    pendingAction.current = { type: 'download' };
    setShowSavePrompt(true);
  }

  async function executeSaveAndGenerate() {
    const actionType = pendingAction.current?.type || 'download';
    setShowSavePrompt(false);
    setGenerating(true);

    const saved = await saveConfigSilent();
    if (!saved) {
      onToast?.('Failed to save configuration before generating', 'error');
      setGenerating(false);
      pendingAction.current = null;
      return;
    }
    onToast?.('Configuration saved successfully', 'success');
    setGenerating(false);

    await runGeneration(actionType);
    pendingAction.current = null;
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

  const globalSummary = `${config.view_type === 'condensed' ? 'Condensed' : 'Full'} | ${config.orientation === 'portrait' ? 'Portrait' : 'Landscape'} | ${(config.page_size || 'letter').charAt(0).toUpperCase() + (config.page_size || 'letter').slice(1)} | ${config.language.toUpperCase()} | ${config.currency_mode === 'default' ? 'Default' : config.currency_mode} | ${config.units_mode === 'default' ? 'Default' : config.units_mode === 'miles' ? 'Miles' : 'KM'}`;
  const headerSummary = `Left: ${config.header_left.length} | Middle: ${config.header_middle.length} | Right: ${config.header_right.length}`;
  const bodySummary = config.view_type === 'condensed'
    ? `Condensed - ${config.condensed_columns.length} columns`
    : `Full View - ${['general', 'us', 'mx', 'additional'].filter(k => (config.full_view_sections as any)[k]?.some((f: any) => f.visible)).length} sections`;
  const footerSummary = `${config.footer_sections.filter(s => s.enabled).length} sections enabled`;

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
      <div className="flex items-center justify-between mb-4">
        <PdfTemplateBar
          templates={templates}
          onLoadTemplate={handleLoadTemplate}
          onSaveTemplate={handleSaveTemplate}
          onDeleteTemplate={handleDeleteTemplate}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>

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
                  onClick={() => { setShowDropdown(false); beginGenerate('download'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <FileDown className="w-4 h-4 text-gray-400" />
                  Download PDF
                </button>
                <button
                  onClick={() => { setShowDropdown(false); beginGenerate('open'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                  Open in New Tab
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={() => { setShowDropdown(false); beginGenerate('condensed'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Columns className="w-4 h-4 text-gray-400" />
                  Download - Condensed View
                </button>
                <button
                  onClick={() => { setShowDropdown(false); beginGenerate('full'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <LayoutList className="w-4 h-4 text-gray-400" />
                  Download - Full View
                </button>
              </div>
            )}
          </div>
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

      {showSavePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Save & Generate</h3>
            <p className="text-sm text-gray-500 mb-4">Save the current configuration and then generate the PDF.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowSavePrompt(false); pendingAction.current = null; }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeSaveAndGenerate}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save & Generate
              </button>
            </div>
          </div>
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
        <div className="w-1/3 space-y-3 flex-shrink-0 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar pr-1">
          <CollapsibleSection
            title="Global PDF Options"
            icon={<FileText className="w-4 h-4 text-blue-600" />}
            collapsed={collapsedSections.global}
            onToggle={() => toggleSection('global')}
            summary={globalSummary}
          >
            <PdfGlobalOptions
              viewType={config.view_type}
              orientation={config.orientation}
              pageSize={config.page_size}
              language={config.language}
              currencyMode={config.currency_mode}
              unitsMode={config.units_mode}
              fontFamily={config.font_family}
              fontSize={config.font_size}
              onChange={updateConfig}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Title Configuration"
            icon={<Crown className="w-4 h-4 text-blue-600" />}
            collapsed={collapsedSections.title}
            onToggle={() => toggleSection('title')}
            summary={config.title_config.firstPageOnly ? 'First page' : 'Every page'}
          >
            <PdfTitleConfig
              config={config.title_config}
              onChange={(tc) => updateConfig('title_config', tc)}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Banner Configuration"
            icon={<Flag className="w-4 h-4 text-blue-600" />}
            collapsed={collapsedSections.banner}
            onToggle={() => toggleSection('banner')}
            summary={config.banner_config.enabled ? `${config.banner_config.cells.filter(c => c.fieldKey).length} cells` : 'Hidden'}
          >
            <PdfBannerConfig
              config={config.banner_config}
              onChange={(bc) => updateConfig('banner_config', bc)}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Header Configuration"
            icon={<Layout className="w-4 h-4 text-blue-600" />}
            collapsed={collapsedSections.header}
            onToggle={() => toggleSection('header')}
            summary={headerSummary}
          >
            <PdfHeaderConfig
              headerLeft={config.header_left}
              headerMiddle={config.header_middle}
              headerRight={config.header_right}
              onUpdate={(column, fields) => updateConfig(column, fields)}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Body Configuration"
            icon={config.view_type === 'condensed' ? <Table className="w-4 h-4 text-blue-600" /> : <Layers className="w-4 h-4 text-blue-600" />}
            collapsed={collapsedSections.body}
            onToggle={() => toggleSection('body')}
            summary={bodySummary}
          >
            <PdfBodyConfig
              viewType={config.view_type}
              condensedColumns={config.condensed_columns}
              fullViewSections={config.full_view_sections}
              fullViewColors={config.full_view_colors}
              fullViewFontColors={config.full_view_font_colors}
              onCondensedColumnsChange={(cols) => updateConfig('condensed_columns', cols)}
              onFullViewSectionsChange={(sections) => updateConfig('full_view_sections', sections)}
              onFullViewColorsChange={(colors) => updateConfig('full_view_colors', colors)}
              onFullViewFontColorsChange={(fc) => updateConfig('full_view_font_colors', fc)}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Footer Configuration"
            icon={<FileText className="w-4 h-4 text-blue-600" />}
            collapsed={collapsedSections.footer}
            onToggle={() => toggleSection('footer')}
            summary={footerSummary}
          >
            <PdfFooterConfig
              quote={quote}
              lanes={lanes}
              footerSections={config.footer_sections}
              footerAccessorials={config.footer_accessorials}
              footerTerms={config.footer_terms}
              acceptance={config.footer_acceptance}
              attachedFiles={config.attached_files}
              onFooterSectionsChange={(sections) => updateConfig('footer_sections', sections)}
              onFooterAccessorialsChange={(toggles) => updateConfig('footer_accessorials', toggles)}
              onFooterTermsChange={(toggles) => updateConfig('footer_terms', toggles)}
              onAcceptanceChange={(acc) => updateConfig('footer_acceptance', acc)}
              onAttachedFilesChange={(files) => updateConfig('attached_files', files)}
            />
          </CollapsibleSection>
        </div>

        <div className="flex-1 min-w-0">
          <PdfLivePreview
            pdfDocument={pdfDocument}
            onReset={handleReset}
          />
        </div>
      </div>
    </div>
  );
}
