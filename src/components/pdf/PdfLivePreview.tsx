import { useState, useMemo } from 'react';
import { Eye, List, RotateCcw, Loader2 } from 'lucide-react';
import { PDFViewer } from '@react-pdf/renderer';
import type {
  PDFDocument,
  PDFCondensedBody,
  PDFFullBody,
} from '../../lib/pdfAssembler';
import { QuotePDFTemplate } from './PDFTemplate';

interface Props {
  pdfDocument: PDFDocument | null;
  onReset: () => void;
}

function SummaryView({ doc }: { doc: PDFDocument }) {
  const bodyInfo = doc.body.viewType === 'condensed'
    ? `${(doc.body as PDFCondensedBody).columns.length} columns, ${(doc.body as PDFCondensedBody).rows.length} lanes`
    : `${(doc.body as PDFFullBody).laneBlocks.length} lane blocks`;
  const footerVisible = doc.footer.sections.filter(s => s.visible).length;

  return (
    <div className="space-y-3 p-4">
      <h4 className="text-sm font-semibold text-gray-800">Configuration Summary</h4>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-2">
          <div><span className="text-gray-500">View Type:</span> <span className="font-medium capitalize">{doc.meta.viewType}</span></div>
          <div><span className="text-gray-500">Orientation:</span> <span className="font-medium capitalize">{doc.meta.orientation}</span></div>
          <div><span className="text-gray-500">Page Size:</span> <span className="font-medium uppercase">{doc.meta.pageSize}</span></div>
          <div><span className="text-gray-500">Language:</span> <span className="font-medium">{doc.meta.language === 'en' ? 'English' : 'Spanish'}</span></div>
          <div><span className="text-gray-500">Currency:</span> <span className="font-medium capitalize">{doc.meta.currency}</span></div>
          <div><span className="text-gray-500">Units:</span> <span className="font-medium capitalize">{doc.meta.units}</span></div>
        </div>
        <div className="space-y-2">
          <div><span className="text-gray-500">Header Fields:</span> <span className="font-medium">{doc.header.leftColumn.length + doc.header.middleColumn.length + doc.header.rightColumn.length}</span></div>
          <div><span className="text-gray-500">Body:</span> <span className="font-medium">{bodyInfo}</span></div>
          <div><span className="text-gray-500">Footer Sections:</span> <span className="font-medium">{footerVisible}</span></div>
        </div>
      </div>
    </div>
  );
}

export function PdfLivePreview({ pdfDocument, onReset }: Props) {
  const [mode, setMode] = useState<'preview' | 'summary'>('preview');

  const viewerKey = useMemo(() => {
    if (!pdfDocument) return 'empty';
    return JSON.stringify({
      meta: pdfDocument.meta,
      hLen: pdfDocument.header.leftColumn.length + pdfDocument.header.middleColumn.length + pdfDocument.header.rightColumn.length,
      bType: pdfDocument.body.viewType,
      fLen: pdfDocument.footer.sections.length,
    });
  }, [pdfDocument]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          <button
            className={`flex items-center gap-1 px-3 py-1.5 font-medium transition-colors ${mode === 'preview' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setMode('preview')}
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
          <button
            className={`flex items-center gap-1 px-3 py-1.5 font-medium transition-colors ${mode === 'summary' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setMode('summary')}
          >
            <List className="w-3 h-3" />
            Summary
          </button>
        </div>
      </div>

      <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden" style={{ minHeight: '500px' }}>
        {mode === 'summary' ? (
          <div className="p-4">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              {pdfDocument ? <SummaryView doc={pdfDocument} /> : (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="ml-2 text-sm text-gray-500">Building preview...</span>
                </div>
              )}
            </div>
          </div>
        ) : pdfDocument ? (
          <PDFViewer
            key={viewerKey}
            width="100%"
            height="100%"
            style={{ border: 'none' }}
          >
            <QuotePDFTemplate pdfDocument={pdfDocument} />
          </PDFViewer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
            <span className="ml-2 text-sm text-gray-500">Building preview...</span>
          </div>
        )}
      </div>

      <button
        onClick={onReset}
        className="flex items-center gap-1.5 mt-3 text-xs text-gray-500 hover:text-blue-600 transition-colors self-end"
      >
        <RotateCcw className="w-3 h-3" />
        Reset to Default
      </button>
    </div>
  );
}
