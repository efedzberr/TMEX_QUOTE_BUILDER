export interface KpiColor {
  index: number;
  name: string;
  hex: string;
}

/** 16-color palette for KPI tiles. Index is what gets persisted in kpi_tiles.color. */
export const KPI_PALETTE: KpiColor[] = [
  { index: 0, name: 'Navy', hex: '#0F2A5C' },
  { index: 1, name: 'Royal Blue', hex: '#1D4ED8' },
  { index: 2, name: 'Sky', hex: '#0EA5E9' },
  { index: 3, name: 'Teal', hex: '#0D9488' },
  { index: 4, name: 'Green', hex: '#16A34A' },
  { index: 5, name: 'Lime', hex: '#65A30D' },
  { index: 6, name: 'Gold', hex: '#D4A017' },
  { index: 7, name: 'Amber', hex: '#F59E0B' },
  { index: 8, name: 'Orange', hex: '#EA580C' },
  { index: 9, name: 'Red', hex: '#DC2626' },
  { index: 10, name: 'Rose', hex: '#E11D48' },
  { index: 11, name: 'Pink', hex: '#DB2777' },
  { index: 12, name: 'Purple', hex: '#7C3AED' },
  { index: 13, name: 'Indigo', hex: '#4F46E5' },
  { index: 14, name: 'Slate', hex: '#475569' },
  { index: 15, name: 'Grey', hex: '#9CA3AF' },
];

export function kpiColorHex(index: number): string {
  return KPI_PALETTE[index]?.hex ?? KPI_PALETTE[0].hex;
}

/** Light tint of a hex color for the active-tile background. */
export function kpiColorTint(hex: string, alpha = 0.08): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
