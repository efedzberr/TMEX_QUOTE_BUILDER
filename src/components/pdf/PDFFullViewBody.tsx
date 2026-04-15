import { View, Text } from '@react-pdf/renderer';
import type { PDFFullBody as FullBodyType, PDFLaneBlock, PDFHeaderFieldValue, PDFAccessorialItem, PDFDocument } from '../../lib/pdfAssembler';
import { resolveTextColor, lightenColor } from './pdfStyles';

type Meta = PDFDocument['meta'];

function SectionBlock({ title, bgColor, fontColor, fields, accessorials, accLabel, comments, commentsLabel, meta }: {
  title: string;
  bgColor: string;
  fontColor?: string;
  fields: PDFHeaderFieldValue[];
  accessorials?: PDFAccessorialItem[];
  accLabel?: string;
  comments?: string;
  commentsLabel?: string;
  meta: Meta;
}) {
  if (fields.length === 0 && !comments) return null;

  const textColor = fontColor || resolveTextColor(bgColor);
  const lightBg = lightenColor(bgColor);
  const fieldCount = Math.min(fields.length, 9);
  const colWidthPct = fieldCount > 0 ? `${100 / fieldCount}%` : '100%';

  return (
    <View>
      <View style={{ backgroundColor: bgColor || '#1E40AF', padding: '3pt 4pt' }}>
        <Text style={{ fontSize: meta.bodyFontSize, fontFamily: meta.fontBoldFamily, color: textColor, textTransform: 'uppercase' }}>{title}</Text>
      </View>

      {fields.length > 0 && (
        <>
          <View style={{ flexDirection: 'row', backgroundColor: bgColor || '#1E40AF' }}>
            {fields.slice(0, 9).map((f, i) => (
              <View key={i} style={{ width: colWidthPct, padding: '2pt 3pt', borderRight: '0.3pt solid rgba(255,255,255,0.2)' }}>
                <Text style={{ fontSize: meta.bodyFontSize - 1, fontFamily: meta.fontBoldFamily, color: textColor, textTransform: 'uppercase' }}>{f.label}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', borderBottom: '0.3pt solid #E5E7EB' }}>
            {fields.slice(0, 9).map((f, i) => (
              <View key={i} style={{ width: colWidthPct, padding: '2pt 3pt', borderRight: '0.3pt solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
                <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily }}>{f.value}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {accessorials && accessorials.length > 0 && (
        <View>
          <View style={{ backgroundColor: lightBg, padding: '2pt 4pt' }}>
            <Text style={{ fontSize: meta.bodyFontSize - 1, fontFamily: meta.fontBoldFamily, color: textColor === '#FFFFFF' ? '#374151' : textColor, textTransform: 'uppercase' }}>{accLabel}</Text>
          </View>
          {accessorials.map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 1.5, borderBottom: '0.3pt solid #E5E7EB', backgroundColor: '#FFFFFF' }}>
              <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily }}>{a.name}</Text>
              <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily, textAlign: 'right' }}>{a.rate}</Text>
            </View>
          ))}
        </View>
      )}

      {comments && (
        <View>
          <View style={{ backgroundColor: '#F3F4F6', padding: '2pt 4pt' }}>
            <Text style={{ fontSize: meta.bodyFontSize - 1, fontFamily: meta.fontBoldFamily, color: '#374151', textTransform: 'uppercase' }}>{commentsLabel || 'COMMENTS'}</Text>
          </View>
          <View style={{ padding: '3pt 6pt', backgroundColor: '#FFFFFF' }}>
            <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily }}>{comments}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function LaneBlock({ block, meta }: { block: PDFLaneBlock; meta: Meta }) {
  return (
    <View style={{ border: '0.5pt solid #D1D5DB', marginBottom: 8 }} wrap={false}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 45, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', padding: '4pt 2pt' }}>
          <Text style={{ fontSize: meta.bodyFontSize, fontFamily: meta.fontBoldFamily, color: '#374151', textAlign: 'center' }}>LANE {block.laneLabel.laneNumber}</Text>
          <Text style={{ fontSize: meta.bodyFontSize - 1, color: '#6B7280', textAlign: 'center', marginTop: 1, fontFamily: meta.fontFamily }}>{block.laneLabel.serviceType}</Text>
          <Text style={{ fontSize: meta.bodyFontSize - 1, color: '#6B7280', textAlign: 'center', fontFamily: meta.fontFamily }}>{block.laneLabel.tripType}</Text>
        </View>

        <View style={{ flex: 1 }}>
          {block.generalSection.visible && (
            <SectionBlock
              title="GENERAL INFORMATION"
              bgColor={block.sectionColors.general}
              fontColor={block.sectionFontColors?.general}
              fields={block.generalSection.fields}
              meta={meta}
            />
          )}
          {block.usSection.visible && (
            <SectionBlock
              title="US SECTION"
              bgColor={block.sectionColors.us}
              fontColor={block.sectionFontColors?.us}
              fields={block.usSection.fields}
              accessorials={block.usSection.accessorials}
              accLabel="US ACCESSORIALS"
              meta={meta}
            />
          )}
          {block.mxSection.visible && (
            <SectionBlock
              title="MX SECTION"
              bgColor={block.sectionColors.mx}
              fontColor={block.sectionFontColors?.mx}
              fields={block.mxSection.fields}
              accessorials={block.mxSection.accessorials}
              accLabel="MX ACCESSORIALS"
              meta={meta}
            />
          )}
          {block.additionalSection.visible && (
            <SectionBlock
              title="ADDITIONAL INFORMATION"
              bgColor={block.sectionColors.additional}
              fontColor={block.sectionFontColors?.additional}
              fields={block.additionalSection.fields}
              comments={block.additionalSection.comments || undefined}
              commentsLabel="COMMENTS"
              meta={meta}
            />
          )}
        </View>
      </View>
    </View>
  );
}

export function PDFFullViewBodySection({ body, meta }: { body: FullBodyType; meta: Meta }) {
  return (
    <View>
      {body.laneBlocks.map((block, idx) => (
        <LaneBlock key={idx} block={block} meta={meta} />
      ))}
    </View>
  );
}
