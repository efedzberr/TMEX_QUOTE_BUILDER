import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Quote, QuoteLane } from '../../lib/supabase';
import { PdfConfig, FooterSectionConfig, DEFAULT_FOOTER_SECTIONS } from '../../lib/pdfConfigTypes';
import { formatCurrency, CurrencyCode } from '../../lib/constants';
import { buildLaneAcceptanceGroups } from '../../lib/customerPortalHelpers';
import type { PdfLanguage } from '../../lib/pdfConfigTypes';

interface PortalFooterSectionsProps {
  quote: Quote;
  lanes: QuoteLane[];
  pdfConfig: PdfConfig | null;
  termsConditions: TermCondition[];
  accessorials: Accessorial[];
}

export interface TermCondition {
  id: string;
  name: string;
  name_es?: string;
  description?: string;
  description_es?: string;
}

export interface Accessorial {
  id: string;
  name: string;
  name_es?: string;
  unit_type?: string;
  rate?: number;
  equipment_types?: string[];
}

export function PortalFooterSections({ quote, lanes, pdfConfig, termsConditions }: PortalFooterSectionsProps) {
  const lang: PdfLanguage = pdfConfig?.language || 'en';
  const isEs = lang === 'es';
  const currencyCode = (quote.currency || 'USD') as CurrencyCode;

  const footerSections: FooterSectionConfig[] = pdfConfig?.footer_sections || DEFAULT_FOOTER_SECTIONS;
  const enabledSections = footerSections.filter(s => s.enabled);

  const selectedTermIds = quote.terms_conditions_list || [];
  const selectedTerms = Array.isArray(selectedTermIds)
    ? termsConditions.filter(tc => selectedTermIds.includes(tc.id))
    : [];

  const quoteAccessorials = Array.isArray(quote.accessorials_list) ? quote.accessorials_list : [];

  const hasQuoteAccessorials = quoteAccessorials.length > 0;
  const hasLaneAccessorials = lanes.some(l =>
    (Array.isArray(l.accessorials_list) && l.accessorials_list.length > 0) ||
    (Array.isArray(l.us_accessorials_list) && l.us_accessorials_list.length > 0) ||
    (Array.isArray(l.mx_accessorials_list) && l.mx_accessorials_list.length > 0)
  );
  const hasAnyAccessorials = hasQuoteAccessorials || hasLaneAccessorials;

  return (
    <div className="space-y-3">
      {enabledSections.map(section => {
        switch (section.key) {
          case 'accessorials':
            if (!hasAnyAccessorials) return null;
            return (
              <CollapsibleSection
                key={section.id}
                title={isEs ? 'Accesorios' : 'Accessorials'}
              >
                <AccessorialsContent
                  lanes={lanes}
                  quoteAccessorials={quoteAccessorials}
                  currencyCode={currencyCode}
                  language={lang}
                />
              </CollapsibleSection>
            );

          case 'terms':
            if (selectedTerms.length === 0) return null;
            return (
              <CollapsibleSection
                key={section.id}
                title={isEs ? 'Terminos y Condiciones' : 'Terms & Conditions'}
              >
                <TermsContent terms={selectedTerms} language={lang} />
              </CollapsibleSection>
            );

          case 'legends':
            return (
              <CollapsibleSection
                key={section.id}
                title={isEs ? 'Leyendas' : 'Legends'}
              >
                <BulletList items={getLegendItems(isEs)} />
              </CollapsibleSection>
            );

          case 'disclaimers':
            return (
              <CollapsibleSection
                key={section.id}
                title={isEs ? 'Descargos de Responsabilidad' : 'Disclaimers'}
                titleColor="text-red-700"
              >
                <BulletList items={getDisclaimerItems(isEs)} />
              </CollapsibleSection>
            );

          case 'notes':
            return (
              <CollapsibleSection
                key={section.id}
                title={isEs ? 'Notas' : 'Notes'}
                titleColor="text-blue-800"
              >
                <BulletList items={getNoteItems(isEs)} />
              </CollapsibleSection>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

function CollapsibleSection({
  title,
  titleColor,
  children,
}: {
  title: string;
  titleColor?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className={`text-sm font-bold ${titleColor || 'text-gray-800'}`}>{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-4 border-t border-gray-100 pt-3">{children}</div>}
    </div>
  );
}

function AccessorialsContent({
  lanes,
  quoteAccessorials,
  currencyCode,
  language,
}: {
  lanes: QuoteLane[];
  quoteAccessorials: any[];
  currencyCode: CurrencyCode;
  language: PdfLanguage;
}) {
  const isEs = language === 'es';
  const groups = buildLaneAcceptanceGroups(lanes);

  return (
    <div className="space-y-4">
      {quoteAccessorials.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
            {isEs ? 'Accesorios Generales' : 'General Accessorials'}
          </div>
          <div className="space-y-1.5">
            {quoteAccessorials.map((acc: any, i: number) => {
              const name = (isEs && acc.name_es) ? acc.name_es : (acc.name || acc.accessorial_name || '');
              return (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800">{name}</span>
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-blue-50 text-blue-600 rounded">
                      {acc.unit_type || acc.unit || 'FLAT'}
                    </span>
                  </div>
                  <span className="text-gray-600">{formatCurrency(acc.rate || acc.amount || 0, currencyCode)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {groups.map(group => {
        const groupLanes = lanes.filter(l => group.lane_ids.includes(l.id));
        const laneAccs: { name: string; section: string; rate: number; unit: string }[] = [];

        for (const lane of groupLanes) {
          const lists = [
            { items: lane.accessorials_list, section: '' },
            { items: lane.us_accessorials_list, section: 'US' },
            { items: lane.mx_accessorials_list, section: 'MX' },
          ];
          for (const { items, section } of lists) {
            if (Array.isArray(items)) {
              for (const acc of items) {
                if (acc && typeof acc === 'object') {
                  const name = (isEs && acc.name_es) ? acc.name_es : (acc.name || acc.accessorial_name || '');
                  laneAccs.push({
                    name,
                    section,
                    rate: acc.rate || acc.amount || 0,
                    unit: acc.unit_type || acc.unit || 'FLAT',
                  });
                }
              }
            }
          }
        }

        if (laneAccs.length === 0) return null;

        return (
          <div key={group.group_id}>
            <div className="bg-blue-50 rounded-md px-3 py-1.5 mb-2">
              <span className="text-[10px] text-blue-700 font-semibold">
                {group.label} — {group.origin} &rarr; {group.destination}
              </span>
            </div>
            <div className="space-y-1.5 pl-2">
              {laneAccs.map((acc, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800">{acc.name}</span>
                    {acc.section && (
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-gray-100 text-gray-500 rounded">{acc.section}</span>
                    )}
                    <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-blue-50 text-blue-600 rounded">{acc.unit}</span>
                  </div>
                  <span className="text-gray-600">{formatCurrency(acc.rate, currencyCode)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TermsContent({ terms, language }: { terms: TermCondition[]; language: PdfLanguage }) {
  const isEs = language === 'es';

  return (
    <div className="space-y-3">
      {terms.map((term, i) => (
        <div key={term.id}>
          <div className="text-xs font-bold text-gray-800 mb-0.5">
            {(isEs && term.name_es) ? term.name_es : term.name}
          </div>
          {(term.description || term.description_es) && (
            <div className="text-xs text-gray-600 leading-relaxed">
              {(isEs && term.description_es) ? term.description_es : term.description}
            </div>
          )}
          {i < terms.length - 1 && <hr className="mt-3 border-gray-100" />}
        </div>
      ))}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-xs text-gray-600 leading-relaxed flex gap-2">
          <span className="text-gray-400 flex-shrink-0">&#8226;</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function getLegendItems(isEs: boolean): string[] {
  if (isEs) {
    return [
      'Todas las tarifas estan en la moneda indicada en esta cotizacion.',
      'Las tarifas son validas por el periodo indicado a menos que se indique lo contrario.',
      'Los recargos por combustible estan sujetos a cambios semanales.',
    ];
  }
  return [
    'All rates are quoted in the currency indicated on this quote.',
    'Rates are valid for the period indicated unless otherwise noted.',
    'Fuel surcharges are subject to weekly adjustment.',
  ];
}

function getDisclaimerItems(isEs: boolean): string[] {
  if (isEs) {
    return [
      'Esta cotizacion no constituye un contrato vinculante hasta que ambas partes la firmen.',
      'TransMex se reserva el derecho de ajustar las tarifas con previo aviso de 30 dias.',
      'Los servicios adicionales no incluidos en esta cotizacion se facturaran por separado.',
    ];
  }
  return [
    'This quotation does not constitute a binding contract until signed by both parties.',
    'TransMex reserves the right to adjust rates with 30 days prior notice.',
    'Additional services not included in this quotation will be billed separately.',
  ];
}

function getNoteItems(isEs: boolean): string[] {
  if (isEs) {
    return [
      'Los tiempos de transito son estimados y pueden variar segun las condiciones.',
      'Por favor contacte a su representante de TransMex para cualquier pregunta.',
    ];
  }
  return [
    'Transit times are estimated and may vary depending on conditions.',
    'Please contact your TransMex representative with any questions.',
  ];
}
