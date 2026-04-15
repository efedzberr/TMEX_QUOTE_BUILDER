import { ArrowRight } from 'lucide-react';
import { LaneAcceptanceGroup } from '../../lib/customerPortalHelpers';
import { GroupResponse } from './PortalLaneCard';
import type { PdfLanguage } from '../../lib/pdfConfigTypes';

interface PortalSummaryBarProps {
  groups: LaneAcceptanceGroup[];
  responses: Record<string, GroupResponse>;
  language: PdfLanguage;
  onContinue: () => void;
}

export function PortalSummaryBar({ groups, responses, language, onContinue }: PortalSummaryBarProps) {
  const isEs = language === 'es';
  const total = groups.length;

  const responded = groups.filter(g => responses[g.group_id]?.status).length;
  const accepted = groups.filter(g => responses[g.group_id]?.status === 'accepted').length;
  const rejected = groups.filter(g => responses[g.group_id]?.status === 'rejected').length;
  const negotiate = groups.filter(g => responses[g.group_id]?.status === 'negotiate').length;

  const hasNegotiateWithoutComment = groups.some(g => {
    const r = responses[g.group_id];
    return r?.status === 'negotiate' && !r.comment?.trim();
  });

  const allResponded = responded === total;
  const canContinue = allResponded && !hasNegotiateWithoutComment;

  const progressPct = total > 0 ? (responded / total) * 100 : 0;

  const tooltipText = hasNegotiateWithoutComment
    ? (isEs ? 'Por favor describa lo que le gustaria negociar' : 'Please describe what you would like to negotiate')
    : !allResponded
      ? (isEs ? 'Por favor responda a todos los carriles' : 'Please respond to all lanes')
      : '';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] z-40">
      <div className="max-w-[1100px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-xs text-gray-600 font-medium">
              {isEs
                ? `${responded} de ${total} carril${total !== 1 ? 'es' : ''} respondido${responded !== 1 ? 's' : ''}`
                : `${responded} of ${total} lane${total !== 1 ? 's' : ''} responded`}
            </span>
            <div className="flex items-center gap-1">
              {groups.map(g => {
                const s = responses[g.group_id]?.status;
                return (
                  <div
                    key={g.group_id}
                    className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
                      s === 'accepted' ? 'bg-green-500'
                        : s === 'rejected' ? 'bg-red-500'
                        : s === 'negotiate' ? 'bg-blue-500'
                        : 'bg-gray-300'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {responded > 0 && (
            <div className="flex items-center gap-3 mt-1.5">
              {accepted > 0 && (
                <span className="text-[10px] font-semibold text-green-600">{accepted} {isEs ? 'Aceptado' : 'Accepted'}</span>
              )}
              {rejected > 0 && (
                <span className="text-[10px] font-semibold text-red-600">{rejected} {isEs ? 'Rechazado' : 'Rejected'}</span>
              )}
              {negotiate > 0 && (
                <span className="text-[10px] font-semibold text-blue-600">{negotiate} {isEs ? 'A Negociar' : 'To Negotiate'}</span>
              )}
            </div>
          )}
        </div>

        <div className="relative group">
          <button
            onClick={canContinue ? onContinue : undefined}
            disabled={!canContinue}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 whitespace-nowrap ${
              canContinue
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isEs ? 'Continuar para Revisar y Firmar' : 'Continue to Review & Sign'}
            <ArrowRight className="w-4 h-4" />
          </button>
          {!canContinue && tooltipText && (
            <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block">
              <div className="bg-gray-800 text-white text-[10px] px-3 py-1.5 rounded-md whitespace-nowrap shadow-lg">
                {tooltipText}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
