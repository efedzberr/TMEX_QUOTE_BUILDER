import { supabase } from './supabase';
import type { PdfConfig } from './pdfConfigTypes';

export type StandardFormat = Pick<PdfConfig, 'title_config' | 'banner_config' | 'header_left' | 'header_middle' | 'header_right'>;

const FORMAT_KEYS: (keyof StandardFormat)[] = ['title_config', 'banner_config', 'header_left', 'header_middle', 'header_right'];

export async function loadStandardFormat(): Promise<Partial<StandardFormat>> {
  const { data, error } = await supabase
    .from('pdf_standard_format')
    .select('config_data')
    .eq('singleton', true)
    .maybeSingle();
  if (error || !data || typeof data.config_data !== 'object' || data.config_data === null) return {};
  return data.config_data as Partial<StandardFormat>;
}

export async function saveStandardFormat(format: StandardFormat): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('pdf_standard_format')
    .upsert(
      { singleton: true, config_data: format, updated_at: new Date().toISOString(), updated_by: userData.user?.id ?? null },
      { onConflict: 'singleton' },
    );
  return error ? error.message : null;
}

export function applyStandardFormat(config: PdfConfig, format: Partial<StandardFormat>): PdfConfig {
  const next = { ...config };
  for (const key of FORMAT_KEYS) {
    if (format[key] !== undefined) (next as Record<string, unknown>)[key] = format[key];
  }
  return next;
}
