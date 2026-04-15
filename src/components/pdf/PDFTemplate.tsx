import { Document, Page, Text } from '@react-pdf/renderer';
import type { PDFDocument, PDFCondensedBody, PDFFullBody } from '../../lib/pdfAssembler';
import { getPageDimensions, PAGE_MARGINS } from './pdfStyles';
import { PDFHeaderSection } from './PDFHeaderSection';
import { PDFCondensedBodySection } from './PDFCondensedBody';
import { PDFFullViewBodySection } from './PDFFullViewBody';
import { PDFFooterSections } from './PDFFooterSection';

export function QuotePDFTemplate({ pdfDocument }: { pdfDocument: PDFDocument }): React.ReactElement {
  const { meta } = pdfDocument;
  const dims = getPageDimensions(meta.pageSize, meta.orientation);

  return (
    <Document>
      <Page
        size={dims}
        style={{
          fontFamily: meta.fontFamily || 'Helvetica',
          fontSize: meta.bodyFontSize || 7,
          color: '#111827',
          paddingTop: PAGE_MARGINS.top,
          paddingBottom: PAGE_MARGINS.bottom + 14,
          paddingLeft: PAGE_MARGINS.left,
          paddingRight: PAGE_MARGINS.right,
        }}
        wrap
      >
        <PDFHeaderSection doc={pdfDocument} />

        {meta.viewType === 'condensed' ? (
          <PDFCondensedBodySection body={pdfDocument.body as PDFCondensedBody} meta={meta} />
        ) : (
          <PDFFullViewBodySection body={pdfDocument.body as PDFFullBody} meta={meta} />
        )}

        <PDFFooterSections sections={pdfDocument.footer.sections} meta={meta} />

        <Text
          style={{
            position: 'absolute',
            bottom: 10,
            right: 20,
            fontSize: Math.max(meta.bodyFontSize - 1, 5),
            color: '#9CA3AF',
            fontFamily: meta.fontFamily || 'Helvetica',
          }}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
