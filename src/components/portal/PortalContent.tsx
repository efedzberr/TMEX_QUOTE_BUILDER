import { useState, useEffect, useRef } from 'react';
import { Quote, QuoteLane } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { PdfConfig } from '../../lib/pdfConfigTypes';
import { CurrencyCode } from '../../lib/constants';
import { buildLaneAcceptanceGroups } from '../../lib/customerPortalHelpers';
import { PortalQuoteHeader } from './PortalQuoteHeader';
import { PortalLaneCard, GroupResponse } from './PortalLaneCard';
import { PortalFooterSections, TermCondition, Accessorial } from './PortalFooterSections';
import { PortalSummaryBar } from './PortalSummaryBar';
import { PortalSignatureSection } from './PortalSignatureSection';
import { PortalConfirmation } from './PortalConfirmation';
import type { PdfLanguage } from '../../lib/pdfConfigTypes';
import type { OverallStatus, SubmissionResult } from '../../lib/portalSubmission';

interface PortalContentProps {
  quote: Quote;
  lanes: QuoteLane[];
  isPreview: boolean;
}

interface SubmittedState {
  overallStatus: OverallStatus;
  customerName: string;
}

export function PortalContent({ quote, lanes, isPreview }: PortalContentProps) {
  const [pdfConfig, setPdfConfig] = useState<PdfConfig | null>(null);
  const [termsConditions, setTermsConditions] = useState<TermCondition[]>([]);
  const [accessorials, setAccessorials] = useState<Accessorial[]>([]);
  const [responses, setResponses] = useState<Record<string, GroupResponse>>({});
  const [submissionResult, setSubmissionResult] = useState<SubmittedState | null>(null);
  const signatureRef = useRef<HTMLDivElement>(null);

  const groups = buildLaneAcceptanceGroups(lanes);
  const lang: PdfLanguage = pdfConfig?.language || 'en';
  const isEs = lang === 'es';
  const currencyCode = (quote.currency || 'USD') as CurrencyCode;

  useEffect(() => {
    loadPortalData();
  }, [quote.id]);

  useEffect(() => {
    const initial: Record<string, GroupResponse> = {};
    groups.forEach(g => {
      initial[g.group_id] = { status: null, comment: '' };
    });
    setResponses(initial);
  }, [lanes.length]);

  async function loadPortalData() {
    const { data: configData } = await supabase
      .from('pdf_configurations')
      .select('*')
      .eq('quote_id', quote.id)
      .maybeSingle();

    setPdfConfig(configData as PdfConfig | null);

    const { data: tcData } = await supabase
      .from('terms_conditions')
      .select('id, name, name_es, description, description_es')
      .order('name');

    setTermsConditions((tcData || []) as TermCondition[]);

    const { data: accData } = await supabase
      .from('accessorials')
      .select('id, name, name_es, unit_type, rate, equipment_types')
      .order('name');

    setAccessorials((accData || []) as Accessorial[]);
  }

  function handleResponseChange(groupId: string, response: GroupResponse) {
    setResponses(prev => ({ ...prev, [groupId]: response }));
  }

  function handleContinueToSign() {
    if (signatureRef.current) {
      signatureRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function handleSubmitted(result: SubmissionResult) {
    setSubmissionResult({
      overallStatus: result.overallStatus,
      customerName: result.customerName,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (submissionResult) {
    return (
      <PortalConfirmation
        quote={quote}
        groups={groups}
        responses={responses}
        overallStatus={submissionResult.overallStatus}
        language={lang}
        currencyCode={currencyCode}
        customerName={submissionResult.customerName}
      />
    );
  }

  return (
    <div className={!isPreview ? 'pb-24' : ''}>
      <div className="space-y-6">
        <PortalQuoteHeader quote={quote} pdfConfig={pdfConfig} />

        <div>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-bold text-gray-900">
              {isEs ? 'Carriles de Cotizacion' : 'Quote Lanes'}
            </h2>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-600 rounded-full border border-gray-200">
              {groups.length}
            </span>
          </div>

          {groups.length > 0 && !isPreview && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 mb-4">
              <p className="text-xs text-blue-700">
                {isEs
                  ? 'Por favor revise cada carril e indique su respuesta a continuacion.'
                  : 'Please review each lane and indicate your response below.'}
              </p>
            </div>
          )}

          {groups.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <p className="text-sm text-gray-400">
                {isEs
                  ? 'No hay carriles disponibles para revision en esta cotizacion.'
                  : 'No lanes are available for review on this quote.'}
              </p>
            </div>
          )}

          {groups.map(group => (
            <PortalLaneCard
              key={group.group_id}
              group={group}
              lanes={lanes}
              response={responses[group.group_id] || { status: null, comment: '' }}
              onResponseChange={(r) => handleResponseChange(group.group_id, r)}
              isPreview={isPreview}
              language={lang}
              currencyCode={currencyCode}
            />
          ))}
        </div>

        <PortalFooterSections
          quote={quote}
          lanes={lanes}
          pdfConfig={pdfConfig}
          termsConditions={termsConditions}
          accessorials={accessorials}
        />

        <div ref={signatureRef}>
          <PortalSignatureSection
            quote={quote}
            lanes={lanes}
            groups={groups}
            responses={responses}
            language={lang}
            currencyCode={currencyCode}
            isPreview={isPreview}
            onSubmitted={handleSubmitted}
          />
        </div>
      </div>

      {!isPreview && groups.length > 0 && !submissionResult && (
        <PortalSummaryBar
          groups={groups}
          responses={responses}
          language={lang}
          onContinue={handleContinueToSign}
        />
      )}
    </div>
  );
}
