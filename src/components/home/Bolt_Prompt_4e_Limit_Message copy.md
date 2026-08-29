Small fix to the KPI Tiles strip: when the user already has 8 KPIs, clicking the chart button in the toolbar or "+ Add KPI" in the strip must NOT open the modal; it shows a toast explaining the limit instead. Also, the modal error message must show the real reason when saving fails.

Apply ONLY the targeted find/replace edits below. Do NOT rewrite any file in full. Do NOT append any `export { ... }` statement to any file. Do NOT modify any other file.

## File 1: `src/components/kpi/KpiStrip.tsx` (4 edits)

### 1.1
Find:
```
import { useCallback, useEffect, useState } from 'react';
```
Replace with:
```
import { useCallback, useEffect, useRef, useState } from 'react';
```

### 1.2
Find:
```
  const [deleteTarget, setDeleteTarget] = useState<KpiTileData | null>(null);
```
Replace with:
```
  const [deleteTarget, setDeleteTarget] = useState<KpiTileData | null>(null);
  const tilesRef = useRef<KpiTileData[]>([]);
  tilesRef.current = tiles;

  const requestAdd = useCallback(() => {
    if (tilesRef.current.length >= KPI_MAX_TILES) {
      onError?.(`You've reached the limit of ${KPI_MAX_TILES} KPIs. Delete one to add a new one.`);
      return;
    }
    setModalTile('new');
  }, [onError]);
```

### 1.3
Find:
```
  useEffect(() => { if (addRequestId > 0) setModalTile('new'); }, [addRequestId]);
```
Replace with:
```
  useEffect(() => { if (addRequestId > 0) requestAdd(); }, [addRequestId, requestAdd]);
```

### 1.4
Find:
```
          <button
            onClick={() => setModalTile('new')}
            disabled={atMax}
            title={atMax ? `Maximum of ${KPI_MAX_TILES} KPIs` : 'Add KPI'}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
```
Replace with:
```
          <button
            onClick={requestAdd}
            title={atMax ? `Limit of ${KPI_MAX_TILES} KPIs reached` : 'Add KPI'}
            className={`flex items-center gap-1 text-xs font-medium ${atMax ? 'text-gray-400 hover:text-gray-500' : 'text-blue-600 hover:text-blue-700'}`}
          >
```

## File 2: `src/components/kpi/KpiTileModal.tsx` (1 edit)

Find:
```
      const msg = err instanceof Error ? err.message : '';
      setError(msg.includes('Maximum of 8') ? 'Maximum of 8 KPI tiles per strip reached.' : "We couldn't save the KPI tile.");
```
Replace with:
```
      const msg = String((err as { message?: string } | null)?.message ?? '');
      if (msg.includes('Maximum of 8')) setError('You\'ve reached the limit of 8 KPIs. Delete one to add a new one.');
      else if (msg.includes('row-level security')) setError("You don't have permission to save this KPI.");
      else setError(`We couldn't save the KPI tile.${msg ? ` (${msg})` : ''}`);
```

## Verify
1. Confirm all 5 edits applied (search for `requestAdd` — it must appear 4 times in KpiStrip.tsx).
2. Confirm no file ends with an `export { ... }` statement.
3. Run `npm run build` and confirm it succeeds.
