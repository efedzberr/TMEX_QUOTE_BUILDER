import { useMemo } from 'react';
import { formatCurrencyOrDash, CurrencyCode } from '../lib/constants';

interface ReadOnlyCellProps {
  value: number | null | undefined;
  isCurrency?: boolean;
  precision?: number;
  className?: string;
  currencyCode?: CurrencyCode;
}

export function ReadOnlyCell({ value, isCurrency = false, precision = 2, className = '', currencyCode = 'USD' }: ReadOnlyCellProps) {
  const displayValue = useMemo(() => {
    if (value === null || value === undefined || isNaN(value) || value === 0) {
      return '—';
    }
    if (isCurrency) {
      return formatCurrencyOrDash(value, currencyCode);
    }
    return parseFloat(value.toString()).toFixed(precision);
  }, [value, isCurrency, precision, currencyCode]);

  return (
    <div className={`px-2 py-2 text-sm text-gray-900 bg-gray-100 rounded border-0 ${className}`}>
      {displayValue}
    </div>
  );
}
