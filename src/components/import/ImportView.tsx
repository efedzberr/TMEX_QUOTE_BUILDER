import { useRef, useState, useEffect, useMemo } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const PREVIEW_ROW_LIMIT = 20;
const NONE = '';

type FieldType = 'text' | 'numeric' | 'date';

interface MapField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  aliases: string[];
}

const MAP_FIELDS: MapField[] = [
  { key: 'origin_city', label: 'Origin City', type: 'text', required: true, aliases: ['origin', 'origen', 'ciudad origen', 'from', 'pickup'] },
  { key: 'destination_city', label: 'Destination City', type: 'text', required: true, aliases: ['destination', 'destino', 'ciudad destino', 'to', 'delivery'] },
  { key: 'border_crossing', label: 'Border Crossing', type: 'text', required: true, aliases: ['border', 'cruce', 'crossing', 'border crossing', 'cruce fronterizo', 'frontera'] },
  { key: 'frequency', label: 'Frequency (# of trips)', type: 'text', aliases: ['number of trips', 'trips', 'viajes', 'frecuencia', 'num trips', 'no of trips'] },
  { key: 'equipment_type', label: 'Equipment Type', type: 'text', aliases: ['equipment', 'equipo', 'trailer'] },
  { key: 'service_type', label: 'Service Type', type: 'text', aliases: ['service', 'servicio', 'tipo servicio'] },
  { key: 'trip_type', label: 'Trip Type', type: 'text', aliases: ['trip type', 'tipo viaje'] },
  { key: 'border_crossing_fee', label: 'Border Crossing Fee', type: 'numeric', aliases: ['border fee', 'cuota cruce', 'fee'] },
  { key: 'us_rate', label: 'US Rate', type: 'numeric', aliases: ['us rate', 'tarifa us', 'usa rate'] },
  { key: 'mx_rate', label: 'MX Rate', type: 'numeric', aliases: ['mx rate', 'tarifa mx', 'mexico rate'] },
  { key: 'us_miles', label: 'US Miles', type: 'numeric', aliases: ['us miles', 'millas us'] },
  { key: 'mx_miles', label: 'MX Miles', type: 'numeric', aliases: ['mx miles', 'millas mx'] },
  { key: 'us_fuel_rate', label: 'US Fuel Rate', type: 'numeric', aliases: ['us fuel', 'combustible us'] },
  { key: 'mx_fuel_rate', label: 'MX Fuel Rate', type: 'numeric', aliases: ['mx fuel', 'combustible mx'] },
  { key: 'us_rate_per_mile', label: 'US Rate / Mile', type: 'numeric', aliases: ['us rpm', 'us rate per mile', 'us per mile'] },
  { key: 'mx_rate_per_mile', label: 'MX Rate / Mile', type: 'numeric', aliases: ['mx rpm', 'mx rate per mile', 'mx per mile'] },
  { key: 'currency_type', label: 'Currency', type: 'text', aliases: ['currency', 'moneda'] },
  { key: 'commitment_type', label: 'Commitment Type', type: 'text', aliases: ['commitment', 'compromiso'] },
  { key: 'requested_price', label: 'Requested Price', type: 'numeric', aliases: ['requested price', 'precio solicitado', 'target price', 'precio objetivo'] },
  { key: 'requested_discount_percent', label: 'Requested Discount %', type: 'numeric', aliases: ['discount', 'descuento'] },
  { key: 'product', label: 'Product', type: 'text', aliases: ['product', 'producto', 'commodity', 'mercancia'] },
  { key: 'weight', label: 'Weight', type: 'text', aliases: ['weight', 'peso'] },
  { key: 'dimensions', label: 'Dimensions', type: 'text', aliases: ['dimensions', 'dimensiones'] },
  { key: 'temperature', label: 'Temperature', type: 'text', aliases: ['temperature', 'temperatura', 'temp'] },
  { key: 'volume', label: 'Volume', type: 'text', aliases: ['volume', 'volumen'] },
  { key: 'priority', label: 'Priority', type: 'text', aliases: ['priority', 'prioridad'] },
  { key: 'comments', label: 'Comments', type: 'text', aliases: ['comments', 'comentarios', 'notes', 'notas'] },
  { key: 'effective_from_date', label: 'Effective From', type: 'date', aliases: ['effective from', 'vigencia desde', 'from date', 'start date', 'fecha inicio'] },
  { key: 'effective_to_date', label: 'Effective To', type: 'date', aliases: ['effective to', 'vigencia hasta', 'to date', 'end date', 'fecha fin'] },
];

const REQUIRED_KEYS = MAP_FIELDS.filter(f => f.required).map(f => f.key);

interface QuoteOption {
  id: string;
  quote_number: string;
  partner_account: string;
}

interface ParsedFile {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  status: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function autoMatch(headers: string[], field: MapField): string {
  const normHeaders = headers.map(h => ({ raw: h, norm: normalize(h) }));
  const candidates = [field.key, field.label, ...field.aliases].map(normalize).filter(Boolean);
  for (const c of candidates) {
    const exact = normHeaders.find(h => h.norm === c);
    if (exact) return exact.raw;
  }
  for (const c of candidates) {
    if (c.length < 4) continue;
    const partial = normHeaders.find(h => h.norm.length >= 4 && h.norm.includes(c));
    if (partial) return partial.raw;
  }
  return NONE;
}

function coerce(raw: string, type: FieldType): { value: unknown; ok: boolean; omit: boolean } {
  const v = (raw ?? '').trim();
  if (type === 'numeric') {
    if (v === '') return { value: 0, ok: true, omit: true };
    const n = parseFloat(v.replace(/[$,\s]/g, ''));
    return isNaN(n) ? { value: 0, ok: false, omit: false } : { value: n, ok: true, omit: false };
  }
  if (type === 'date') {
    if (v === '') return { value: null, ok: true, omit: true };
    const d = new Date(v);
    return isNaN(d.getTime())
      ? { value: null, ok: false, omit: true }
      : { value: d.toISOString().slice(0, 10), ok: true, omit: false };
  }
  if (v === '') return { value: '', ok: true, omit: true };
  return { value: v, ok: true, omit: false };
}

export function ImportView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [quotes, setQuotes] = useState<QuoteOption[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    supabase
      .from('quotes')
      .select('id, quote_number, partner_account')
      .order('created_at', { ascending: false })
      .then(({ data }) => setQuotes((data as QuoteOption[]) || []));
  }, []);

  function resetFile() {
    setParsed(null);
    setMapping({});
    setError(null);
    setParsing(false);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function hasAcceptedExtension(name: string): boolean {
    const lower = name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some(ext => lower.endsWith(ext));
  }

  async function handleFile(file: File) {
    setError(null);
    setParsed(null);
    setResult(null);

    if (!hasAcceptedExtension(file.name)) {
      setError('Formato no soportado. Sube un archivo .xlsx, .xls o .csv.');
      return;
    }

    setParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        setError('El archivo no contiene hojas.');
        setParsing(false);
        return;
      }

      const worksheet = workbook.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
      if (aoa.length === 0) {
        setError('La primera hoja est\u00e1 vac\u00eda.');
        setParsing(false);
        return;
      }

      const headers = (aoa[0] || []).map(h => String(h ?? '').trim());
      const bodyRows = aoa.slice(1).map(row => headers.map((_, i) => String((row as unknown[])[i] ?? '')));

      const initialMapping: Record<string, string> = {};
      MAP_FIELDS.forEach(f => { initialMapping[f.key] = autoMatch(headers, f); });

      setMapping(initialMapping);
      setParsed({ fileName: file.name, sheetName, headers, rows: bodyRows, totalRows: bodyRows.length });
    } catch (err) {
      console.error('Error parsing file:', err);
      setError('No se pudo leer el archivo. Verifica que no est\u00e9 da\u00f1ado.');
    } finally {
      setParsing(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const headerIndex = useMemo(() => {
    const m: Record<string, number> = {};
    parsed?.headers.forEach((h, i) => { if (!(h in m)) m[h] = i; });
    return m;
  }, [parsed]);

  const requiredMapped = REQUIRED_KEYS.every(k => mapping[k]);

  const rowStats = useMemo(() => {
    if (!parsed) return { valid: 0, skipped: 0 };
    let valid = 0;
    let skipped = 0;
    for (const row of parsed.rows) {
      const missing = REQUIRED_KEYS.some(k => {
        const header = mapping[k];
        if (!header) return true;
        const idx = headerIndex[header];
        return !(row[idx] ?? '').trim();
      });
      if (missing) skipped++; else valid++;
    }
    return { valid, skipped };
  }, [parsed, mapping, headerIndex]);

  const canImport = !!selectedQuoteId && requiredMapped && rowStats.valid > 0 && !importing;

  async function runImport() {
    if (!parsed || !selectedQuoteId) return;
    setImporting(true);
    setError(null);

    try {
      const { data: existing } = await supabase
        .from('quote_lanes')
        .select('sort_order')
        .eq('quote_id', selectedQuoteId)
        .order('sort_order', { ascending: false })
        .limit(1);
      const startSort = existing && existing.length > 0 ? (existing[0].sort_order || 0) + 1 : 0;

      const laneObjects: Record<string, unknown>[] = [];
      const errorDetail: { row: number; reason: string }[] = [];

      parsed.rows.forEach((row, idx) => {
        const missing = REQUIRED_KEYS.filter(k => {
          const header = mapping[k];
          if (!header) return true;
          return !(row[headerIndex[header]] ?? '').trim();
        });
        if (missing.length > 0) {
          errorDetail.push({ row: idx + 2, reason: `Faltan campos requeridos: ${missing.join(', ')}` });
          return;
        }

        const obj: Record<string, unknown> = {
          quote_id: selectedQuoteId,
          sort_order: startSort + laneObjects.length,
          lane_origin: 'Import',
        };

        for (const field of MAP_FIELDS) {
          const header = mapping[field.key];
          if (!header) continue;
          const raw = row[headerIndex[header]] ?? '';
          const { value, omit } = coerce(raw, field.type);
          if (omit) continue;
          obj[field.key] = value;
        }
        laneObjects.push(obj);
      });

      let status = 'success';
      if (laneObjects.length === 0) status = 'failed';
      else if (errorDetail.length > 0) status = 'partial';

      if (laneObjects.length > 0) {
        const { error: insertError } = await supabase.from('quote_lanes').insert(laneObjects);
        if (insertError) {
          console.error('Lane insert error:', insertError);
          setError('No se pudieron guardar las lanes. Revisa la cotizaci\u00f3n destino e intenta de nuevo.');
          setImporting(false);
          return;
        }
      }

      const { error: logError } = await supabase.from('import_logs').insert({
        import_type: 'Quote Lanes',
        file_name: parsed.fileName,
        quote_id: selectedQuoteId,
        status,
        total_rows: parsed.totalRows,
        imported_rows: laneObjects.length,
        error_rows: errorDetail.length,
        errors: errorDetail.slice(0, 200),
      });
      if (logError) console.warn('import_logs write skipped:', logError.message);

      setResult({ imported: laneObjects.length, skipped: errorDetail.length, status });
    } catch (err) {
      console.error('Import failed:', err);
      setError('Ocurri\u00f3 un error durante la importaci\u00f3n.');
    } finally {
      setImporting(false);
    }
  }

  const selectedQuote = quotes.find(q => q.id === selectedQuoteId);
  const previewRows = parsed ? parsed.rows.slice(0, PREVIEW_ROW_LIMIT) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Import</h1>
          <p className="mt-1 text-sm text-gray-500">Upload market, cost structure, and quote files.</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Tipo de importaci&oacute;n</label>
            <select value="quote_lanes" disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700">
              <option value="quote_lanes">Quote Lanes</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Cotizaci&oacute;n destino *</label>
            <select
              value={selectedQuoteId}
              onChange={e => setSelectedQuoteId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecciona una cotizaci&oacute;n...</option>
              {quotes.map(q => (
                <option key={q.id} value={q.id}>{q.quote_number} — {q.partner_account || 'Sin cliente'}</option>
              ))}
            </select>
          </div>
        </div>

        <input ref={inputRef} type="file" accept={ACCEPTED_EXTENSIONS.join(',')} className="hidden" onChange={onInputChange} />

        {!parsed && !result && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`bg-white rounded-lg border-2 border-dashed shadow-sm px-6 py-16 flex flex-col items-center text-center cursor-pointer transition-colors ${
              dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-gray-400" />
            </div>
            {parsing ? (
              <>
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm text-gray-500">Leyendo archivo...</p>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-gray-700 mb-1">Arrastra un archivo aqu&iacute; o haz clic para seleccionar</h2>
                <p className="text-sm text-gray-500 max-w-sm">Formatos aceptados: Excel (.xlsx, .xls) y CSV. Se mostrar&aacute; una vista previa antes de importar.</p>
              </>
            )}
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Importaci&oacute;n completada</h2>
            <p className="text-sm text-gray-500 mb-1">{result.imported} lane(s) agregadas a {selectedQuote?.quote_number || 'la cotizaci\u00f3n'}.</p>
            {result.skipped > 0 && (<p className="text-sm text-amber-600 mb-1">{result.skipped} fila(s) omitidas por campos requeridos faltantes.</p>)}
            <button onClick={resetFile} className="mt-5 inline-flex items-center gap-2 bg-blue-600 text-white font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors">Importar otro archivo</button>
          </div>
        )}

        {parsed && !result && (
          <div className="space-y-5">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 truncate">{parsed.fileName}</div>
                    <div className="text-xs text-gray-500">Hoja: {parsed.sheetName} &middot; {parsed.totalRows} filas &middot; {parsed.headers.length} columnas</div>
                  </div>
                </div>
                <button onClick={resetFile} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
                  <X className="w-4 h-4" />
                  Quitar
                </button>
              </div>

              <div className="px-6 py-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Mapeo de columnas</h3>
                <p className="text-xs text-gray-500 mb-4">Asocia cada campo de la lane con una columna del archivo. Los campos con * son obligatorios; el resto usar&aacute; el valor por defecto si se deja vac&iacute;o.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">
                  {MAP_FIELDS.map(field => {
                    const missingReq = field.required && !mapping[field.key];
                    return (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {field.label}{field.required && <span className="text-red-500"> *</span>}
                        </label>
                        <select
                          value={mapping[field.key] || NONE}
                          onChange={e => setMapping(m => ({ ...m, [field.key]: e.target.value }))}
                          className={`w-full border rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${missingReq ? 'border-red-300' : 'border-gray-200'}`}
                        >
                          <option value={NONE}>— sin asignar —</option>
                          {parsed.headers.map((h, i) => (<option key={i} value={h}>{h || `(columna ${i + 1})`}</option>))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-gray-600">
                  {!requiredMapped && <span className="text-red-600">Asigna los campos obligatorios (Origin, Destination, Border Crossing). </span>}
                  {requiredMapped && (
                    <>
                      <span className="font-medium text-gray-900">{rowStats.valid}</span> fila(s) listas para importar
                      {rowStats.skipped > 0 && <span className="text-amber-600"> &middot; {rowStats.skipped} se omitir&aacute;n</span>}
                      {!selectedQuoteId && <span className="text-red-600"> &middot; selecciona una cotizaci&oacute;n destino</span>}
                    </>
                  )}
                </div>
                <button
                  onClick={runImport}
                  disabled={!canImport}
                  className={`inline-flex items-center gap-2 font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors ${canImport ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  {importing ? 'Importando...' : <>Importar {rowStats.valid > 0 ? `${rowStats.valid} lane(s)` : ''}<ArrowRight className="w-4 h-4" /></>}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs text-gray-500">Vista previa de las primeras {Math.min(PREVIEW_ROW_LIMIT, parsed.totalRows)} filas del archivo.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 w-12">#</th>
                      {parsed.headers.map((h, i) => (<th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h || <span className="text-gray-300">(sin t&iacute;tulo)</span>}</th>))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewRows.map((row, ri) => (
                      <tr key={ri} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs text-gray-400">{ri + 1}</td>
                        {parsed.headers.map((_, ci) => (<td key={ci} className="px-3 py-2 text-gray-700 whitespace-nowrap">{row[ci]}</td>))}
                      </tr>
                    ))}
                    {previewRows.length === 0 && (<tr><td colSpan={parsed.headers.length + 1} className="px-3 py-8 text-center text-gray-500">El archivo no tiene filas de datos (solo encabezados).</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
