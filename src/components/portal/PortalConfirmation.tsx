import { CheckCircle, XCircle, RotateCcw, Layers } from 'lucide-react';
import { Quote } from '../../lib/supabase';
import { LaneAcceptanceGroup } from '../../lib/customerPortalHelpers';
import { GroupResponse } from './PortalLaneCard';
import { formatCurrency, CurrencyCode } from '../../lib/constants';
import type { OverallStatus } from '../../lib/portalSubmission';
import type { PdfLanguage } from '../../lib/pdfConfigTypes';

interface PortalConfirmationProps {
  quote: Quote;
  groups: LaneAcceptanceGroup[];
  responses: Record<string, GroupResponse>;
  overallStatus: OverallStatus;
  language: PdfLanguage;
  currencyCode: CurrencyCode;
  customerName: string;
}

const STATUS_CONFIG = {
  accepted: {
    icon: CheckCircle,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
    borderColor: 'border-l-green-500',
    titleEn: 'Quote Accepted',
    titleEs: 'Cotizacion Aceptada',
    messageEn: 'Thank you for accepting this quote. Your TransMex representative has been notified and will be in touch shortly to finalize the details.',
    messageEs: 'Gracias por aceptar esta cotizacion. Su representante de TransMex ha sido notificado y se comunicara con usted en breve para finalizar los detalles.',
  },
  rejected: {
    icon: XCircle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-50',
    borderColor: 'border-l-red-500',
    titleEn: 'Quote Declined',
    titleEs: 'Cotizacion Rechazada',
    messageEn: 'We have received your response. Your TransMex representative has been notified and may follow up with you regarding an updated offer.',
    messageEs: 'Hemos recibido su respuesta. Su representante de TransMex ha sido notificado y puede comunicarse con usted sobre una oferta actualizada.',
  },
  negotiate: {
    icon: RotateCcw,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    borderColor: 'border-l-blue-500',
    titleEn: 'Negotiation Requested',
    titleEs: 'Negociacion Solicitada',
    messageEn: 'We have received your negotiation request. Your TransMex representative will review your comments and reach out to discuss the terms.',
    messageEs: 'Hemos recibido su solicitud de negociacion. Su representante de TransMex revisara sus comentarios y se comunicara para discutir los terminos.',
  },
  mixed: {
    icon: Layers,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50',
    borderColor: 'border-l-amber-500',
    titleEn: 'Response Submitted',
    titleEs: 'Respuesta Enviada',
    messageEn: 'We have received your mixed response. Your TransMex representative will review each lane decision and follow up accordingly.',
    messageEs: 'Hemos recibido su respuesta mixta. Su representante de TransMex revisara la decision de cada carril y hara seguimiento.',
  },
};

export function PortalConfirmation({
  quote,
  groups,
  responses,
  overallStatus,
  language,
  currencyCode,
  customerName,
}: PortalConfirmationProps) {
  const isEs = language === 'es';
  const config = STATUS_CONFIG[overallStatus];
  const Icon = config.icon;

  const accepted = groups.filter(g => responses[g.group_id]?.status === 'accepted').length;
  const rejected = groups.filter(g => responses[g.group_id]?.status === 'rejected').length;
  const negotiate = groups.filter(g => responses[g.group_id]?.status === 'negotiate').length;

  const submittedDate = new Date().toLocaleDateString(isEs ? 'es-MX' : 'en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="max-w-[700px] mx-auto">
      <div className={`bg-white rounded-xl border border-gray-200 ${config.borderColor} border-l-4 overflow-hidden`}>
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-14 h-14 rounded-full ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-7 h-7 ${config.iconColor}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEs ? config.titleEs : config.titleEn}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {isEs ? 'Cotizacion' : 'Quote'} {quote.generated_quote_name || quote.quote_number}
              </p>
            </div>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            {isEs ? config.messageEs : config.messageEn}
          </p>

          <div className="bg-gray-50 rounded-lg border border-gray-100 p-4 mb-6">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 font-semibold uppercase tracking-wider block mb-0.5">
                  {isEs ? 'Enviado por' : 'Submitted by'}
                </span>
                <span className="text-gray-800 font-medium">{customerName}</span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold uppercase tracking-wider block mb-0.5">
                  {isEs ? 'Fecha' : 'Date'}
                </span>
                <span className="text-gray-800 font-medium">{submittedDate}</span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold uppercase tracking-wider block mb-0.5">
                  {isEs ? 'Cuenta' : 'Account'}
                </span>
                <span className="text-gray-800 font-medium">{quote.partner_account || '—'}</span>
              </div>
              <div>
                <span className="text-gray-400 font-semibold uppercase tracking-wider block mb-0.5">
                  {isEs ? 'Estado' : 'Status'}
                </span>
                <span className="font-semibold" style={{
                  color: overallStatus === 'accepted' ? '#15803d'
                    : overallStatus === 'rejected' ? '#b91c1c'
                    : overallStatus === 'negotiate' ? '#1d4ed8'
                    : '#d97706',
                }}>
                  {overallStatus === 'accepted' ? (isEs ? 'Aceptado' : 'Accepted')
                    : overallStatus === 'rejected' ? (isEs ? 'Rechazado' : 'Rejected')
                    : overallStatus === 'negotiate' ? (isEs ? 'Negociando' : 'Negotiating')
                    : (isEs ? 'Mixto' : 'Mixed')}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-6">
            <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
              {isEs ? 'Detalle de Carriles' : 'Lane Details'}
            </h4>
            {groups.map(group => {
              const r = responses[group.group_id];
              const status = r?.status;
              return (
                <div key={group.group_id} className="flex items-center gap-3 text-sm py-1.5 border-b border-gray-50 last:border-b-0">
                  <LaneStatusDot status={status} />
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-800 font-medium text-xs">{group.label}</span>
                    <span className="text-gray-400 mx-1">--</span>
                    <span className="text-gray-500 text-[11px]">{group.origin} &rarr; {group.destination}</span>
                  </div>
                  <span className="text-xs text-gray-600 font-medium">
                    {formatCurrency(group.lane_total, currencyCode)}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{
                    backgroundColor: status === 'accepted' ? '#dcfce7' : status === 'rejected' ? '#fef2f2' : status === 'negotiate' ? '#dbeafe' : '#f3f4f6',
                    color: status === 'accepted' ? '#15803d' : status === 'rejected' ? '#b91c1c' : status === 'negotiate' ? '#1d4ed8' : '#9ca3af',
                  }}>
                    {status === 'accepted' ? (isEs ? 'Aceptado' : 'Accepted')
                      : status === 'rejected' ? (isEs ? 'Rechazado' : 'Rejected')
                      : status === 'negotiate' ? (isEs ? 'Negociar' : 'Negotiate')
                      : '—'}
                  </span>
                </div>
              );
            })}
          </div>

          {(accepted > 0 || rejected > 0 || negotiate > 0) && (
            <div className="flex items-center gap-4 text-xs pb-2">
              {accepted > 0 && (
                <span className="font-semibold text-green-700">{accepted} {isEs ? 'Aceptado' : 'Accepted'}</span>
              )}
              {rejected > 0 && (
                <span className="font-semibold text-red-700">{rejected} {isEs ? 'Rechazado' : 'Rejected'}</span>
              )}
              {negotiate > 0 && (
                <span className="font-semibold text-blue-700">{negotiate} {isEs ? 'A Negociar' : 'To Negotiate'}</span>
              )}
            </div>
          )}
        </div>

        <div className="px-8 py-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            {isEs
              ? 'Si tiene alguna pregunta, comuniquese con su representante de TransMex.'
              : 'If you have any questions, please contact your TransMex representative.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function LaneStatusDot({ status }: { status: string | null | undefined }) {
  const color = status === 'accepted' ? 'bg-green-500'
    : status === 'rejected' ? 'bg-red-500'
    : status === 'negotiate' ? 'bg-blue-500'
    : 'bg-gray-300';

  return <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${color}`} />;
}
