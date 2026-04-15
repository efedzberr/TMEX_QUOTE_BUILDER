import { Quote } from '../../lib/supabase';
import { PdfConfig, HEADER_FIELD_OPTIONS } from '../../lib/pdfConfigTypes';
import { translateLabel } from '../../lib/pdfTranslations';
import { formatCurrency, CurrencyCode } from '../../lib/constants';
import type { PdfLanguage } from '../../lib/pdfConfigTypes';

interface PortalQuoteHeaderProps {
  quote: Quote;
  pdfConfig: PdfConfig | null;
}

function resolveFieldValue(key: string, quote: Quote): string {
  switch (key) {
    case 'shipper_code': return quote.shipper || '';
    case 'currency': return quote.currency || 'USD';
    case 'equipment_type': return quote.type_of_service || '';
    case 'customer': return quote.partner_account || '';
    case 'date': return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    case 'contact_name': return quote.owner_name || '';
    case 'contact_email': return '';
    case 'gm_usa': return quote.us_sales_rep || '';
    case 'mx_sales_rep': return quote.mx_sales_rep || '';
    case 'us_sales_rep': return quote.us_sales_rep || '';
    case 'quote_number': return quote.generated_quote_name || quote.quote_number || '';
    case 'quote_name': return quote.generated_quote_name || '';
    case 'opportunity': return quote.opportunity || '';
    case 'bco_partner': return quote.bco_partner || '';
    case 'bill_to': return quote.bill_to_customer || '';
    case 'shipper': return quote.shipper || '';
    case 'effective_date': return quote.created_at ? new Date(quote.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    case 'expiration_date': return '';
    case 'exchange_rate': return quote.exchange_rate ? `${quote.exchange_rate.toFixed(4)}` : '';
    case 'us_fuel_rate': return quote.today_fuel_rate ? formatCurrency(quote.today_fuel_rate, (quote.currency || 'USD') as CurrencyCode) : '';
    case 'mx_fuel_rate': return '';
    case 'us_fuel_difference': return '';
    case 'units': return quote.units || 'Miles';
    default: return '';
  }
}

function getFieldLabel(key: string, lang: PdfLanguage): string {
  const opt = HEADER_FIELD_OPTIONS.find(o => o.key === key);
  if (!opt) return key;
  return lang === 'es' ? opt.labelEs : opt.label;
}

export function PortalQuoteHeader({ quote, pdfConfig }: PortalQuoteHeaderProps) {
  const lang: PdfLanguage = pdfConfig?.language || 'en';

  const leftFields = pdfConfig?.header_left || [
    { id: '1', key: 'shipper_code', label: 'Shipper Code' },
    { id: '2', key: 'currency', label: 'Currency' },
    { id: '3', key: 'equipment_type', label: 'Equipment Type' },
  ];

  const middleFields = pdfConfig?.header_middle || [
    { id: '4', key: 'customer', label: 'Customer' },
    { id: '5', key: 'date', label: 'Date' },
    { id: '6', key: 'contact_name', label: 'Contact' },
    { id: '7', key: 'contact_email', label: 'Contact Email' },
  ];

  const rightFields = pdfConfig?.header_right || [
    { id: '8', key: 'gm_usa', label: 'GM USA' },
    { id: '9', key: 'mx_sales_rep', label: 'Salesman' },
  ];

  const bannerConfig = pdfConfig?.banner_config;
  const bannerEnabled = bannerConfig?.enabled !== false;

  const createdDate = quote.created_at
    ? new Date(quote.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b-2 border-blue-800">
        <img src="/Transmex_Logo.jpeg" alt="TransMex" className="h-10 object-contain" />
        <div className="text-center flex-1 px-4">
          <div className="text-lg font-bold text-gray-900">{quote.partner_account || 'Customer'}</div>
          <div className="text-xs text-gray-500">{createdDate}</div>
        </div>
        <img src="/Transmex_Logo_II.jpeg" alt="TransMex" className="h-8 object-contain" />
      </div>

      <div className="grid grid-cols-3 gap-6 px-6 py-4 border-b border-gray-100">
        <div className="space-y-2.5">
          {leftFields.map(f => {
            const val = resolveFieldValue(f.key, quote);
            if (!val) return null;
            return (
              <FieldRow key={f.id} label={getFieldLabel(f.key, lang)} value={val} />
            );
          })}
        </div>
        <div className="space-y-2.5">
          {middleFields.map(f => {
            const val = resolveFieldValue(f.key, quote);
            if (!val) return null;
            return (
              <FieldRow key={f.id} label={getFieldLabel(f.key, lang)} value={val} />
            );
          })}
        </div>
        <div className="space-y-2.5">
          {rightFields.map(f => {
            const val = resolveFieldValue(f.key, quote);
            if (!val) return null;
            return (
              <FieldRow key={f.id} label={getFieldLabel(f.key, lang)} value={val} />
            );
          })}
        </div>
      </div>

      {bannerEnabled && (
        <div className="px-6 py-2 bg-gray-100 border-b border-gray-200 flex items-center gap-4 flex-wrap">
          {(bannerConfig?.cells || []).filter(c => c.fieldKey).map((cell, i) => {
            const val = resolveFieldValue(cell.fieldKey, quote);
            if (!val) return null;
            return (
              <span key={i} className="text-xs text-gray-600">
                {cell.showLabel && cell.label && <span className="font-semibold">{translateLabel(cell.label, lang)} </span>}
                {val}
              </span>
            );
          })}
          {!bannerConfig?.cells?.length && (
            <>
              <span className="text-xs text-gray-600">
                <span className="font-semibold">{translateLabel('Equipment Type', lang)}:</span> {quote.type_of_service}
              </span>
              {quote.today_fuel_rate ? (
                <span className="text-xs text-gray-600">
                  <span className="font-semibold">{translateLabel('US Fuel Rate', lang)}:</span> {formatCurrency(quote.today_fuel_rate, (quote.currency || 'USD') as CurrencyCode)}
                </span>
              ) : null}
              <span className="text-xs text-gray-600">
                <span className="font-semibold">{translateLabel('Currency', lang)}:</span> {quote.currency || 'USD'}
              </span>
            </>
          )}
        </div>
      )}

      <div className="px-6 py-3 flex items-center gap-6 flex-wrap text-xs">
        <div>
          <span className="text-gray-400 font-semibold uppercase tracking-wider">{translateLabel('Quote Number', lang)}: </span>
          <span className="text-gray-800 font-medium">{quote.generated_quote_name || quote.quote_number}</span>
        </div>
        <div>
          <span className="text-gray-400 font-semibold uppercase tracking-wider">{translateLabel('Effective Date', lang)}: </span>
          <span className="text-gray-800 font-medium">{createdDate}</span>
        </div>
        {quote.token_expires_at && (
          <div>
            <span className="text-gray-400 font-semibold uppercase tracking-wider">{translateLabel('Expiration Date', lang)}: </span>
            <span className="text-gray-800 font-medium">
              {new Date(quote.token_expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{label}</div>
      <div className="text-xs text-gray-800">{value}</div>
    </div>
  );
}
