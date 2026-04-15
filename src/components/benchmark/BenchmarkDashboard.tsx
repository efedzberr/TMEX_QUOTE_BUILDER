import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { supabase, QuoteLane } from '../../lib/supabase';
import { CurrencyCode } from '../../lib/constants';
import { BenchmarkFilters, BenchmarkFilterValues } from './BenchmarkFilters';
import { BenchmarkCostStructure } from './BenchmarkCostStructure';
import { BenchmarkSuggestedPrice } from './BenchmarkSuggestedPrice';
import { RateComparisonTable } from './RateComparisonTable';
import { RpmDistributionChart } from './RpmDistributionChart';
import { HistoricalVolumeChart } from './HistoricalVolumeChart';
import { RateTrendChart } from './RateTrendChart';
import { PricePositioningPanel } from './PricePositioningPanel';
import { MarketSignalsPanel } from './MarketSignalsPanel';
import { BenchmarkSummaryBar } from './BenchmarkSummaryBar';
import { LaneInformationCard } from './LaneInformationCard';
import { ProjectedMarginGauge } from './ProjectedMarginGauge';
import { RateDeviationBar } from './RateDeviationBar';
import { computeAllSignals } from './signalEngine';

type Row = Record<string, unknown>;

interface BenchmarkDashboardProps {
  lane: QuoteLane;
  laneIndex: number;
  allLanes: QuoteLane[];
  partnerAccount: string;
  onBack: () => void;
  onLaneChange: (lane: QuoteLane) => void;
}

function getDateCutoff(range: string): string | null {
  const now = new Date();
  if (range === 'Last 3 months') {
    now.setMonth(now.getMonth() - 3);
    return now.toISOString().split('T')[0];
  }
  if (range === 'Last 6 months') {
    now.setMonth(now.getMonth() - 6);
    return now.toISOString().split('T')[0];
  }
  if (range === 'Last 12 months') {
    now.setFullYear(now.getFullYear() - 1);
    return now.toISOString().split('T')[0];
  }
  return null;
}

async function resolveMarketName(cityName: string): Promise<string | null> {
  if (!cityName) return null;
  const { data } = await supabase
    .from('cities')
    .select('market_name')
    .eq('city_name', cityName)
    .limit(1)
    .maybeSingle();
  return data?.market_name || null;
}

export function BenchmarkDashboard({ lane, laneIndex, allLanes, partnerAccount, onBack, onLaneChange }: BenchmarkDashboardProps) {
  const [filters, setFilters] = useState<BenchmarkFilterValues>({
    dateRange: 'Last 12 months',
    equipmentType: lane.equipment_type || 'All',
    tripType: lane.trip_type || 'All',
    marketRadius: 'Same Market',
  });

  const [accountLanes, setAccountLanes] = useState<Row[]>([]);
  const [costStructures, setCostStructures] = useState<Row[]>([]);
  const [marketInfo, setMarketInfo] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasFuelProgram, setHasFuelProgram] = useState(false);

  const curr = (lane.currency_code || 'USD') as CurrencyCode;
  const activeIndex = allLanes.findIndex(l => l.id === lane.id);
  const resolvedIndex = activeIndex >= 0 ? activeIndex : 0;

  const fetchAll = useCallback(async () => {
    setLoading(true);

    const originMarket = await resolveMarketName(lane.origin_city);
    const destMarket = await resolveMarketName(lane.destination_city);
    const dateCutoff = getDateCutoff(filters.dateRange);

    const [alData, csData, miData] = await Promise.all([
      fetchAccountLanes(lane, filters, originMarket, destMarket, dateCutoff),
      fetchCostStructures(lane, filters),
      fetchMarketInformation(lane, filters, originMarket, destMarket, dateCutoff),
    ]);
    setAccountLanes(alData);
    setCostStructures(csData);
    setMarketInfo(miData);
    setLoading(false);
  }, [lane, filters]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('accounts')
        .select('customer_fuel_program')
        .limit(1)
        .maybeSingle();
      setHasFuelProgram(data?.customer_fuel_program === true);
    })();
  }, []);

  const signalData = useMemo(
    () => computeAllSignals(lane, accountLanes, marketInfo, partnerAccount, filters.dateRange),
    [lane, accountLanes, marketInfo, partnerAccount, filters.dateRange]
  );

  function handleLaneSelect(selectedLane: QuoteLane) {
    onLaneChange(selectedLane);
  }

  function handleSaveAndNext() {
    if (resolvedIndex < allLanes.length - 1) {
      onLaneChange(allLanes[resolvedIndex + 1]);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-gradient-to-r from-teal-800 via-teal-700 to-teal-800 shadow-md">
        <div className="max-w-[1440px] mx-auto px-4 py-2 flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[11px] font-medium text-teal-100 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Quote
          </button>
          <h1 className="text-sm font-bold text-white tracking-wide uppercase">
            Transmex — Lane Pricing & Benchmark Dashboard
          </h1>
          <div className="w-[100px]" />
        </div>
      </div>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-3 py-3">
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <div className="flex gap-3 items-start" style={{ minHeight: 'calc(100vh - 80px)' }}>
            <div className="w-[200px] flex-shrink-0 space-y-3">
              <BenchmarkFilters
                filters={filters}
                onChange={setFilters}
                defaultEquipment={lane.equipment_type || 'Dry Van'}
                defaultTripType={lane.trip_type || 'One Way'}
              />
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <LaneInformationCard
                allLanes={allLanes}
                activeLane={lane}
                activeLaneIndex={resolvedIndex}
                onLaneSelect={handleLaneSelect}
                onSave={onBack}
                onSaveAndNext={handleSaveAndNext}
                onCancel={onBack}
                onEdit={onBack}
              />

              <BenchmarkCostStructure lane={lane} costStructures={costStructures} hasFuelProgram={hasFuelProgram} />

              <RateComparisonTable
                lane={lane}
                accountLanes={accountLanes}
                marketInfo={marketInfo}
                partnerAccount={partnerAccount}
              />

              <div className="grid grid-cols-2 gap-3">
                <PricePositioningPanel gauges={signalData.gauges} curr={curr} />
                <MarketSignalsPanel
                  signals={signalData.signals}
                  badge={signalData.badge}
                  keyFactors={signalData.keyFactors}
                />
              </div>

              <BenchmarkSummaryBar
                lane={lane}
                laneIndex={laneIndex}
                data={signalData}
                curr={curr}
                accountLaneCount={accountLanes.length}
                marketInfoCount={marketInfo.length}
                costStructureCount={costStructures.length}
                onRefresh={fetchAll}
                onBack={onBack}
              />
            </div>

            <div className="w-[280px] flex-shrink-0 space-y-3">
              <BenchmarkSuggestedPrice lane={lane} accountLanes={accountLanes} />

              <ProjectedMarginGauge marginPct={signalData.marginAtMid} />

              <RateDeviationBar
                subjectRPM={signalData.subjectRPM}
                marketAvgRPM={signalData.marketAvgRPM}
              />

              <RpmDistributionChart
                lane={lane}
                accountLanes={accountLanes}
                marketInfo={marketInfo}
                partnerAccount={partnerAccount}
                compact
              />

              <HistoricalVolumeChart
                lane={lane}
                accountLanes={accountLanes}
                partnerAccount={partnerAccount}
                dateRange={filters.dateRange}
                compact
              />

              <RateTrendChart
                lane={lane}
                accountLanes={accountLanes}
                partnerAccount={partnerAccount}
                dateRange={filters.dateRange}
                compact
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex gap-3 animate-pulse">
      <div className="w-[200px] flex-shrink-0 space-y-3">
        <div className="h-[360px] bg-gray-200 rounded-lg" />
      </div>
      <div className="flex-1 space-y-3">
        <div className="h-[140px] bg-gray-200 rounded-lg" />
        <div className="h-[120px] bg-gray-200 rounded-lg" />
        <div className="h-[320px] bg-gray-200 rounded-lg" />
        <div className="h-[180px] bg-gray-200 rounded-lg" />
      </div>
      <div className="w-[280px] flex-shrink-0 space-y-3">
        <div className="h-[140px] bg-gray-200 rounded-lg" />
        <div className="h-[110px] bg-gray-200 rounded-lg" />
        <div className="h-[80px] bg-gray-200 rounded-lg" />
        <div className="h-[150px] bg-gray-200 rounded-lg" />
        <div className="h-[130px] bg-gray-200 rounded-lg" />
        <div className="h-[130px] bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

function extractCityBase(cityWithState: string): string {
  if (!cityWithState) return '';
  return cityWithState.split(',')[0].trim();
}

function borderCrossingToMexCity(borderCrossing: string): string {
  if (!borderCrossing) return '';
  const base = extractCityBase(borderCrossing).toUpperCase();
  const map: Record<string, string> = {
    'LAREDO': 'NUEVO LAREDO',
    'EL PASO': 'JUAREZ',
    'NOGALES': 'NOGALES',
    'MCALLEN': 'REYNOSA',
    'BROWNSVILLE': 'MATAMOROS',
    'EAGLE PASS': 'PIEDRAS NEGRAS',
    'SAN DIEGO': 'TIJUANA',
    'CALEXICO': 'MEXICALI',
    'PHARR': 'REYNOSA',
    'HIDALGO': 'REYNOSA',
  };
  return map[base] || base;
}

function equipmentMatchesTariffDescription(equipType: string, tariffDesc: string): boolean {
  if (!equipType || !tariffDesc) return false;
  const eq = equipType.toUpperCase();
  const td = tariffDesc.toUpperCase();
  if (eq.includes('DRY') || eq.includes('VAN')) return td.includes('DRY') || td.includes('VAN');
  if (eq.includes('REEFER') || eq.includes('TEMP')) return td.includes('REEFER') || td.includes('TEMP');
  if (eq.includes('FLAT')) return td.includes('FLAT');
  if (eq.includes('DRAY')) return td.includes('DRAY');
  return false;
}

async function fetchAccountLanes(
  lane: QuoteLane,
  filters: BenchmarkFilterValues,
  _originMarket: string | null,
  _destMarket: string | null,
  dateCutoff: string | null
): Promise<Row[]> {
  const originBase = extractCityBase(lane.origin_city);
  const destBase = extractCityBase(lane.destination_city);
  const borderBase = extractCityBase(lane.border_crossing);

  const allRows: Row[] = [];
  const BATCH = 1000;
  let from = 0;
  let done = false;

  while (!done) {
    const { data, error } = await supabase
      .from('Account Lane')
      .select('*')
      .range(from, from + BATCH - 1);

    if (error) break;
    if (data && data.length > 0) {
      allRows.push(...data);
      from += data.length;
    }
    if (!data || data.length < BATCH) done = true;
  }

  let filtered = allRows;

  if (filters.marketRadius === 'Same City') {
    filtered = filtered.filter(r => {
      const oc = String(r['Origin City'] || '');
      const dc = String(r['Destination City'] || '');
      const originMatch = !originBase || oc.toLowerCase().startsWith(originBase.toLowerCase());
      const destMatch = !destBase || dc.toLowerCase().startsWith(destBase.toLowerCase());
      return originMatch && destMatch;
    });
  } else if (filters.marketRadius === 'Same Market' || filters.marketRadius === 'Same Region') {
    filtered = filtered.filter(r => {
      const oc = String(r['Origin City'] || '').toLowerCase();
      const dc = String(r['Destination City'] || '').toLowerCase();
      const bc = String(r['Border Crossing City'] || '').toLowerCase();
      const bp = String(r['Border Crossing Point'] || '').toLowerCase();
      const oMatch = originBase && oc.startsWith(originBase.toLowerCase());
      const dMatch = destBase && dc.startsWith(destBase.toLowerCase());
      const bMatch = borderBase && (bc.includes(borderBase.toLowerCase()) || bp.includes(borderBase.toLowerCase()));
      return oMatch || dMatch || bMatch;
    });
  }

  if (filters.equipmentType && filters.equipmentType !== 'All') {
    filtered = filtered.filter(r => {
      const td = String(r['Tariff Description'] || '');
      return equipmentMatchesTariffDescription(filters.equipmentType, td);
    });
  }

  if (dateCutoff) {
    filtered = filtered.filter(r => {
      const d = String(r['Effective From Date'] || r['Effective Date'] || '');
      return d >= dateCutoff;
    });
  }

  console.log(`[Benchmark] Account Lanes fetched: ${allRows.length} total, ${filtered.length} after filters`);
  if (filtered.length > 0) console.log('[Benchmark] Sample Account Lane:', filtered[0]);
  return filtered;
}

async function fetchCostStructures(
  lane: QuoteLane,
  filters: BenchmarkFilterValues
): Promise<Row[]> {
  const { data, error } = await supabase
    .from('Cost Structure')
    .select('*')
    .neq('Id', 'Id');

  if (error || !data) {
    console.log('[Benchmark] Cost Structure fetch error:', error);
    return [];
  }

  const mexCrossing = borderCrossingToMexCity(lane.border_crossing);
  const eqType = filters.equipmentType && filters.equipmentType !== 'All' ? filters.equipmentType.toUpperCase() : '';

  let filtered = data;

  if (mexCrossing) {
    const crossingMatch = filtered.filter(r =>
      String(r['Crossing Border City'] || '').toUpperCase().includes(mexCrossing)
    );
    if (crossingMatch.length > 0) filtered = crossingMatch;
  }

  if (eqType) {
    const eqMatch = filtered.filter(r => {
      const et = String(r['Equipment Type'] || '').toUpperCase();
      if (eqType.includes('DRY') || eqType.includes('VAN')) return et.includes('DRY') || et === 'DRY VAN';
      if (eqType.includes('REEFER')) return et.includes('REEFER');
      if (eqType.includes('FLAT')) return et.includes('FLAT');
      return et.includes(eqType);
    });
    if (eqMatch.length > 0) {
      filtered = eqMatch;
    } else {
      const overallMatch = filtered.filter(r => String(r['Equipment Type'] || '').toUpperCase() === 'OVERALL');
      if (overallMatch.length > 0) filtered = overallMatch;
    }
  }

  console.log(`[Benchmark] Cost Structure: ${data.length} total, ${filtered.length} after filters (crossing=${mexCrossing}, equip=${eqType})`);
  if (filtered.length > 0) console.log('[Benchmark] Sample Cost Structure:', filtered[0]);
  return filtered;
}

async function fetchMarketInformation(
  lane: QuoteLane,
  filters: BenchmarkFilterValues,
  _originMarket: string | null,
  _destMarket: string | null,
  _dateCutoff: string | null
): Promise<Row[]> {
  const { data, error } = await supabase
    .from('Market Information')
    .select('*');

  if (error || !data) {
    console.log('[Benchmark] Market Information fetch error:', error);
    return [];
  }

  const originBase = extractCityBase(lane.origin_city).toUpperCase();
  const destBase = extractCityBase(lane.destination_city).toUpperCase();

  let filtered = data.filter(r => {
    const oc = String(r['Origin City'] || '').toUpperCase();
    const dc = String(r['Destination City'] || '').toUpperCase();
    const oMatch = !originBase || oc.includes(originBase) || originBase.includes(oc);
    const dMatch = !destBase || dc.includes(destBase) || destBase.includes(dc);
    return oMatch || dMatch;
  });

  if (filters.equipmentType && filters.equipmentType !== 'All') {
    const eqType = filters.equipmentType.toUpperCase();
    const eqMatch = filtered.filter(r => {
      const et = String(r['Equipment Type'] || '').toUpperCase();
      if (eqType.includes('DRY') || eqType.includes('VAN')) return et.includes('DRY') || et.includes('VAN') || et.includes('DV');
      if (eqType.includes('REEFER')) return et.includes('REEFER');
      if (eqType.includes('FLAT')) return et.includes('FLAT');
      return et.includes(eqType);
    });
    if (eqMatch.length > 0) filtered = eqMatch;
  }

  console.log(`[Benchmark] Market Information: ${data.length} total, ${filtered.length} after filters (origin=${originBase}, dest=${destBase})`);
  if (filtered.length > 0) console.log('[Benchmark] Sample Market Info:', filtered[0]);
  return filtered;
}
