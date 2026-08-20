import { FIELD_CATALOG_MAP, FieldDataType } from './quoteFieldCatalog';

export interface FilterCriterion {
  id: string;
  field: string;
  operator: string;
  value: string;
}

export type OwnerScope = 'all' | 'mine';

export const TEXT_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equal', label: 'not equal to' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'starts_with', label: 'starts with' },
];

export const NUMBER_OPERATORS = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '\u2260' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '\u2264' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '\u2265' },
];

export const DATE_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'before', label: 'before' },
  { value: 'after', label: 'after' },
  { value: 'on_or_before', label: 'on or before' },
  { value: 'on_or_after', label: 'on or after' },
];

export const PICKLIST_OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equal', label: 'not equal to' },
];

export function getOperatorsForType(dataType: FieldDataType) {
  switch (dataType) {
    case 'text': return TEXT_OPERATORS;
    case 'number':
    case 'currency': return NUMBER_OPERATORS;
    case 'date':
    case 'datetime': return DATE_OPERATORS;
    case 'picklist':
    case 'user': return PICKLIST_OPERATORS;
    default: return TEXT_OPERATORS;
  }
}

export const STAGE_VALUES = ['New', 'In Progress', 'Completed', 'Branch Manager Approval', 'Sent to Customer', 'Published'];
export const STATUS_VALUES = ['New', 'In Progress', 'Completed', 'Published'];
export const CURRENCY_VALUES = ['USD', 'MXN', 'CAD'];
export const OPPORTUNITY_TYPE_VALUES = ['New Business', 'Renewal', 'Expansion'];

export function getPicklistValues(field: string): string[] | null {
  switch (field) {
    case 'stage': return STAGE_VALUES;
    case 'status': return STATUS_VALUES;
    case 'currency': return CURRENCY_VALUES;
    case 'opportunity_type': return OPPORTUNITY_TYPE_VALUES;
    case 'customer_review_status': return ['pending', 'accepted', 'rejected', 'negotiate', 'mixed', 'expired'];
    default: return null;
  }
}

const SEARCH_FIELDS = [
  'generated_quote_name', 'quote_number', 'bill_to_customer', 'shipper',
  'opportunity', 'partner_account', 'owner_name', 'stage', 'status',
];

function getFieldValue(record: Record<string, unknown>, field: string, computeTotalAmount?: (id: string) => number): unknown {
  if (field === 'total_amount' && computeTotalAmount) {
    return computeTotalAmount(record.id as string);
  }
  return record[field];
}

function evaluateCriterion(record: Record<string, unknown>, criterion: FilterCriterion, computeTotalAmount?: (id: string) => number): boolean {
  const fieldDef = FIELD_CATALOG_MAP.get(criterion.field);
  if (!fieldDef) return true;

  const raw = getFieldValue(record, criterion.field, computeTotalAmount);
  const val = criterion.value;

  if (fieldDef.dataType === 'text' || fieldDef.dataType === 'user') {
    const s = (raw == null ? '' : String(raw)).toLowerCase();
    const v = val.toLowerCase();
    switch (criterion.operator) {
      case 'equals': return s === v;
      case 'not_equal': return s !== v;
      case 'contains': return s.includes(v);
      case 'not_contains': return !s.includes(v);
      case 'starts_with': return s.startsWith(v);
      default: return true;
    }
  }

  if (fieldDef.dataType === 'number' || fieldDef.dataType === 'currency') {
    const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
    const v = parseFloat(val);
    if (isNaN(n) || isNaN(v)) return false;
    switch (criterion.operator) {
      case 'eq': return n === v;
      case 'neq': return n !== v;
      case 'lt': return n < v;
      case 'lte': return n <= v;
      case 'gt': return n > v;
      case 'gte': return n >= v;
      default: return true;
    }
  }

  if (fieldDef.dataType === 'date' || fieldDef.dataType === 'datetime') {
    const d = new Date(String(raw ?? ''));
    const v = new Date(val);
    if (isNaN(d.getTime()) || isNaN(v.getTime())) return false;
    const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const vDay = new Date(v.getFullYear(), v.getMonth(), v.getDate()).getTime();
    switch (criterion.operator) {
      case 'equals': return dDay === vDay;
      case 'before': return dDay < vDay;
      case 'after': return dDay > vDay;
      case 'on_or_before': return dDay <= vDay;
      case 'on_or_after': return dDay >= vDay;
      default: return true;
    }
  }

  if (fieldDef.dataType === 'picklist') {
    const s = (raw == null ? '' : String(raw)).toLowerCase();
    const v = val.toLowerCase();
    switch (criterion.operator) {
      case 'equals': return s === v;
      case 'not_equal': return s !== v;
      default: return true;
    }
  }

  return true;
}

// --- Filter logic parser/evaluator ---

export function validateFilterLogic(expression: string, criteriaCount: number): string | null {
  if (!expression.trim()) return null;
  const tokens = tokenize(expression);
  if (!tokens) return 'Invalid characters in expression.';

  const referencedNumbers = new Set<number>();
  let parenDepth = 0;
  let expectOperand = true;

  for (const token of tokens) {
    if (token === '(') {
      parenDepth++;
      continue;
    }
    if (token === ')') {
      parenDepth--;
      if (parenDepth < 0) return 'Unbalanced parentheses.';
      expectOperand = false;
      continue;
    }
    const upper = token.toUpperCase();
    if (upper === 'AND' || upper === 'OR') {
      if (expectOperand) return `Unexpected "${token}" — expected a filter number.`;
      expectOperand = true;
      continue;
    }
    const num = parseInt(token, 10);
    if (isNaN(num)) return `"${token}" is not a valid token. Use filter numbers, AND, OR, and parentheses.`;
    if (num < 1 || num > criteriaCount) return `Filter #${num} does not exist. You have ${criteriaCount} filter(s).`;
    referencedNumbers.add(num);
    expectOperand = false;
  }

  if (parenDepth !== 0) return 'Unbalanced parentheses.';
  if (expectOperand) return 'Expression ends unexpectedly.';
  return null;
}

function tokenize(expr: string): string[] | null {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === ' ' || expr[i] === '\t') { i++; continue; }
    if (expr[i] === '(' || expr[i] === ')') { tokens.push(expr[i]); i++; continue; }
    let word = '';
    while (i < expr.length && expr[i] !== ' ' && expr[i] !== '(' && expr[i] !== ')') {
      word += expr[i]; i++;
    }
    if (word) tokens.push(word);
  }
  return tokens.length > 0 ? tokens : null;
}

function evaluateLogicExpression(expression: string, results: Map<number, boolean>): boolean {
  const tokens = tokenize(expression);
  if (!tokens) return true;
  return parseOr(tokens, { pos: 0 }, results);
}

function parseOr(tokens: string[], ctx: { pos: number }, results: Map<number, boolean>): boolean {
  let left = parseAnd(tokens, ctx, results);
  while (ctx.pos < tokens.length && tokens[ctx.pos]?.toUpperCase() === 'OR') {
    ctx.pos++;
    const right = parseAnd(tokens, ctx, results);
    left = left || right;
  }
  return left;
}

function parseAnd(tokens: string[], ctx: { pos: number }, results: Map<number, boolean>): boolean {
  let left = parsePrimary(tokens, ctx, results);
  while (ctx.pos < tokens.length && tokens[ctx.pos]?.toUpperCase() === 'AND') {
    ctx.pos++;
    const right = parsePrimary(tokens, ctx, results);
    left = left && right;
  }
  return left;
}

function parsePrimary(tokens: string[], ctx: { pos: number }, results: Map<number, boolean>): boolean {
  if (tokens[ctx.pos] === '(') {
    ctx.pos++;
    const val = parseOr(tokens, ctx, results);
    if (tokens[ctx.pos] === ')') ctx.pos++;
    return val;
  }
  const num = parseInt(tokens[ctx.pos], 10);
  ctx.pos++;
  return results.get(num) ?? true;
}

// --- Main composable filter function ---

export interface ComposedFilterInput {
  records: Record<string, unknown>[];
  ownerScope: OwnerScope;
  userId: string | null;
  criteria: FilterCriterion[];
  filterLogic: string;
  searchTerm: string;
  computeTotalAmount?: (id: string) => number;
}

export function applyComposedFilters(input: ComposedFilterInput): Record<string, unknown>[] {
  let results = input.records;

  // 1. Owner scope
  if (input.ownerScope === 'mine' && input.userId) {
    results = results.filter(r => r.owner_user_id === input.userId);
  }

  // 2. Criteria filters
  if (input.criteria.length > 0) {
    const hasLogic = input.filterLogic.trim().length > 0;
    results = results.filter(record => {
      if (hasLogic) {
        const criteriaResults = new Map<number, boolean>();
        input.criteria.forEach((c, i) => {
          criteriaResults.set(i + 1, evaluateCriterion(record, c, input.computeTotalAmount));
        });
        return evaluateLogicExpression(input.filterLogic, criteriaResults);
      } else {
        return input.criteria.every(c => evaluateCriterion(record, c, input.computeTotalAmount));
      }
    });
  }

  // 3. Search
  if (input.searchTerm.trim()) {
    const term = input.searchTerm.trim().toLowerCase();
    results = results.filter(record => {
      return SEARCH_FIELDS.some(field => {
        const val = record[field];
        if (val == null) return false;
        return String(val).toLowerCase().includes(term);
      });
    });
  }

  return results;
}

export function rewriteFilterLogicOnRemove(expression: string, removedIndex: number, totalBefore: number): string | null {
  if (!expression.trim()) return '';
  const tokens = tokenize(expression);
  if (!tokens) return '';

  const newTokens: string[] = [];
  for (const token of tokens) {
    const num = parseInt(token, 10);
    if (!isNaN(num)) {
      if (num === removedIndex) return null; // can't rewrite
      const newNum = num > removedIndex ? num - 1 : num;
      newTokens.push(String(newNum));
    } else {
      newTokens.push(token);
    }
  }

  const rewritten = newTokens.join(' ');
  const err = validateFilterLogic(rewritten, totalBefore - 1);
  if (err) return null;
  return rewritten;
}
