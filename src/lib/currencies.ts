import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { CURRENCIES, type CurrencyCode } from './constants';

/** Every currency the code can convert. Adding a new one requires code (exchange rate + conversion). */
export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = CURRENCIES;

/** Always active: base of every conversion. */
export const LOCKED_CURRENCIES: readonly CurrencyCode[] = ['USD', 'MXN'];

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  USD: 'US Dollar (USD)',
  MXN: 'Mexican Peso (MXN)',
  CAD: 'Canadian Dollar (CAD)',
};

/** Used until the database answers (and if it fails). */
const FALLBACK: CurrencyCode[] = ['USD', 'MXN'];

let cache: CurrencyCode[] | null = null;
let pending: Promise<void> | null = null;
const listeners = new Set<() => void>();

function isSupported(code: unknown): code is CurrencyCode {
  return typeof code === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

export async function loadActiveCurrencies(force = false): Promise<void> {
  if (cache && !force) return;
  if (pending && !force) return pending;
  pending = (async () => {
    const { data, error } = await supabase
      .from('global_variables')
      .select('active_currencies')
      .limit(1)
      .maybeSingle();
    if (!error && data && Array.isArray(data.active_currencies)) {
      const chosen = new Set<CurrencyCode>([...data.active_currencies.filter(isSupported), ...LOCKED_CURRENCIES]);
      cache = SUPPORTED_CURRENCIES.filter(c => chosen.has(c));
      listeners.forEach(l => l());
    }
    pending = null;
  })();
  return pending;
}

export function getActiveCurrencies(): CurrencyCode[] {
  return [...(cache ?? FALLBACK)];
}

export function isCurrencyActive(code: string | null | undefined): boolean {
  return isSupported(code) && getActiveCurrencies().includes(code);
}

/** Pass the record's current value so a record already in an inactive currency still shows it. */
export function currencyOptions(active: CurrencyCode[], currentValue?: string | null): CurrencyCode[] {
  if (isSupported(currentValue) && !active.includes(currentValue)) return [...active, currentValue];
  return active;
}

export function useActiveCurrencies(): CurrencyCode[] {
  const [, setVersion] = useState(0);
  useEffect(() => {
    const listener = () => setVersion(v => v + 1);
    listeners.add(listener);
    void loadActiveCurrencies();
    return () => { listeners.delete(listener); };
  }, []);
  return getActiveCurrencies();
}
