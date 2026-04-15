import { View, Text } from '@react-pdf/renderer';
import type {
  PDFFooterSection as FooterSectionType,
  PDFFooterAccessorialSection,
  PDFFooterTermsSection,
  PDFFooterTextSection,
  PDFFooterAcceptanceSection,
  PDFDocument,
} from '../../lib/pdfAssembler';

type Meta = PDFDocument['meta'];

function AccessorialsSection({ section, meta }: { section: PDFFooterAccessorialSection; meta: Meta }) {
  const includedQuote = section.quoteLevel.items.filter(i => i.included);
  const hasLaneItems = section.laneLevel.some(ll => ll.usAccessorials.length > 0 || ll.mxAccessorials.length > 0);
  if (includedQuote.length === 0 && !hasLaneItems) return null;

  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontSize: meta.bodyFontSize, fontFamily: meta.fontBoldFamily, color: '#1E40AF', borderBottom: '0.5pt solid #1E40AF', marginBottom: 3, paddingBottom: 2, textTransform: 'uppercase' }}>{section.label}</Text>

      {includedQuote.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <Text style={{ fontSize: meta.bodyFontSize - 1, fontFamily: meta.fontBoldFamily, color: '#6B7280', marginBottom: 2 }}>{section.quoteLevel.label}</Text>
          <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', padding: '2pt 4pt', borderBottom: '0.3pt solid #E5E7EB' }}>
            <View style={{ flex: 3 }}>
              <Text style={{ fontSize: meta.bodyFontSize - 1, fontFamily: meta.fontBoldFamily, color: '#374151' }}>Name</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: meta.bodyFontSize - 1, fontFamily: meta.fontBoldFamily, color: '#374151' }}>Unit</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={{ fontSize: meta.bodyFontSize - 1, fontFamily: meta.fontBoldFamily, color: '#374151' }}>Rate</Text>
            </View>
          </View>
          {includedQuote.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', padding: '2pt 4pt', backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB', borderBottom: '0.3pt solid #E5E7EB' }}>
              <View style={{ flex: 3 }}>
                <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily }}>{item.name}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily }}>{item.unit}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily }}>{item.rate}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {section.laneLevel.length > 0 && (
        <View>
          <Text style={{ fontSize: meta.bodyFontSize - 1, fontFamily: meta.fontBoldFamily, color: '#6B7280', marginBottom: 2 }}>LANE ACCESSORIALS</Text>
          {section.laneLevel.map((ll, i) => (
            <View key={i} style={{ marginBottom: 3 }}>
              <View style={{ backgroundColor: '#EFF6FF', padding: '2pt 4pt' }}>
                <Text style={{ fontSize: meta.bodyFontSize - 1, fontFamily: meta.fontBoldFamily, color: '#1E40AF' }}>{ll.laneLabel}</Text>
              </View>
              {ll.usAccessorials.length > 0 && (
                <View style={{ paddingLeft: 6 }}>
                  <Text style={{ fontSize: meta.bodyFontSize - 1, fontStyle: 'italic', color: '#6B7280', marginVertical: 1 }}>US Section</Text>
                  {ll.usAccessorials.map((a, ai) => (
                    <View key={ai} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 1, borderBottom: '0.3pt solid #E5E7EB' }}>
                      <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily }}>{a.name}</Text>
                      <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily }}>{a.rate}</Text>
                    </View>
                  ))}
                </View>
              )}
              {ll.mxAccessorials.length > 0 && (
                <View style={{ paddingLeft: 6 }}>
                  <Text style={{ fontSize: meta.bodyFontSize - 1, fontStyle: 'italic', color: '#6B7280', marginVertical: 1 }}>MX Section</Text>
                  {ll.mxAccessorials.map((a, ai) => (
                    <View key={ai} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 1, borderBottom: '0.3pt solid #E5E7EB' }}>
                      <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily }}>{a.name}</Text>
                      <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily }}>{a.rate}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function TermsSection({ section, meta }: { section: PDFFooterTermsSection; meta: Meta }) {
  const included = section.items.filter(i => i.included);
  if (included.length === 0) return null;

  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontSize: meta.bodyFontSize, fontFamily: meta.fontBoldFamily, color: '#1E40AF', borderBottom: '0.5pt solid #1E40AF', marginBottom: 3, paddingBottom: 2, textTransform: 'uppercase' }}>{section.label}</Text>
      {included.map((item, i) => (
        <View key={i} style={{ marginBottom: 3, borderBottom: '0.3pt solid #E5E7EB', paddingBottom: 2 }}>
          <Text style={{ fontSize: meta.bodyFontSize, fontFamily: meta.fontBoldFamily, color: '#374151' }}>{item.name}</Text>
          {item.description && (
            <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily, paddingLeft: 8, marginTop: 1 }}>{item.description}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function TextSection({ section, titleColor, meta }: { section: PDFFooterTextSection; titleColor?: string; meta: Meta }) {
  const included = section.items.filter(i => i.included);
  if (included.length === 0) return null;

  const color = titleColor || '#1E40AF';

  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={{ fontSize: meta.bodyFontSize, fontFamily: meta.fontBoldFamily, color, borderBottom: `0.5pt solid ${color}`, marginBottom: 3, paddingBottom: 2, textTransform: 'uppercase' }}>{section.label}</Text>
      {included.map((item, i) => (
        <Text key={i} style={{ fontSize: meta.bodyFontSize, marginBottom: 2, paddingLeft: 8, fontFamily: meta.fontFamily }}>{'\u2022'} {item.text}</Text>
      ))}
    </View>
  );
}

function AcceptanceSection({ section, meta }: { section: PDFFooterAcceptanceSection; meta: Meta }) {
  const visibleFields = section.fields.filter(f => f.visible);
  if (visibleFields.length === 0) return null;

  const leftKeys = ['company', 'jobTitle', 'name'];
  const rightKeys = ['date', 'signature'];
  const leftFields = leftKeys
    .map(k => visibleFields.find(f => f.key === k))
    .filter(Boolean) as typeof visibleFields;
  const rightFields = rightKeys
    .map(k => visibleFields.find(f => f.key === k))
    .filter(Boolean) as typeof visibleFields;

  const maxRows = Math.max(leftFields.length, rightFields.length);
  const rightPositions: (number | null)[] = Array.from({ length: maxRows }, () => null);
  if (rightFields.length > 0) rightPositions[0] = 0;
  if (rightFields.length > 1 && maxRows > 1) rightPositions[maxRows - 1] = 1;

  const fs = meta.bodyFontSize;
  const rowGap = 14;

  return (
    <View wrap={false} style={{ marginTop: 8 }}>
      <View style={{ backgroundColor: section.headerColor || '#F59E0B', padding: '6pt 8pt', alignItems: 'center', height: 24, justifyContent: 'center' }}>
        <Text style={{ fontSize: fs + 1, fontFamily: meta.fontBoldFamily, color: '#FFFFFF', textTransform: 'uppercase' }}>{section.label}</Text>
      </View>
      <View style={{ paddingTop: 12, paddingBottom: 12, paddingHorizontal: 8, flexDirection: 'row', gap: 20 }}>
        <View style={{ flex: 6 }}>
          {leftFields.map((f, i) => (
            <View key={f.key} style={{ marginBottom: i < leftFields.length - 1 ? rowGap : 0 }}>
              <Text style={{ fontSize: fs, fontFamily: meta.fontBoldFamily, color: '#111827', textTransform: 'uppercase', marginBottom: 16 }}>{f.label}:</Text>
              <View style={{ borderBottom: '1pt solid #111827' }} />
            </View>
          ))}
        </View>
        <View style={{ flex: 4 }}>
          {Array.from({ length: maxRows }).map((_, rowIdx) => {
            const rIdx = rightPositions[rowIdx];
            const field = rIdx !== null ? rightFields[rIdx] : null;
            if (!field) {
              return <View key={`empty-${rowIdx}`} style={{ marginBottom: rowIdx < maxRows - 1 ? rowGap : 0, height: fs + 16 + 1 }} />;
            }
            return (
              <View key={field.key} style={{ marginBottom: rowIdx < maxRows - 1 ? rowGap : 0 }}>
                <Text style={{ fontSize: fs, fontFamily: meta.fontBoldFamily, color: '#111827', textTransform: 'uppercase', marginBottom: 16 }}>{field.label}:</Text>
                <View style={{ borderBottom: '1pt solid #111827' }} />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function PDFFooterSections({ sections, meta }: { sections: FooterSectionType[]; meta: Meta }) {
  const visible = sections.filter(s => s.visible);
  if (visible.length === 0) return null;

  return (
    <View style={{ marginTop: 8 }}>
      {visible.map((section, idx) => {
        const content = (() => {
          switch (section.type) {
            case 'accessorials':
              return <AccessorialsSection section={section} meta={meta} />;
            case 'terms':
              return <TermsSection section={section} meta={meta} />;
            case 'legends':
              return <TextSection section={section} meta={meta} />;
            case 'disclaimers':
              return <TextSection section={section} titleColor="#DC2626" meta={meta} />;
            case 'notes':
              return <TextSection section={section} titleColor="#1E40AF" meta={meta} />;
            case 'acceptance':
              return <AcceptanceSection section={section} meta={meta} />;
            default:
              return null;
          }
        })();

        if (!content) return null;

        return (
          <View key={idx} break={section.newPage === true}>
            {content}
          </View>
        );
      })}
    </View>
  );
}
