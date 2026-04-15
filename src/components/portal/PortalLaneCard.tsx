import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X, RotateCcw } from 'lucide-react';
import { QuoteLane } from '../../lib/supabase';
import { LaneAcceptanceGroup } from '../../lib/customerPortalHelpers';
import { formatCurrency, CurrencyCode } from '../../lib/constants';
import { translateLabel } from '../../lib/pdfTranslations';
import type { PdfLanguage } from '../../lib/pdfConfigTypes';

export type GroupResponse = {
  status: 'accepted' | 'rejected' | 'negotiate' | null;
  comment: string;
};

interface PortalLaneCardProps {
  group: LaneAcceptanceGroup;
  lanes: QuoteLane[];
  response: GroupResponse;
  onResponseChange: (response: GroupResponse) => void;
  isPreview: boolean;
  language: PdfLanguage;
  currencyCode: CurrencyCode;
}

export function PortalLaneCard({
  group,
  lanes,
  response,
  onResponseChange,
  isPreview,
  language,
  currencyCode,
}: PortalLaneCardProps) {
  const [expanded, setExpanded] = useState(false);

  const groupLanes = lanes.filter(l => group.lane_ids.includes(l.id));
  const sorted = [...groupLanes].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const borderColor = response.status === 'accepted' ? 'border-l-green-500'
    : response.status === 'rejected' ? 'border-l-red-500'
    : response.status === 'negotiate' ? 'border-l-blue-500'
    : 'border-l-gray-200';

  const t = (label: string) => translateLabel(label, language);
  const isEs = language === 'es';

  const laneTotal = group.lane_total;

  return (
    <div className={`bg-white rounded-lg border border-gray-200 border-l-4 ${borderColor} transition-colors duration-200 mb-3`}>
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0 mr-4">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-bold text-gray-900">{group.label}</span>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-200">
              {group.service_type}
            </span>
            {group.trip_type !== 'One Way' && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                {group.trip_type}
              </span>
            )}
            {group.is_split && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                Split Billing
              </span>
            )}
          </div>
          <div className="text-base font-semibold text-gray-800">
            {group.origin} <span className="text-gray-400 mx-1">&rarr;</span> {group.destination}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
              {t('Lane Total')}
            </div>
            <div className="text-lg font-bold text-gray-900">
              {formatCurrency(laneTotal, currencyCode)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sorted[0]?.equipment_type && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-gray-100 text-gray-500 rounded-full hidden sm:inline-block">
                {sorted[0].equipment_type}
              </span>
            )}
            <button
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-gray-400"
              onClick={e => { e.stopPropagation(); setExpanded(!expanded); }}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: expanded ? '2000px' : '0px', opacity: expanded ? 1 : 0 }}
      >
        <div className="px-5 pb-4 border-t border-gray-100 pt-4">
          <LaneTable lanes={sorted} currencyCode={currencyCode} language={language} />

          <LaneTotalBreakdown lanes={sorted} currencyCode={currencyCode} laneTotal={laneTotal} language={language} />

          <LaneAdditionalInfo lanes={sorted} language={language} />

          <LaneAccessorials lanes={sorted} currencyCode={currencyCode} language={language} />

          <LaneComments lanes={sorted} language={language} />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-gray-100">
        {isPreview ? (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-400">
              {isEs ? 'Los controles de respuesta del cliente aparecen aqui en el portal en vivo' : 'Customer response controls appear here in the live portal'}
            </p>
          </div>
        ) : (
          <ResponseControls
            response={response}
            onResponseChange={onResponseChange}
            language={language}
          />
        )}
      </div>
    </div>
  );
}

function LaneTable({ lanes, currencyCode, language }: { lanes: QuoteLane[]; currencyCode: CurrencyCode; language: PdfLanguage }) {
  const t = (label: string) => translateLabel(label, language);

  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">#</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('Origin City')}</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('Destination City')}</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('Border Crossing City')}</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('Border Crossing Fee')}</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('Lane Total')}</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('Equipment Type')}</th>
          </tr>
        </thead>
        <tbody>
          {lanes.map((lane, idx) => {
            const total = (lane.us_rate || 0) + (lane.mx_rate || 0) + (lane.border_crossing_fee || 0) + (lane.toll_rate || 0) + (lane.accessorials_amount || 0);
            return (
              <tr key={lane.id} className="border-b border-gray-100 last:border-b-0">
                <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                <td className="px-3 py-2 text-gray-800 font-medium">
                  {lane.origin_city}
                  {lane.stops_before && lane.stops_before.length > 0 && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {translateLabel('Stops Before Crossing', language)}: {lane.stops_before.join(', ')}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-800 font-medium">
                  {lane.destination_city}
                  {lane.stops_after && lane.stops_after.length > 0 && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {translateLabel('Stops After Crossing', language)}: {lane.stops_after.join(', ')}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-700">{lane.border_crossing || '—'}</td>
                <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(lane.border_crossing_fee, currencyCode)}</td>
                <td className="px-3 py-2 text-right font-bold text-gray-900">{formatCurrency(total, currencyCode)}</td>
                <td className="px-3 py-2 text-gray-600">{lane.equipment_type || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LaneTotalBreakdown({ lanes, currencyCode, laneTotal, language }: { lanes: QuoteLane[]; currencyCode: CurrencyCode; laneTotal: number; language: PdfLanguage }) {
  const bcFee = lanes.reduce((sum, l) => sum + (l.border_crossing_fee || 0), 0);
  const accTotal = lanes.reduce((sum, l) => sum + (l.accessorials_amount || 0), 0);
  const t = (label: string) => translateLabel(label, language);

  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-4 inline-block min-w-[240px]">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{t('Border Crossing Fee')}:</span>
        <span className="ml-6 font-medium">{formatCurrency(bcFee, currencyCode)}</span>
      </div>
      {accTotal > 0 && (
        <div className="flex justify-between text-xs text-gray-600 mb-1">
          <span>{t('Accessorials')}:</span>
          <span className="ml-6 font-medium">{formatCurrency(accTotal, currencyCode)}</span>
        </div>
      )}
      <div className="flex justify-between text-xs text-gray-900 font-bold pt-1 border-t border-gray-200 mt-1">
        <span>{language === 'es' ? 'Total' : 'Total'}:</span>
        <span className="ml-6">{formatCurrency(laneTotal, currencyCode)}</span>
      </div>
    </div>
  );
}

function LaneAdditionalInfo({ lanes, language }: { lanes: QuoteLane[]; language: PdfLanguage }) {
  const first = lanes[0];
  if (!first) return null;

  const t = (label: string) => translateLabel(label, language);

  const fields = [
    { label: t('Lane Type'), value: first.lane_type },
    { label: t('Load Frequency'), value: first.load_frequency },
    { label: t('Commitment Type'), value: first.commitment_type },
    { label: t('Load Volume'), value: first.load_volume },
    { label: t('Equipment Type'), value: first.equipment_type },
    { label: t('Product'), value: first.product },
  ].filter(f => f.value);

  if (fields.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 mb-4">
      {fields.map(f => (
        <div key={f.label}>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">{f.label}</div>
          <div className="text-xs text-gray-800">{f.value}</div>
        </div>
      ))}
    </div>
  );
}

function LaneAccessorials({ lanes, currencyCode, language }: { lanes: QuoteLane[]; currencyCode: CurrencyCode; language: PdfLanguage }) {
  const allAccessorials: { name: string; unit: string; rate: number; section?: string }[] = [];

  for (const lane of lanes) {
    const lists = [
      { items: lane.accessorials_list, section: '' },
      { items: lane.us_accessorials_list, section: 'US' },
      { items: lane.mx_accessorials_list, section: 'MX' },
    ];
    for (const { items, section } of lists) {
      if (Array.isArray(items)) {
        for (const acc of items) {
          if (acc && typeof acc === 'object') {
            const name = (language === 'es' && acc.name_es) ? acc.name_es : (acc.name || acc.accessorial_name || '');
            allAccessorials.push({
              name,
              unit: acc.unit_type || acc.unit || 'FLAT',
              rate: acc.rate || acc.amount || 0,
              section,
            });
          }
        }
      }
    }
  }

  if (allAccessorials.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
        {language === 'es' ? 'Accesorios Incluidos' : 'Included Accessorials'}
      </div>
      <div className="space-y-1">
        {allAccessorials.map((acc, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="text-gray-800">{acc.name}</span>
            {acc.section && (
              <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-gray-100 text-gray-500 rounded">{acc.section}</span>
            )}
            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-blue-50 text-blue-600 rounded">{acc.unit}</span>
            <span className="text-gray-600 ml-auto">{formatCurrency(acc.rate, currencyCode)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LaneComments({ lanes, language }: { lanes: QuoteLane[]; language: PdfLanguage }) {
  const comments = lanes.filter(l => l.comments).map(l => l.comments);
  if (comments.length === 0) return null;

  return (
    <div className="mb-2">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
        {translateLabel('Comments', language)}
      </div>
      {comments.map((c, i) => (
        <div key={i} className="bg-gray-50 rounded-md px-3 py-2 text-xs text-gray-600 mb-1">{c}</div>
      ))}
    </div>
  );
}

function ResponseControls({
  response,
  onResponseChange,
  language,
}: {
  response: GroupResponse;
  onResponseChange: (r: GroupResponse) => void;
  language: PdfLanguage;
}) {
  const isEs = language === 'es';
  const [showError, setShowError] = useState(false);

  const select = (status: 'accepted' | 'rejected' | 'negotiate') => {
    setShowError(false);
    if (response.status === status) {
      onResponseChange({ status: null, comment: '' });
    } else {
      onResponseChange({ status, comment: status === 'accepted' ? '' : response.comment });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          onClick={() => select('accepted')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
            response.status === 'accepted'
              ? 'bg-green-500 text-white shadow-sm'
              : 'bg-white text-gray-500 border border-gray-300 hover:border-green-400 hover:text-green-600'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
          {isEs ? 'Aceptar' : 'Accept'}
        </button>
        <button
          onClick={() => select('rejected')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
            response.status === 'rejected'
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-white text-gray-500 border border-gray-300 hover:border-red-400 hover:text-red-600'
          }`}
        >
          <X className="w-3.5 h-3.5" />
          {isEs ? 'Rechazar' : 'Reject'}
        </button>
        <button
          onClick={() => select('negotiate')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 ${
            response.status === 'negotiate'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-white text-gray-500 border border-gray-300 hover:border-blue-400 hover:text-blue-600'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {isEs ? 'Negociar' : 'Negotiate'}
        </button>
      </div>

      {(response.status === 'rejected' || response.status === 'negotiate') && (
        <div>
          <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
            {response.status === 'rejected'
              ? (isEs ? 'Por favor diganos por que esta rechazando este carril (opcional):' : 'Please tell us why you are rejecting this lane (optional):')
              : (isEs ? 'Por favor describa lo que le gustaria negociar (requerido):' : 'Please describe what you would like to negotiate (required):')}
          </label>
          <textarea
            value={response.comment}
            onChange={e => {
              setShowError(false);
              onResponseChange({ ...response, comment: e.target.value });
            }}
            rows={3}
            placeholder={
              response.status === 'negotiate'
                ? (isEs ? 'Ej. Me gustaria discutir la tarifa para este carril...' : 'e.g. I would like to discuss the rate for this lane...')
                : ''
            }
            className={`w-full px-3 py-2 text-xs border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              showError && response.status === 'negotiate' && !response.comment.trim()
                ? 'border-red-400'
                : 'border-gray-300'
            }`}
          />
          {showError && response.status === 'negotiate' && !response.comment.trim() && (
            <p className="text-[10px] text-red-600 mt-0.5">
              {isEs ? 'Por favor describa lo que le gustaria negociar antes de enviar' : 'Please describe what you would like to negotiate before submitting'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
