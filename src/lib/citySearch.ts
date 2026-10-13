/** "sa-tx", "SA TX", "sa, tx" → "SATX". Letters and digits only, uppercase. */
export function normalizeAbbreviation(term: string): string {
  return (term || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Extra condition for a PostgREST .or(...) string, or '' when the term is too short.
 * Usage: q.or(`city_full_name.ilike.%${term}%,...${abbreviationOrClause(term)}`)
 */
export function abbreviationOrClause(term: string): string {
  const compact = normalizeAbbreviation(term);
  return compact.length >= 2 ? `,city_abbreviation_compact.ilike.%${compact}%` : '';
}

type WithCompact = { city_abbreviation_compact?: string | null };

export function isExactAbbreviation(city: WithCompact, term: string): boolean {
  const compact = normalizeAbbreviation(term);
  return compact.length >= 2 && (city.city_abbreviation_compact || '') === compact;
}

/** Stable re-order: exact abbreviation matches first, the rest keep their current order. */
export function exactAbbreviationFirst<T extends WithCompact>(list: T[], term: string): T[] {
  const exact = list.filter(c => isExactAbbreviation(c, term));
  if (exact.length === 0) return list;
  return [...exact, ...list.filter(c => !isExactAbbreviation(c, term))];
}

/** The single exact match, or null when there are 0 or several. */
export function singleExactAbbreviation<T extends WithCompact>(list: T[], term: string): T | null {
  const exact = list.filter(c => isExactAbbreviation(c, term));
  return exact.length === 1 ? exact[0] : null;
}
