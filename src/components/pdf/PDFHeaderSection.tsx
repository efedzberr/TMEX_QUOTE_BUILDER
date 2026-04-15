import { View, Text, Image } from '@react-pdf/renderer';
import type { PDFDocument, PDFHeaderFieldValue, PDFTitleElement, PDFTitleBar, PDFBanner } from '../../lib/pdfAssembler';

const IMAGE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  small: { width: 40, height: 16 },
  medium: { width: 60, height: 24 },
  large: { width: 80, height: 32 },
};

function TitleElement({ el, meta, align }: {
  el: PDFTitleElement;
  meta: PDFDocument['meta'];
  align: 'flex-start' | 'center' | 'flex-end';
}) {
  if (el.type === 'empty') return null;

  if (el.type === 'image') {
    const dims = IMAGE_DIMENSIONS[el.imageSize || 'medium'];
    const src = el.imageData || (el.imageName ? `/${el.imageName}` : '');
    if (!src) return null;
    return <Image src={src} style={{ width: dims.width, height: dims.height, objectFit: 'contain' }} />;
  }

  if (el.type === 'text') {
    return (
      <Text style={{
        fontSize: el.fontSize || meta.bodyFontSize,
        fontFamily: el.bold ? meta.fontBoldFamily : meta.fontFamily,
        color: '#111827',
        textAlign: align === 'flex-start' ? 'left' : align === 'flex-end' ? 'right' : 'center',
      }}>
        {el.text || ''}
      </Text>
    );
  }

  if (el.type === 'field') {
    return (
      <Text style={{
        fontSize: el.fontSize || meta.bodyFontSize,
        fontFamily: el.bold ? meta.fontBoldFamily : meta.fontFamily,
        color: el.fontSize && el.fontSize >= 10 ? '#1E40AF' : '#111827',
        textAlign: align === 'flex-start' ? 'left' : align === 'flex-end' ? 'right' : 'center',
      }}>
        {el.resolvedValue || ''}
      </Text>
    );
  }

  return null;
}

function TitleZone({ elements, meta, align }: {
  elements: PDFTitleElement[];
  meta: PDFDocument['meta'];
  align: 'flex-start' | 'center' | 'flex-end';
}) {
  const filtered = elements.filter(e => e.type !== 'empty');
  if (filtered.length === 0) return <View style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1, alignItems: align, justifyContent: 'center' }}>
      {filtered.map((el, i) => (
        <View key={i} style={{ marginBottom: i < filtered.length - 1 ? 1 : 0 }}>
          <TitleElement el={el} meta={meta} align={align} />
        </View>
      ))}
    </View>
  );
}

function TitleBarSection({ titleBar, meta }: { titleBar: PDFTitleBar; meta: PDFDocument['meta'] }) {
  const heightStyle = titleBar.heightMode === 'fixed'
    ? { height: titleBar.heightPt }
    : {};

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: titleBar.bgColor || '#FFFFFF',
        paddingHorizontal: 4,
        paddingVertical: 4,
        ...heightStyle,
        ...(titleBar.borderEnabled ? { borderBottom: `0.5pt solid ${titleBar.borderColor || '#D1D5DB'}` } : {}),
        marginBottom: 4,
      }}
      fixed={!titleBar.firstPageOnly}
    >
      <TitleZone elements={titleBar.left} meta={meta} align="flex-start" />
      <TitleZone elements={titleBar.center} meta={meta} align="center" />
      <TitleZone elements={titleBar.right} meta={meta} align="flex-end" />
    </View>
  );
}

function BannerSection({ banner, meta }: { banner: PDFBanner; meta: PDFDocument['meta'] }) {
  if (!banner.enabled) return null;

  const filledCells = banner.cells.filter(c => c.value || c.showLabel);
  if (filledCells.length === 0 && banner.cells.every(c => !c.value)) return null;

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: banner.bgColor || '#F3F4F6',
      height: banner.heightPt || 16,
      alignItems: 'center',
      paddingHorizontal: 6,
      marginBottom: 4,
      ...(banner.borderEnabled ? {
        borderTop: `0.3pt solid ${banner.borderColor || '#E5E7EB'}`,
        borderBottom: `0.3pt solid ${banner.borderColor || '#E5E7EB'}`,
      } : {}),
      borderRadius: 1,
    }}>
      {banner.cells.map((cell, i) => (
        <View key={i} style={{ flex: 1, flexDirection: 'row', justifyContent: i < 2 ? 'flex-start' : i >= 4 ? 'flex-end' : 'center' }}>
          {(cell.value || cell.showLabel) ? (
            <Text style={{ fontSize: meta.bodyFontSize, color: banner.textColor || '#374151', fontFamily: meta.fontFamily }}>
              {cell.showLabel && cell.label ? (
                <Text style={{ fontFamily: meta.fontBoldFamily }}>{cell.label} </Text>
              ) : null}
              {cell.value || '\u2014'}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function HeaderColumn({ fields }: { fields: PDFHeaderFieldValue[] }) {
  return (
    <View style={{ flex: 1, paddingHorizontal: 4 }}>
      {fields.map((f, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 2 }}>
          <Text style={{ fontSize: 6, color: '#6B7280', textTransform: 'uppercase', fontFamily: 'Helvetica-Bold', marginRight: 3, flexShrink: 0 }}>
            {f.label}:
          </Text>
          <Text style={{ fontSize: 8, color: '#111827' }}>{f.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function PDFHeaderSection({ doc }: { doc: PDFDocument }) {
  return (
    <View>
      <TitleBarSection titleBar={doc.titleBar} meta={doc.meta} />

      <View style={{ flexDirection: 'row', marginBottom: 5 }}>
        <HeaderColumn fields={doc.header.leftColumn} />
        <HeaderColumn fields={doc.header.middleColumn} />
        <HeaderColumn fields={doc.header.rightColumn} />
      </View>

      <BannerSection banner={doc.banner} meta={doc.meta} />

      {doc.meta.exchangeRateWarning && (
        <View style={{ backgroundColor: '#FEF3C7', padding: '2pt 6pt', marginBottom: 3, borderRadius: 1 }}>
          <Text style={{ fontSize: 6, color: '#92400E' }}>{doc.meta.exchangeRateWarning}</Text>
        </View>
      )}

      <View style={{ height: 1.5, backgroundColor: '#1E40AF', marginBottom: 6 }} />
    </View>
  );
}
