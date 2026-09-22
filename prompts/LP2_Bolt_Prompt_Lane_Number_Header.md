# LP2 — Bolt prompt: lane number in the detail panel header

Anchors extracted from zip #32. Copy everything below the line into Bolt as ONE prompt.

---

Show the lane's position in the quote (the `#` column of the grid) in the detail panel's header banner, as the first badge: "Lane 9 of 9". Two files. Do NOT append any `export` statement. Use real Unicode characters in JSX.

## 1. `src/components/LaneDetailsPanel.tsx`

Find exactly:
```
  hasNextLane?: boolean;
```
Replace with:
```
  hasNextLane?: boolean;
  /** 1-based position of this lane in the quote's lane list, and the total count */
  laneNumber?: number;
  laneCount?: number;
```

Find exactly:
```
export function LaneDetailsPanel({ lane, pairedLane, currency = 'USD', quote, locked = false, onClose, onSave, onChangeCurrency, onNextLane, hasNextLane, onPreviousLane, hasPreviousLane, onUpdatePairedLaneBCO, onBenchmark: _onBenchmark }: LaneDetailsPanelProps) {
```
Replace with:
```
export function LaneDetailsPanel({ lane, pairedLane, currency = 'USD', quote, locked = false, onClose, onSave, onChangeCurrency, onNextLane, hasNextLane, onPreviousLane, hasPreviousLane, onUpdatePairedLaneBCO, onBenchmark: _onBenchmark, laneNumber, laneCount }: LaneDetailsPanelProps) {
```

Find exactly:
```
              <span>{bannerText}</span>
              {tripType && (
```
Replace with:
```
              {laneNumber != null && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide" style={{ background: 'rgba(255,255,255,0.28)' }}>
                  Lane {laneNumber}{laneCount ? ` of ${laneCount}` : ''}
                </span>
              )}
              <span>{bannerText}</span>
              {tripType && (
```

## 2. `src/App.tsx`

Find exactly:
```
          <LaneDetailsPanel
            lane={currentLane}
            pairedLane={paired}
```
Replace with:
```
          <LaneDetailsPanel
            lane={currentLane}
            laneNumber={currentIndex !== -1 ? currentIndex + 1 : undefined}
            laneCount={lanes.length}
            pairedLane={paired}
```

## Verification

- `npm run build` passes.
- Open lane #9 of a quote with 9 lanes: the banner reads "Lane 9 of 9 · Door to Door — One Way · One Way"; Previous Lane changes it to "Lane 8 of 9". The existing "Lane 1 of 2" pair badge still appears on Round Trip / Circuit / Split Billing lanes after the trip type badge.
