export type Row = Record<string, unknown>;

export function safeNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(n) ? 0 : n;
}

export function calcStats(values: number[]): { max: number; avg: number; min: number } | null {
  const valid = values.filter(v => v > 0);
  if (valid.length === 0) return null;
  const max = Math.max(...valid);
  const min = Math.min(...valid);
  const avg = valid.reduce((s, v) => s + v, 0) / valid.length;
  return { max, avg, min };
}

export function splitByCustomer(rows: Row[], partnerAccount: string): { same: Row[]; others: Row[] } {
  if (!partnerAccount) return { same: [], others: rows };
  const same: Row[] = [];
  const others: Row[] = [];
  for (const row of rows) {
    const pa = String(row['Parent Account'] || '');
    if (pa.toLowerCase() === partnerAccount.toLowerCase()) {
      same.push(row);
    } else {
      others.push(row);
    }
  }
  return { same, others };
}

export function getMonthLabels(dateRange: string): string[] {
  const months: string[] = [];
  const now = new Date();
  let count = 12;
  if (dateRange === 'Last 3 months') count = 3;
  else if (dateRange === 'Last 6 months') count = 6;
  else if (dateRange === 'Last 12 months') count = 12;
  else count = 24;

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleString('en-US', { month: 'short', year: '2-digit' }));
  }
  return months;
}

export function getMonthKey(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
}

function resolveDateStr(row: Row, dateField: string): string {
  const primary = String(row[dateField] || '');
  if (primary) return primary;
  return String(row['Effective From Date'] || row['Effective Date'] || '');
}

export function groupByMonth(rows: Row[], dateField: string, valueExtractor: (r: Row) => number, monthLabels: string[]): number[] {
  const buckets: Record<string, number[]> = {};
  for (const label of monthLabels) buckets[label] = [];

  for (const row of rows) {
    const key = getMonthKey(resolveDateStr(row, dateField));
    if (key && buckets[key] !== undefined) {
      const val = valueExtractor(row);
      if (val > 0) buckets[key].push(val);
    }
  }

  return monthLabels.map(label => {
    const vals = buckets[label];
    if (vals.length === 0) return 0;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  });
}

export function countByMonth(rows: Row[], dateField: string, monthLabels: string[]): number[] {
  const buckets: Record<string, number> = {};
  for (const label of monthLabels) buckets[label] = 0;

  for (const row of rows) {
    const key = getMonthKey(resolveDateStr(row, dateField));
    if (key && buckets[key] !== undefined) {
      buckets[key]++;
    }
  }

  return monthLabels.map(label => buckets[label]);
}
