import { supabase } from './supabase';

export interface QuoteIdentifiers {
  quoteNumber: string;
  quoteNameSequence: number | null;
}

/**
 * Allocates the next quote_number (TMQ-XXXXXXXX) and, optionally, the next
 * quote_name_sequence via the SECURITY DEFINER RPC `allocate_quote_identifiers`.
 * Runs server-side so it is not affected by sharing RLS and is safe under concurrency.
 */
export async function allocateQuoteIdentifiers(withNameSequence = true): Promise<QuoteIdentifiers> {
  const { data, error } = await supabase.rpc('allocate_quote_identifiers', {
    p_with_name_sequence: withNameSequence,
  });
  if (error) throw error;
  const result = (data || {}) as { quote_number?: string; quote_name_sequence?: number | null };
  if (!result.quote_number) throw new Error('Could not allocate quote number');
  return {
    quoteNumber: result.quote_number,
    quoteNameSequence: result.quote_name_sequence ?? null,
  };
}
