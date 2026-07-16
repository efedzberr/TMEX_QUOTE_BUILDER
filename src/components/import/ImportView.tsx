import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const PREVIEW_ROW_LIMIT = 20;

interface ParsedFile {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export function ImportView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);

  function reset() {
    setParsed(null);
    setError(null);
    setParsing(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  function hasAcceptedExtension(name: string): boolean {
    const lower = name.toLowerCase();
    return ACCEPTED_EXTENSIONS.some(ext => lower.endsWith(ext));
  }

  async function handleFile(file: File) {
    setError(null);
    setParsed(null);

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

      setParsed({
        fileName: file.name,
        sheetName,
        headers,
        rows: bodyRows.slice(0, PREVIEW_ROW_LIMIT),
        totalRows: bodyRows.length,
      });
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Import</h1>
          <p className="mt-1 text-sm text-gray-500">Upload market, cost structure, and quote files.</p>
        </div>

        {/* Hidden native input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={onInputChange}
        />

        {/* Dropzone (shown until a file is parsed) */}
        {!parsed && (
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
                <h2 className="text-base font-semibold text-gray-700 mb-1">
                  Arrastra un archivo aqu&iacute; o haz clic para seleccionar
                </h2>
                <p className="text-sm text-gray-500 max-w-sm">
                  Formatos aceptados: Excel (.xlsx, .xls) y CSV. Se mostrar&aacute; una vista previa antes de importar.
                </p>
              </>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Preview (shown after successful parse) */}
        {parsed && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{parsed.fileName}</div>
                  <div className="text-xs text-gray-500">
                    Hoja: {parsed.sheetName} &middot; {parsed.totalRows} filas &middot; {parsed.headers.length} columnas
                  </div>
                </div>
              </div>
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
                Quitar
              </button>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
              <p className="text-xs text-gray-500">
                Vista previa de las primeras {Math.min(PREVIEW_ROW_LIMIT, parsed.totalRows)} filas. A&uacute;n no se ha importado nada a la base de datos.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 w-12">#</th>
                    {parsed.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">
                        {h || <span className="text-gray-300">(sin t&iacute;tulo)</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsed.rows.map((row, ri) => (
                    <tr key={ri} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs text-gray-400">{ri + 1}</td>
                      {parsed.headers.map((_, ci) => (
                        <td key={ci} className="px-3 py-2 text-gray-700 whitespace-nowrap">{row[ci]}</td>
                      ))}
                    </tr>
                  ))}
                  {parsed.rows.length === 0 && (
                    <tr>
                      <td colSpan={parsed.headers.length + 1} className="px-3 py-8 text-center text-gray-500">
                        El archivo no tiene filas de datos (solo encabezados).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                La importaci&oacute;n a la base de datos se habilitar&aacute; en el siguiente paso.
              </span>
              <button
                disabled
                title="Disponible en el siguiente paso"
                className="inline-flex items-center gap-2 bg-gray-200 text-gray-400 font-semibold text-sm px-5 py-2.5 rounded-lg cursor-not-allowed"
              >
                Importar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
