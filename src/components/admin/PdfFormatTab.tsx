import { useEffect, useMemo, useState } from 'react';
import { Save, FileText, Crown, Flag, Layers } from 'lucide-react';
import { buildDefaultConfig } from '../../lib/pdfConfigTypes';
import { applyStandardFormat, loadStandardFormat, saveStandardFormat, type StandardFormat } from '../../lib/pdfStandardFormat';
import { usePermissions } from '../../lib/permissions';
import { PdfTitleConfig } from '../pdf/PdfTitleConfig';
import { PdfBannerConfig } from '../pdf/PdfBannerConfig';
import { PdfHeaderConfig } from '../pdf/PdfHeaderConfig';

interface PdfFormatTabProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

function toFormat(source: StandardFormat): StandardFormat {
  return {
    title_config: source.title_config,
    banner_config: source.banner_config,
    header_left: source.header_left,
    header_middle: source.header_middle,
    header_right: source.header_right,
  };
}

export function PdfFormatTab({ onToast }: PdfFormatTabProps) {
  const { can } = usePermissions();
  const canEdit = can('admin.pdf_format', 'edit');
  const [saved, setSaved] = useState<StandardFormat | null>(null);
  const [draft, setDraft] = useState<StandardFormat | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await loadStandardFormat();
      const format = toFormat(applyStandardFormat(buildDefaultConfig(''), stored));
      setSaved(format);
      setDraft(format);
      setLoading(false);
    })();
  }, []);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  function update<K extends keyof StandardFormat>(key: K, value: StandardFormat[K]) {
    setDraft(prev => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!draft || !dirty || !canEdit) return;
    setSaving(true);
    const err = await saveStandardFormat(draft);
    setSaving(false);
    if (err) {
      console.error('Error saving PDF format:', err);
      onToast("We couldn't save the quote PDF format.", 'error');
      return;
    }
    setSaved(draft);
    onToast('Quote PDF format saved. New quote PDFs will start from this format.', 'success');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900"><FileText className="w-4 h-4 text-gray-400" /> Quote PDF Format</h2>
          <p className="mt-1 text-sm text-gray-500">
            The standard title bar, header and banner used on every quote PDF. Quotes that already have a saved PDF setup keep their own until reset.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={!dirty || saving || loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
          </button>
        )}
      </div>

      {loading || !draft ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <fieldset disabled={!canEdit} className="space-y-6 disabled:opacity-70">
          <section className="border border-gray-200 rounded-lg p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3"><Crown className="w-4 h-4 text-gray-400" /> Title Bar</h3>
            <PdfTitleConfig config={draft.title_config} onChange={c => update('title_config', c)} hideStyling />
          </section>
          <section className="border border-gray-200 rounded-lg p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3"><Layers className="w-4 h-4 text-gray-400" /> Header</h3>
            <PdfHeaderConfig
              headerLeft={draft.header_left}
              headerMiddle={draft.header_middle}
              headerRight={draft.header_right}
              onUpdate={(column, fields) => update(column, fields)}
            />
          </section>
          <section className="border border-gray-200 rounded-lg p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-3"><Flag className="w-4 h-4 text-gray-400" /> Banner</h3>
            <PdfBannerConfig config={draft.banner_config} onChange={c => update('banner_config', c)} hideStyling />
          </section>
        </fieldset>
      )}
    </div>
  );
}
