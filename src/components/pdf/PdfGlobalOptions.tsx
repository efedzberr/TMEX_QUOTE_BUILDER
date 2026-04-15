import { FileText, Monitor, Globe, DollarSign, Ruler, File as FileIcon, Type, ALargeSmall } from 'lucide-react';
import type { ViewType, Orientation, PageSize, PdfLanguage, CurrencyMode, UnitsMode, FontFamily, FontSize } from '../../lib/pdfConfigTypes';

interface Props {
  viewType: ViewType;
  orientation: Orientation;
  pageSize: PageSize;
  language: PdfLanguage;
  currencyMode: CurrencyMode;
  unitsMode: UnitsMode;
  fontFamily: FontFamily;
  fontSize: FontSize;
  onChange: (field: string, value: string) => void;
}

function Toggle({ left, right, value, onToggle }: { left: string; right: string; value: string; onToggle: (v: string) => void }) {
  const isRight = value === right.toLowerCase().replace(/ /g, '');
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
      <button
        className={`px-3 py-1.5 font-medium transition-colors ${!isRight ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        onClick={() => onToggle(left.toLowerCase().replace(/ /g, ''))}
      >
        {left}
      </button>
      <button
        className={`px-3 py-1.5 font-medium transition-colors ${isRight ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        onClick={() => onToggle(right.toLowerCase().replace(/ /g, ''))}
      >
        {right}
      </button>
    </div>
  );
}

export function PdfGlobalOptions({ viewType, orientation, pageSize, language, currencyMode, unitsMode, fontFamily, fontSize, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Monitor className="w-3.5 h-3.5" />
          <span className="font-medium">View Type</span>
        </div>
        <Toggle
          left="Condensed"
          right="Full"
          value={viewType === 'full' ? 'full' : 'condensed'}
          onToggle={(v) => onChange('view_type', v)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <FileText className="w-3.5 h-3.5" />
          <span className="font-medium">Orientation</span>
        </div>
        <Toggle
          left="Portrait"
          right="Landscape"
          value={orientation}
          onToggle={(v) => onChange('orientation', v)}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <FileIcon className="w-3.5 h-3.5" />
          <span className="font-medium">Page Size</span>
        </div>
        <select
          value={pageSize}
          onChange={(e) => onChange('page_size', e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="letter">Letter (8.5" x 11")</option>
          <option value="a4">A4 (210mm x 297mm)</option>
          <option value="legal">Legal (8.5" x 14")</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Globe className="w-3.5 h-3.5" />
          <span className="font-medium">Language</span>
        </div>
        <Toggle
          left="English"
          right="Spanish"
          value={language === 'es' ? 'spanish' : 'english'}
          onToggle={(v) => onChange('language', v === 'english' ? 'en' : 'es')}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <DollarSign className="w-3.5 h-3.5" />
          <span className="font-medium">Currency</span>
        </div>
        <select
          value={currencyMode}
          onChange={(e) => onChange('currency_mode', e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="default">Default (per lane)</option>
          <option value="USD">USD</option>
          <option value="MXN">MXN</option>
          <option value="CAD">CAD</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Ruler className="w-3.5 h-3.5" />
          <span className="font-medium">Units</span>
        </div>
        <select
          value={unitsMode}
          onChange={(e) => onChange('units_mode', e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="default">Default (per lane)</option>
          <option value="miles">Miles</option>
          <option value="kilometers">Kilometers</option>
        </select>
      </div>

      <div className="border-t border-gray-100 pt-3" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Type className="w-3.5 h-3.5" />
          <span className="font-medium">Font</span>
        </div>
        <select
          value={fontFamily}
          onChange={(e) => onChange('font_family', e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="Helvetica">Helvetica</option>
          <option value="Times-Roman">Times New Roman</option>
          <option value="Courier">Courier</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <ALargeSmall className="w-3.5 h-3.5" />
          <span className="font-medium">Font Size</span>
        </div>
        <select
          value={fontSize}
          onChange={(e) => onChange('font_size', e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="small">Small (6pt / 7pt)</option>
          <option value="medium">Medium (7pt / 8pt)</option>
          <option value="large">Large (8pt / 9pt)</option>
        </select>
      </div>
    </div>
  );
}
