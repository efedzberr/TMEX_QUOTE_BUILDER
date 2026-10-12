import { supabase } from './supabase';
import type { PdfConfig, PdfLanguage, CurrencyMode, UnitsMode, AttachedFile, FooterSectionConfig } from './pdfConfigTypes';
import { buildDefaultConfig, buildDefaultTitleConfig, buildDefaultBannerConfig, DEFAULT_ACCEPTANCE } from './pdfConfigTypes';

/** The parts of the PDF the administrator can change (content only). */
export interface StandardPdfFormat {
  title_config: PdfConfig['title_config'];
  header_left: PdfConfig['header_left'];
  header_middle: PdfConfig['header_middle'];
  header_right: PdfConfig['header_right'];
  banner_config: PdfConfig['banner_config'];
  footer_sections: PdfConfig['footer_sections'];
  footer_acceptance: PdfConfig['footer_acceptance'];
}

/** Footer sections whose on/off is decided by the user in each quote (not by the admin). */
export const USER_CONTROLLED_FOOTER_KEYS = ['accessorials', 'terms', 'attachments'] as const;

/** What the user chooses in each quote (Prompt 2). */
export interface QuotePdfChoices {
  language: PdfLanguage;
  currency: CurrencyMode;
  units: UnitsMode;
  includeTerms: boolean;
  includeAccessorials: boolean;
  attachedFiles: AttachedFile[];
}

export const DEFAULT_QUOTE_PDF_CHOICES: QuotePdfChoices = {
  language: 'en',
  currency: 'default',
  units: 'default',
  includeTerms: true,
  includeAccessorials: true,
  attachedFiles: [],
};

export function buildDefaultStandardFormat(): StandardPdfFormat {
  const d = buildDefaultConfig('');
  return {
    title_config: d.title_config,
    header_left: d.header_left,
    header_middle: d.header_middle,
    header_right: d.header_right,
    banner_config: d.banner_config,
    footer_sections: d.footer_sections,
    footer_acceptance: d.footer_acceptance,
  };
}

export function normalizeStandardFormat(raw: Partial<StandardPdfFormat> | null | undefined): StandardPdfFormat {
  const format = buildDefaultStandardFormat();
  if (!raw || typeof raw !== 'object') return format;
  if (raw.title_config) format.title_config = raw.title_config;
  if (raw.header_left) format.header_left = raw.header_left;
  if (raw.header_middle) format.header_middle = raw.header_middle;
  if (raw.header_right) format.header_right = raw.header_right;
  if (raw.banner_config) format.banner_config = raw.banner_config;
  if (raw.footer_acceptance) format.footer_acceptance = raw.footer_acceptance;
  if (Array.isArray(raw.footer_sections)) {
    const stored = raw.footer_sections;
    const missing = format.footer_sections.filter(d => !stored.some(s => s.key === d.key));
    format.footer_sections = [...stored, ...missing];
  }
  return format;
}

export async function loadStandardFormat(): Promise<StandardPdfFormat> {
  const { data, error } = await supabase.from('pdf_standard_format').select('config_data').limit(1).maybeSingle();
  if (error) return buildDefaultStandardFormat();
  return normalizeStandardFormat(data?.config_data as Partial<StandardPdfFormat> | undefined);
}

export async function saveStandardFormat(format: StandardPdfFormat): Promise<boolean> {
  const defTitle = buildDefaultTitleConfig();
  const defBanner = buildDefaultBannerConfig();
  const config_data: StandardPdfFormat = {
    title_config: {
      left: format.title_config.left,
      center: format.title_config.center,
      right: format.title_config.right,
      bgColor: defTitle.bgColor,
      borderEnabled: defTitle.borderEnabled,
      borderColor: defTitle.borderColor,
      heightMode: defTitle.heightMode,
      heightPt: defTitle.heightPt,
      firstPageOnly: defTitle.firstPageOnly,
    },
    header_left: format.header_left,
    header_middle: format.header_middle,
    header_right: format.header_right,
    banner_config: {
      enabled: format.banner_config.enabled,
      cells: format.banner_config.cells,
      bgColor: defBanner.bgColor,
      textColor: defBanner.textColor,
      borderEnabled: defBanner.borderEnabled,
      borderColor: defBanner.borderColor,
      heightPt: defBanner.heightPt,
    },
    footer_sections: format.footer_sections.map(s => ({
      id: s.id, key: s.key, label: s.label, enabled: s.enabled, newPage: s.newPage,
    })),
    footer_acceptance: {
      label: format.footer_acceptance.label,
      fields: format.footer_acceptance.fields,
      headerColor: DEFAULT_ACCEPTANCE.headerColor,
    },
  };
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('pdf_standard_format')
    .update({ config_data, updated_at: new Date().toISOString(), updated_by: userData.user?.id ?? null })
    .eq('singleton', true);
  return !error;
}

export function buildQuotePdfConfig(quoteId: string, format: StandardPdfFormat, choices: QuotePdfChoices, existingId?: string): PdfConfig {
  const base = buildDefaultConfig(quoteId);
  const footer_sections: FooterSectionConfig[] = format.footer_sections.map(s => {
    if (s.key === 'terms') return { ...s, enabled: choices.includeTerms };
    if (s.key === 'accessorials') return { ...s, enabled: choices.includeAccessorials };
    if (s.key === 'attachments') return { ...s, enabled: choices.attachedFiles.length > 0 };
    return { ...s };
  });
  return {
    ...base,
    id: existingId,
    view_type: 'condensed',
    language: choices.language,
    currency_mode: choices.currency,
    units_mode: choices.units,
    title_config: { ...buildDefaultTitleConfig(), left: format.title_config.left, center: format.title_config.center, right: format.title_config.right },
    header_left: format.header_left,
    header_middle: format.header_middle,
    header_right: format.header_right,
    banner_config: { ...buildDefaultBannerConfig(), enabled: format.banner_config.enabled, cells: format.banner_config.cells },
    footer_sections,
    footer_accessorials: { quoteLevel: {}, laneLevel: {} },
    footer_terms: {},
    footer_acceptance: { ...format.footer_acceptance, headerColor: DEFAULT_ACCEPTANCE.headerColor },
    attached_files: choices.attachedFiles,
  };
}
