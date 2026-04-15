import { View, Text } from '@react-pdf/renderer';
import type { PDFCondensedBody as CondensedBodyType, PDFCondensedRow, PDFDocument } from '../../lib/pdfAssembler';
import { getColumnGroupColor, isRightAligned } from './pdfStyles';

type Meta = PDFDocument['meta'];

function BadgeCell({ row, meta }: { row: PDFCondensedRow; meta: Meta }) {
  const badge = row.badge;
  let badgeColor = '#3B82F6';
  const svc = (badge.serviceType || '').toLowerCase();
  if (svc.includes('loop')) badgeColor = '#3B82F6';
  else if (svc.includes('door') || svc.includes('d2d')) badgeColor = '#22C55E';
  else if (svc.includes('domestic')) badgeColor = '#8B5CF6';

  let tripIcon = '\u2192';
  const trip = (badge.tripType || '').toLowerCase();
  if (trip.includes('round')) tripIcon = '\u21C4';
  else if (trip.includes('circuit')) tripIcon = '\u21BA';

  return (
    <View style={{ width: 25, padding: '1pt 2pt', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ backgroundColor: badgeColor, borderRadius: 2, padding: '2pt 3pt', alignItems: 'center', minWidth: 20 }}>
        <Text style={{ fontSize: meta.bodyFontSize, color: '#FFFFFF', fontFamily: meta.fontBoldFamily }}>{tripIcon}</Text>
        {badge.isSplit && (
          <Text style={{ fontSize: meta.bodyFontSize - 3, color: '#FFFFFF', marginTop: 0.5 }}>SPLIT</Text>
        )}
      </View>
    </View>
  );
}

export function PDFCondensedBodySection({ body, meta }: { body: CondensedBodyType; meta: Meta }) {
  if (body.columns.length === 0) return null;

  const colCount = body.columns.length;
  const availableWidth = 100 - 3.5 - 4.5;
  const colWidthPct = availableWidth / colCount;
  const hdrSize = meta.bodyFontSize - 1;

  return (
    <View>
      <View style={{ flexDirection: 'row', backgroundColor: '#1E40AF' }}>
        <View style={{ width: '3.5%', padding: '2pt 3pt' }}>
          <Text style={{ fontSize: hdrSize, color: '#FFFFFF', fontFamily: meta.fontBoldFamily, textTransform: 'uppercase' }}>#</Text>
        </View>
        <View style={{ width: '4.5%', padding: '2pt 2pt' }}>
          <Text style={{ fontSize: hdrSize, color: '#FFFFFF', fontFamily: meta.fontBoldFamily, textTransform: 'uppercase' }}>Type</Text>
        </View>
        {body.columns.map(col => (
          <View key={col.key} style={{ width: `${colWidthPct}%`, padding: '2pt 3pt', backgroundColor: getColumnGroupColor(col.key), borderRight: '0.3pt solid rgba(255,255,255,0.2)' }}>
            <Text style={{ fontSize: hdrSize, color: '#FFFFFF', fontFamily: meta.fontBoldFamily, textTransform: 'uppercase' }}>{col.label}</Text>
          </View>
        ))}
      </View>

      {body.rows.map((row, idx) => (
        <View key={idx} style={{ flexDirection: 'row', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB', borderBottom: '0.5pt solid #E5E7EB' }} wrap={false}>
          <View style={{ width: '3.5%', padding: '2pt 3pt' }}>
            <Text style={{ fontSize: meta.bodyFontSize, fontFamily: meta.fontBoldFamily, color: '#374151' }}>{row.laneNumber}</Text>
          </View>
          <View style={{ width: '4.5%' }}>
            <BadgeCell row={row} meta={meta} />
          </View>
          {body.columns.map(col => (
            <View key={col.key} style={{ width: `${colWidthPct}%`, padding: '2pt 3pt', borderRight: '0.3pt solid #E5E7EB' }}>
              <Text style={{ fontSize: meta.bodyFontSize, color: '#374151', fontFamily: meta.fontFamily, textAlign: isRightAligned(col.key) ? 'right' : 'left' }}>
                {row.cells[col.key] || '\u2014'}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
