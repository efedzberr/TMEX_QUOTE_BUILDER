import { useState, useRef } from 'react';
import { GripVertical, ChevronRight, ChevronDown, FileStack, Upload, File, X, AlertTriangle } from 'lucide-react';
import { useDragReorder } from '../../lib/useDragReorder';
import type { Quote, QuoteLane } from '../../lib/supabase';
import type {
  FooterSectionConfig, AcceptanceConfig,
  FooterAccessorialToggles, FooterTermsToggles,
  AttachedFile,
} from '../../lib/pdfConfigTypes';

interface Props {
  quote: Quote;
  lanes: QuoteLane[];
  footerSections: FooterSectionConfig[];
  footerAccessorials: FooterAccessorialToggles;
  footerTerms: FooterTermsToggles;
  acceptance: AcceptanceConfig;
  attachedFiles: AttachedFile[];
  onFooterSectionsChange: (sections: FooterSectionConfig[]) => void;
  onFooterAccessorialsChange: (toggles: FooterAccessorialToggles) => void;
  onFooterTermsChange: (toggles: FooterTermsToggles) => void;
  onAcceptanceChange: (config: AcceptanceConfig) => void;
  onAttachedFilesChange: (files: AttachedFile[]) => void;
}

interface TermItem {
  id: string;
  name_en: string;
  name_es: string;
  description_en: string;
  description_es: string;
  type?: string;
}

function SectionToggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={enabled} onChange={() => onChange(!enabled)} className="sr-only peer" />
      <div className="w-8 h-[18px] bg-gray-200 rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[1px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
    </label>
  );
}

function AccessorialsSection({ quote, lanes, toggles, onChange }: {
  quote: Quote; lanes: QuoteLane[];
  toggles: FooterAccessorialToggles;
  onChange: (t: FooterAccessorialToggles) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const quoteAccessorials: { id: string; name: string; rate: number }[] =
    Array.isArray(quote.accessorials_list)
      ? quote.accessorials_list.map((a: any) => ({ id: a.id, name: a.name_en || a.name, rate: a.rate || 0 }))
      : [];

  const laneAccessorials = lanes
    .map((lane, idx) => {
      const usAccs: any[] = Array.isArray(lane.us_accessorials_list) ? lane.us_accessorials_list : [];
      const mxAccs: any[] = Array.isArray(lane.mx_accessorials_list) ? lane.mx_accessorials_list : [];
      if (usAccs.length === 0 && mxAccs.length === 0) return null;
      return { laneIdx: idx, laneId: lane.id, origin: lane.origin_city, dest: lane.destination_city, usAccs, mxAccs };
    })
    .filter(Boolean) as { laneIdx: number; laneId: string; origin: string; dest: string; usAccs: any[]; mxAccs: any[] }[];

  function toggleQuoteAcc(accId: string) {
    const current = toggles.quoteLevel[accId] !== false;
    onChange({ ...toggles, quoteLevel: { ...toggles.quoteLevel, [accId]: !current } });
  }

  function toggleLaneAcc(laneId: string, accId: string) {
    const laneToggles = toggles.laneLevel[laneId] || {};
    const current = laneToggles[accId] !== false;
    onChange({
      ...toggles,
      laneLevel: { ...toggles.laneLevel, [laneId]: { ...laneToggles, [accId]: !current } },
    });
  }

  return (
    <div className="space-y-2">
      {quoteAccessorials.length > 0 && (
        <div>
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">General Accessorials</div>
          <div className="space-y-0.5">
            {quoteAccessorials.map(a => (
              <label key={a.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={toggles.quoteLevel[a.id] !== false}
                  onChange={() => toggleQuoteAcc(a.id)}
                  className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-[11px] text-gray-700 flex-1">{a.name}</span>
                <span className="text-[10px] text-gray-400">${a.rate.toFixed(2)}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {laneAccessorials.length > 0 && (
        <div>
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Lane Accessorials ({laneAccessorials.length} lanes)
          </button>
          {expanded && laneAccessorials.map(la => (
            <div key={la.laneId} className="ml-2 mb-2 border-l-2 border-gray-200 pl-2">
              <div className="text-[10px] font-semibold text-gray-600 mb-0.5">
                Lane {la.laneIdx + 1} — {la.origin || '?'} → {la.dest || '?'}
              </div>
              {la.usAccs.map((a: any) => (
                <label key={`us-${a.id}`} className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(toggles.laneLevel[la.laneId] || {})[`us-${a.id}`] !== false}
                    onChange={() => toggleLaneAcc(la.laneId, `us-${a.id}`)}
                    className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-gray-700 flex-1">{a.name_en || a.name}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-red-50 text-red-600">US</span>
                </label>
              ))}
              {la.mxAccs.map((a: any) => (
                <label key={`mx-${a.id}`} className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(toggles.laneLevel[la.laneId] || {})[`mx-${a.id}`] !== false}
                    onChange={() => toggleLaneAcc(la.laneId, `mx-${a.id}`)}
                    className="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-gray-700 flex-1">{a.name_en || a.name}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-green-50 text-green-600">MX</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      {quoteAccessorials.length === 0 && laneAccessorials.length === 0 && (
        <div className="text-[11px] text-gray-400 italic py-2">No accessorials on this quote</div>
      )}
    </div>
  );
}

function TermsSection({ terms, toggles, onChange, sectionType }: {
  terms: TermItem[]; toggles: FooterTermsToggles;
  onChange: (t: FooterTermsToggles) => void; sectionType?: string;
}) {
  const filtered = sectionType ? terms.filter(t => (t.type || '').toLowerCase() === sectionType.toLowerCase()) : terms;

  if (filtered.length === 0) {
    return <div className="text-[11px] text-gray-400 italic py-2">No items available</div>;
  }

  return (
    <div className="space-y-0.5 max-h-[200px] overflow-y-auto custom-scrollbar">
      {filtered.map(t => (
        <label key={t.id} className="flex items-start gap-2 py-0.5 cursor-pointer">
          <input
            type="checkbox"
            checked={toggles[t.id] !== false}
            onChange={() => onChange({ ...toggles, [t.id]: toggles[t.id] === false })}
            className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
          />
          <div className="min-w-0">
            <span className="text-[11px] text-gray-700 block">{t.name_en}</span>
            <span className="text-[10px] text-gray-400 line-clamp-1">{t.description_en}</span>
          </div>
        </label>
      ))}
    </div>
  );
}

function AcceptancePreview({ config }: { config: AcceptanceConfig }) {
  const leftFields: { key: keyof AcceptanceConfig['fields']; label: string }[] = [
    { key: 'company', label: 'COMPANY' },
    { key: 'jobTitle', label: 'JOB TITLE' },
    { key: 'name', label: 'NAME' },
  ];
  const rightFields: { key: keyof AcceptanceConfig['fields']; label: string }[] = [
    { key: 'date', label: 'DATE' },
    { key: 'signature', label: 'SIGNATURE' },
  ];
  const visibleLeft = leftFields.filter(f => config.fields[f.key]);
  const visibleRight = rightFields.filter(f => config.fields[f.key]);
  const maxRows = Math.max(visibleLeft.length, visibleRight.length);

  return (
    <div className="border border-gray-200 rounded overflow-hidden mt-2">
      <div className="py-1 px-2 text-center" style={{ backgroundColor: config.headerColor }}>
        <span className="text-[8px] font-bold text-white uppercase tracking-wider">{config.label || 'RATE ACCEPTED BY:'}</span>
      </div>
      <div className="px-2 py-1.5">
        <div className="flex gap-3">
          <div className="flex-[3] space-y-1">
            {visibleLeft.map(f => (
              <div key={f.key} className="flex items-end gap-1">
                <span className="text-[7px] font-bold text-gray-600 whitespace-nowrap">{f.label}:</span>
                <div className="flex-1 border-b border-gray-400 min-w-[30px]" />
              </div>
            ))}
            {Array.from({ length: maxRows - visibleLeft.length }).map((_, i) => (
              <div key={`pad-l-${i}`} className="h-3" />
            ))}
          </div>
          <div className="flex-[2] space-y-1">
            {Array.from({ length: maxRows }).map((_, rowIdx) => {
              const rightIdx = rowIdx === 0 ? 0 : rowIdx === maxRows - 1 ? (visibleRight.length > 1 ? 1 : -1) : -1;
              const field = rightIdx >= 0 ? visibleRight[rightIdx] : null;
              if (!field) return <div key={`pad-r-${rowIdx}`} className="h-3" />;
              return (
                <div key={field.key} className="flex items-end gap-1">
                  <span className="text-[7px] font-bold text-gray-600 whitespace-nowrap">{field.label}:</span>
                  <div className="flex-1 border-b border-gray-400 min-w-[20px]" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function AcceptanceSection({ config, onChange }: { config: AcceptanceConfig; onChange: (c: AcceptanceConfig) => void }) {
  const fieldLabels: { key: keyof AcceptanceConfig['fields']; label: string }[] = [
    { key: 'company', label: 'Company' },
    { key: 'date', label: 'Date' },
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'name', label: 'Name' },
    { key: 'signature', label: 'Signature' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-500">Header Label:</span>
        <input
          type="text"
          value={config.label}
          onChange={(e) => onChange({ ...config, label: e.target.value })}
          className="flex-1 px-2 py-1 text-[11px] border border-gray-200 rounded focus:ring-1 focus:ring-blue-400"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-500">Header Color:</span>
        <input
          type="color"
          value={config.headerColor}
          onChange={(e) => onChange({ ...config, headerColor: e.target.value })}
          className="w-6 h-6 rounded border border-gray-200 cursor-pointer"
        />
        <span className="text-[10px] text-gray-400">{config.headerColor}</span>
      </div>
      <div className="space-y-0.5">
        {fieldLabels.map(f => (
          <label key={f.key} className="flex items-center gap-2 py-0.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.fields[f.key]}
              onChange={() => onChange({ ...config, fields: { ...config.fields, [f.key]: !config.fields[f.key] } })}
              className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-[11px] text-gray-700">{f.label}</span>
          </label>
        ))}
      </div>
      <AcceptancePreview config={config} />
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsSection({
  files, onChange,
}: {
  files: AttachedFile[];
  onChange: (files: AttachedFile[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const sizeWarning = totalSize > 5 * 1024 * 1024;

  function handleFileSelect(fileList: FileList | null) {
    if (!fileList) return;
    const pdfFiles = Array.from(fileList).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) return;

    pdfFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        onChange([
          ...files,
          { name: file.name, size: file.size, data: base64, order: files.length },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeFile(idx: number) {
    const updated = files.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i }));
    onChange(updated);
  }

  function moveFile(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= files.length) return;
    const updated = [...files];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    onChange(updated.map((f, i) => ({ ...f, order: i })));
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFileSelect(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
      >
        <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1" />
        <p className="text-[11px] text-gray-600 font-medium">Click to select PDF files or drag and drop them here</p>
        <p className="text-[9px] text-gray-400 mt-0.5">Only PDF files accepted. Files will be appended at the end of the document.</p>
      </div>

      {sizeWarning && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          Attached files are large and may slow down PDF generation
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-1">
          {files.map((file, idx) => (
            <div key={`${file.name}-${idx}`} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded group">
              <GripVertical className="w-3 h-3 text-gray-300 cursor-grab flex-shrink-0" />
              <File className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <span className="text-[11px] text-gray-700 flex-1 truncate min-w-0">{file.name}</span>
              <span className="text-[9px] text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => moveFile(idx, idx - 1)}
                  disabled={idx === 0}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ChevronRight className="w-3 h-3 -rotate-90" />
                </button>
                <button
                  onClick={() => moveFile(idx, idx + 1)}
                  disabled={idx === files.length - 1}
                  className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ChevronRight className="w-3 h-3 rotate-90" />
                </button>
              </div>
              <button
                onClick={() => removeFile(idx)}
                className="p-0.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <div className="text-[9px] text-gray-400 text-right">
            {files.length} file{files.length !== 1 ? 's' : ''} — {formatFileSize(totalSize)} total
          </div>
        </div>
      )}
    </div>
  );
}

export function PdfFooterConfig({
  quote, lanes, footerSections, footerAccessorials, footerTerms,
  acceptance, attachedFiles, onFooterSectionsChange, onFooterAccessorialsChange,
  onFooterTermsChange, onAcceptanceChange, onAttachedFilesChange,
}: Props) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['accessorials']));
  const { dragIndex, overIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useDragReorder(footerSections, onFooterSectionsChange);

  const termsList: TermItem[] = Array.isArray(quote.terms_conditions_list) ? quote.terms_conditions_list : [];
  const tcTerms = termsList.filter(t => !t.type || t.type === 'Term' || t.type === 'term');
  const legends = termsList.filter(t => (t.type || '').toLowerCase() === 'legend');
  const disclaimers = termsList.filter(t => (t.type || '').toLowerCase() === 'disclaimer');
  const notes = termsList.filter(t => (t.type || '').toLowerCase() === 'note');

  function toggleExpanded(key: string) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSectionEnabled(key: string) {
    onFooterSectionsChange(footerSections.map(s => s.key === key ? { ...s, enabled: !s.enabled } : s));
  }

  function toggleSectionNewPage(key: string) {
    onFooterSectionsChange(footerSections.map(s => s.key === key ? { ...s, newPage: !s.newPage } : s));
  }

  function renderSectionContent(sectionKey: string) {
    switch (sectionKey) {
      case 'accessorials':
        return <AccessorialsSection quote={quote} lanes={lanes} toggles={footerAccessorials} onChange={onFooterAccessorialsChange} />;
      case 'terms':
        return <TermsSection terms={tcTerms.length > 0 ? tcTerms : termsList} toggles={footerTerms} onChange={onFooterTermsChange} />;
      case 'legends':
        return <TermsSection terms={legends} toggles={footerTerms} onChange={onFooterTermsChange} sectionType="legend" />;
      case 'disclaimers':
        return <TermsSection terms={disclaimers} toggles={footerTerms} onChange={onFooterTermsChange} sectionType="disclaimer" />;
      case 'notes':
        return <TermsSection terms={notes} toggles={footerTerms} onChange={onFooterTermsChange} sectionType="note" />;
      case 'acceptance':
        return <AcceptanceSection config={acceptance} onChange={onAcceptanceChange} />;
      case 'attachments':
        return <AttachmentsSection files={attachedFiles} onChange={onAttachedFilesChange} />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-gray-400">Drag sections to reorder their appearance in the PDF</p>

      <div className="space-y-1.5">
        {footerSections.map((section, idx) => {
          const isExpanded = expandedSections.has(section.key);
          return (
            <div
              key={section.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`border rounded-lg overflow-hidden transition-all ${
                dragIndex === idx ? 'opacity-40 border-blue-300' :
                overIndex === idx ? 'border-blue-400 bg-blue-50' :
                'border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                <GripVertical className="w-3.5 h-3.5 text-gray-300 cursor-grab flex-shrink-0" />
                <button onClick={() => toggleExpanded(section.key)} className="flex-1 flex items-center gap-1.5 text-left min-w-0">
                  {isExpanded ? <ChevronDown className="w-3 h-3 text-gray-400" /> : <ChevronRight className="w-3 h-3 text-gray-400" />}
                  <span className={`text-xs font-medium ${section.enabled ? 'text-gray-900' : 'text-gray-400 line-through'}`}>
                    {section.label}
                  </span>
                </button>
                {section.enabled && (
                  <button
                    onClick={() => toggleSectionNewPage(section.key)}
                    title="Start on new page"
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] transition-colors ${
                      section.newPage
                        ? 'border-blue-400 bg-blue-50 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                    }`}
                  >
                    <FileStack className="w-3 h-3" />
                    <span className="hidden sm:inline">New Page</span>
                  </button>
                )}
                <SectionToggle enabled={section.enabled} onChange={() => toggleSectionEnabled(section.key)} />
              </div>
              {isExpanded && section.enabled && (
                <div className="px-3 py-2 border-t border-gray-100">
                  {renderSectionContent(section.key)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
