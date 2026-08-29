Phase 1 of Roles & Permissions, step 3: hide sections of the quote detail page the user cannot view. `usePermissions()` (from `src/lib/permissions.tsx`) already exists and exposes `can(key)`.

- `quote.header` → `QuoteHeader` block
- `quote.history` → `QuoteHistory` block
- `quote.tab_lanes`, `quote.tab_accessorials`, `quote.tab_terms`, `quote.tab_pdf` → the four tabs in `QuoteTabs`. The first visible tab is the default; if no tab is visible the tabs block is not rendered at all.

Apply ONLY the targeted find/replace edits below. Do NOT rewrite any file in full. Do NOT append any `export { ... }` statement to any file. Do NOT modify any file other than the 2 listed.

## File 1: `src/App.tsx` — 3 edits

### 1.1
Find:
```
  const { canView, loading: permissionsLoading } = usePermissions();
```
Replace with:
```
  const { can, canView, loading: permissionsLoading } = usePermissions();
```

### 1.2
Find:
```
          <QuoteHeader
            quote={quote}
```
Replace with:
```
          {can('quote.header') && (
          <QuoteHeader
            quote={quote}
```

### 1.3
Find:
```
          />

          <QuoteHistory history={history} />

          <QuoteTabs
```
Replace with:
```
          />
          )}

          {can('quote.history') && <QuoteHistory history={history} />}

          <QuoteTabs
```

## File 2: `src/components/QuoteTabs.tsx` — 2 edits

### 2.1
Find:
```
import { useState, useEffect } from 'react';
```
Replace with:
```
import { useState, useEffect } from 'react';
import { usePermissions } from '../lib/permissions';
```

### 2.2
Find:
```
  const [activeTab, setActiveTab] = useState<'lanes' | 'accessorials' | 'terms' | 'pdf'>('lanes');

  const tabs = [
    { id: 'lanes' as const, label: 'Quote Lanes' },
    { id: 'accessorials' as const, label: 'Accessorials' },
    { id: 'terms' as const, label: 'Terms & Conditions' },
    { id: 'pdf' as const, label: 'PDF Quote' },
  ];

  return (
```
Replace with:
```
  const { can } = usePermissions();

  const tabs = [
    { id: 'lanes' as const, label: 'Quote Lanes', permission: 'quote.tab_lanes' as const },
    { id: 'accessorials' as const, label: 'Accessorials', permission: 'quote.tab_accessorials' as const },
    { id: 'terms' as const, label: 'Terms & Conditions', permission: 'quote.tab_terms' as const },
    { id: 'pdf' as const, label: 'PDF Quote', permission: 'quote.tab_pdf' as const },
  ].filter(t => can(t.permission));

  const [activeTab, setActiveTab] = useState<'lanes' | 'accessorials' | 'terms' | 'pdf'>(tabs[0]?.id ?? 'lanes');

  // Keep the active tab valid when permissions load or change
  useEffect(() => {
    if (tabs.length > 0 && !tabs.some(t => t.id === activeTab)) setActiveTab(tabs[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs.map(t => t.id).join(',')]);

  if (tabs.length === 0) return null;

  return (
```

## Verify
1. All 5 edits applied: `can('quote.header')` and `can('quote.history')` appear in App.tsx; `usePermissions` and `quote.tab_pdf` appear in QuoteTabs.tsx.
2. No file ends with an `export { ... }` statement.
3. Run `npm run build` and confirm it succeeds. Do not fix unrelated pre-existing TypeScript warnings.
