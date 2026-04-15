import { useState, useRef, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, RotateCcw, AlertCircle, PenLine } from 'lucide-react';
import { Quote, QuoteLane } from '../../lib/supabase';
import { LaneAcceptanceGroup } from '../../lib/customerPortalHelpers';
import { GroupResponse } from './PortalLaneCard';
import { formatCurrency, CurrencyCode } from '../../lib/constants';
import {
  SIGNATURE_FONTS,
  renderSignatureToCanvas,
  loadSignatureFonts,
  submitPortalResponse,
  SubmissionResult,
} from '../../lib/portalSubmission';
import type { PdfLanguage } from '../../lib/pdfConfigTypes';

interface PortalSignatureSectionProps {
  quote: Quote;
  lanes: QuoteLane[];
  groups: LaneAcceptanceGroup[];
  responses: Record<string, GroupResponse>;
  language: PdfLanguage;
  currencyCode: CurrencyCode;
  isPreview: boolean;
  onSubmitted: (result: SubmissionResult) => void;
}

export function PortalSignatureSection({
  quote,
  lanes,
  groups,
  responses,
  language,
  currencyCode,
  isPreview,
  onSubmitted,
}: PortalSignatureSectionProps) {
  const isEs = language === 'es';

  if (isPreview) {
    return <PreviewPlaceholder isEs={isEs} />;
  }

  return (
    <SignatureForm
      quote={quote}
      lanes={lanes}
      groups={groups}
      responses={responses}
      currencyCode={currencyCode}
      isEs={isEs}
      onSubmitted={onSubmitted}
    />
  );
}

function PreviewPlaceholder({ isEs }: { isEs: boolean }) {
  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
        <p className="text-sm text-gray-400">
          {isEs ? 'Resumen de respuestas y formulario de informacion del cliente (vista previa)' : 'Response summary & customer information form (preview)'}
        </p>
      </div>
      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
        <p className="text-sm text-gray-400">
          {isEs ? 'Panel de firma digital con selector de fuente (vista previa)' : 'Digital signature panel with font selector (preview)'}
        </p>
      </div>
      <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
        <p className="text-sm text-gray-400">
          {isEs ? 'El boton de envio aparece aqui (no activo en modo de vista previa)' : 'Submit button appears here (not active in preview mode)'}
        </p>
      </div>
    </div>
  );
}

function SignatureForm({
  quote,
  lanes,
  groups,
  responses,
  currencyCode,
  isEs,
  onSubmitted,
}: {
  quote: Quote;
  lanes: QuoteLane[];
  groups: LaneAcceptanceGroup[];
  responses: Record<string, GroupResponse>;
  currencyCode: CurrencyCode;
  isEs: boolean;
  onSubmitted: (result: SubmissionResult) => void;
}) {
  const [customerName, setCustomerName] = useState('');
  const [customerTitle, setCustomerTitle] = useState('');
  const [customerCompany, setCustomerCompany] = useState(quote.partner_account || '');
  const [selectedFont, setSelectedFont] = useState<string>(SIGNATURE_FONTS[0].family);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadSignatureFonts();
  }, []);

  const redrawSignature = useCallback(() => {
    if (canvasRef.current && customerName.trim()) {
      renderSignatureToCanvas(canvasRef.current, customerName, selectedFont);
    } else if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const dpr = window.devicePixelRatio || 1;
        const w = canvasRef.current.clientWidth;
        const h = canvasRef.current.clientHeight;
        canvasRef.current.width = w * dpr;
        canvasRef.current.height = h * dpr;
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(24, h - 20);
        ctx.lineTo(w - 24, h - 20);
        ctx.stroke();
      }
    }
  }, [customerName, selectedFont]);

  useEffect(() => {
    const timer = setTimeout(redrawSignature, 100);
    return () => clearTimeout(timer);
  }, [redrawSignature]);

  const accepted = groups.filter(g => responses[g.group_id]?.status === 'accepted').length;
  const rejected = groups.filter(g => responses[g.group_id]?.status === 'rejected').length;
  const negotiate = groups.filter(g => responses[g.group_id]?.status === 'negotiate').length;

  function validate(): string[] {
    const errors: string[] = [];
    if (!customerName.trim()) {
      errors.push(isEs ? 'El nombre es requerido' : 'Name is required');
    }
    if (!agreedToTerms) {
      errors.push(isEs ? 'Debe aceptar los terminos y condiciones' : 'You must agree to the terms and conditions');
    }
    return errors;
  }

  async function handleSubmit() {
    const errors = validate();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setSubmitError('');
    setSubmitting(true);

    let signatureData = '';
    if (canvasRef.current && customerName.trim()) {
      signatureData = renderSignatureToCanvas(canvasRef.current, customerName, selectedFont);
    }

    const result = await submitPortalResponse({
      quote,
      lanes,
      groups,
      responses,
      customerName: customerName.trim(),
      customerTitle: customerTitle.trim(),
      customerCompany: customerCompany.trim(),
      signatureFont: selectedFont,
      signatureData,
    });

    setSubmitting(false);

    if (!result.success) {
      setSubmitError(result.error || (isEs ? 'Error al enviar la respuesta' : 'Failed to submit response'));
      return;
    }

    onSubmitted(result);
  }

  const todayFormatted = new Date().toLocaleDateString(isEs ? 'es-MX' : 'en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900">
            {isEs ? 'Resumen de Respuestas' : 'Response Summary'}
          </h3>
        </div>
        <div className="px-5 py-4">
          <div className="space-y-2">
            {groups.map(group => {
              const r = responses[group.group_id];
              const status = r?.status;
              return (
                <div key={group.group_id} className="flex items-center gap-3 text-sm">
                  <StatusIcon status={status} />
                  <div className="flex-1 min-w-0">
                    <span className="text-gray-800 font-medium">{group.label}</span>
                    <span className="text-gray-400 mx-1.5">--</span>
                    <span className="text-gray-500 text-xs">{group.origin} &rarr; {group.destination}</span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
                    backgroundColor: status === 'accepted' ? '#dcfce7' : status === 'rejected' ? '#fef2f2' : status === 'negotiate' ? '#dbeafe' : '#f3f4f6',
                    color: status === 'accepted' ? '#15803d' : status === 'rejected' ? '#b91c1c' : status === 'negotiate' ? '#1d4ed8' : '#9ca3af',
                  }}>
                    {status === 'accepted' ? (isEs ? 'Aceptado' : 'Accepted')
                      : status === 'rejected' ? (isEs ? 'Rechazado' : 'Rejected')
                      : status === 'negotiate' ? (isEs ? 'Negociar' : 'Negotiate')
                      : '—'}
                  </span>
                  <span className="text-xs text-gray-600 font-medium ml-2">
                    {formatCurrency(group.lane_total, currencyCode)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4 text-xs">
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
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900">
            {isEs ? 'Informacion del Cliente' : 'Customer Information'}
          </h3>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                {isEs ? 'Empresa' : 'Company'}
              </label>
              <input
                type="text"
                value={customerCompany}
                onChange={e => setCustomerCompany(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={quote.partner_account || ''}
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                {isEs ? 'Puesto' : 'Job Title'}
              </label>
              <input
                type="text"
                value={customerTitle}
                onChange={e => setCustomerTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                {isEs ? 'Nombre Completo' : 'Full Name'} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => {
                  setCustomerName(e.target.value);
                  setValidationErrors([]);
                }}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  validationErrors.some(e => e.includes('ame')) ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder={isEs ? 'Ingrese su nombre completo' : 'Enter your full name'}
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                {isEs ? 'Fecha' : 'Date'}
              </label>
              <div className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
                {todayFormatted}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <PenLine className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-bold text-gray-900">
            {isEs ? 'Firma Digital' : 'Digital Signature'}
          </h3>
        </div>
        <div className="px-5 py-4">
          <div className="mb-4">
            <label className="block text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
              {isEs ? 'Seleccione un estilo de firma' : 'Select a signature style'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SIGNATURE_FONTS.map(font => (
                <button
                  key={font.family}
                  onClick={() => setSelectedFont(font.family)}
                  className={`px-3 py-3 rounded-lg border-2 transition-all duration-150 text-center ${
                    selectedFont === font.family
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <span
                    className="text-lg text-gray-800 block truncate"
                    style={{ fontFamily: `"${font.family}", cursive` }}
                  >
                    {customerName.trim() || 'Your Name'}
                  </span>
                  <span className="text-[9px] text-gray-400 mt-1 block">{font.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <canvas
              ref={canvasRef}
              className="w-full bg-white rounded-md border border-gray-100"
              style={{ height: '120px' }}
            />
            {!customerName.trim() && (
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                {isEs ? 'Ingrese su nombre arriba para ver la firma' : 'Enter your name above to see the signature preview'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={e => {
                setAgreedToTerms(e.target.checked);
                setValidationErrors([]);
              }}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-600 leading-relaxed group-hover:text-gray-800 transition-colors">
              {isEs
                ? 'He revisado esta cotizacion y confirmo que mis respuestas son finales. Entiendo que esta firma digital es legalmente vinculante.'
                : 'I have reviewed this quote and confirm that my responses are final. I understand that this digital signature is legally binding.'}
            </span>
          </label>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-xs font-semibold text-red-700">
              {isEs ? 'Por favor corrija los siguientes errores:' : 'Please fix the following errors:'}
            </span>
          </div>
          <ul className="ml-6 space-y-0.5">
            {validationErrors.map((err, i) => (
              <li key={i} className="text-xs text-red-600">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-700">{submitError}</span>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className={`w-full py-3 rounded-lg text-sm font-bold transition-all duration-150 ${
          submitting
            ? 'bg-gray-200 text-gray-400 cursor-wait'
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
        }`}
      >
        {submitting
          ? (isEs ? 'Enviando...' : 'Submitting...')
          : (isEs ? 'Enviar Respuesta' : 'Submit Response')}
      </button>
    </div>
  );
}

function StatusIcon({ status }: { status: string | null | undefined }) {
  if (status === 'accepted') return <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />;
  if (status === 'rejected') return <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />;
  if (status === 'negotiate') return <RotateCcw className="w-4 h-4 text-blue-600 flex-shrink-0" />;
  return <div className="w-4 h-4 rounded-full bg-gray-200 flex-shrink-0" />;
}
