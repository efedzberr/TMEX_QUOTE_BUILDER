import { pdf } from '@react-pdf/renderer';
import { QuotePDFTemplate } from '../components/pdf/PDFTemplate';
import type { PDFDocument } from './pdfAssembler';
import type { Quote } from './supabase';
import type { AttachedFile } from './pdfConfigTypes';

async function mergeAttachedFiles(mainBlob: Blob, files: AttachedFile[]): Promise<Blob> {
  const { PDFDocument: PDFLib } = await import('pdf-lib');
  const mainBytes = new Uint8Array(await mainBlob.arrayBuffer());
  const mergedPdf = await PDFLib.load(mainBytes);

  const sorted = [...files].sort((a, b) => a.order - b.order);
  for (const file of sorted) {
    try {
      const fileBytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
      const attachedPdf = await PDFLib.load(fileBytes);
      const pages = await mergedPdf.copyPages(attachedPdf, attachedPdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    } catch (err) {
      console.error(`Failed to merge attached file "${file.name}":`, err);
    }
  }

  const mergedBytes = await mergedPdf.save();
  return new Blob([mergedBytes], { type: 'application/pdf' });
}

export async function generatePdfBlob(
  pdfDocument: PDFDocument,
  attachedFiles?: AttachedFile[],
  attachmentsEnabled?: boolean,
): Promise<Blob> {
  const blob = await pdf(
    <QuotePDFTemplate pdfDocument={pdfDocument} />
  ).toBlob();

  if (!attachmentsEnabled || !attachedFiles || attachedFiles.length === 0) {
    return blob;
  }

  try {
    return await mergeAttachedFiles(blob, attachedFiles);
  } catch (err) {
    console.error('Failed to merge attached PDF files:', err);
    return blob;
  }
}

export function buildPdfFileName(quote: Quote): string {
  const date = new Date();
  const dateStr = [
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getFullYear()),
  ].join('');

  const accountName = quote.partner_account
    ?.replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 20)
    .toUpperCase() || 'QUOTE';

  return `${quote.quote_number || 'QUOTE'}_${accountName}_${dateStr}.pdf`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function openBlobInNewTab(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateForPdfGeneration(
  lanes: Quote[],
  headerLeft: any[],
  headerMiddle: any[],
  headerRight: any[],
  viewType: string,
  condensedColumns: any[],
  fullViewSections: any
): ValidationResult {
  if (!lanes || lanes.length === 0) {
    return { valid: false, error: 'This quote has no lanes. Please add at least one lane before generating a PDF.' };
  }

  const totalHeaderFields = (headerLeft?.length || 0) + (headerMiddle?.length || 0) + (headerRight?.length || 0);
  if (totalHeaderFields === 0) {
    return { valid: false, error: 'No header fields configured. Please add at least one header field.' };
  }

  if (viewType === 'condensed') {
    if (!condensedColumns || condensedColumns.length === 0) {
      return { valid: false, error: 'No columns selected for Condensed view. Please add at least one column.' };
    }
  } else {
    const sections = fullViewSections || {};
    const hasVisibleField = ['general', 'us', 'mx', 'additional'].some(
      key => Array.isArray(sections[key]) && sections[key].some((f: any) => f.visible)
    );
    if (!hasVisibleField) {
      return { valid: false, error: 'No sections enabled for Full view. Please enable at least one section field.' };
    }
  }

  return { valid: true };
}
