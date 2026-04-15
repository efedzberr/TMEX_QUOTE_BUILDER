import { useMemo } from 'react';
import { QuoteLane } from '../../lib/supabase';
import { formatCurrency, CurrencyCode } from '../../lib/constants';
import { Row, safeNum } from './benchmarkUtils';

interface BenchmarkCostStructureProps {
  lane: QuoteLane;
  costStructures: Row[];
  hasFuelProgram: boolean;
}

function MetricCard({ label, value, sub, colorScheme }: { label: string; value: string; sub: string; colorScheme: 'blue' | 'teal' | 'gray' | 'amber' }) {
  const bgMap = { blue: 'bg-blue-50 border-blue-200', teal: 'bg-teal-50 border-teal-200', gray: 'bg-gray-50 border-gray-200', amber: 'bg-amber-50 border-amber-300' };
  const labelMap = { blue: 'text-blue-600', teal: 'text-teal-600', gray: 'text-gray-600', amber: 'text-amber-700' };
  const valueMap = { blue: 'text-blue-900', teal: 'text-teal-900', gray: 'text-gray-900', amber: 'text-amber-900' };

  return (
    <div className={`rounded border px-2.5 py-2 ${bgMap[colorScheme]}`}>
      <div className={`text-[9px] uppercase tracking-wider font-semibold mb-0.5 ${labelMap[colorScheme]}`}>{label}</div>
      <div className={`text-base font-bold leading-tight ${valueMap[colorScheme]}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>
    </div>
  );
}

function avgField(rows: Row[], field: string): number {
  const vals = rows.map(r => safeNum(r[field])).filter(v => v > 0);
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function BenchmarkCostStructure({ lane, costStructures, hasFuelProgram }: BenchmarkCostStructureProps) {
  const curr = (lane.currency_code || 'USD') as CurrencyCode;

  const csData = useMemo(() => {
    if (costStructures.length === 0) return null;

    const totalCostNoFuel = avgField(costStructures, 'Total Cost No Fuel');
    const fuelExpense = avgField(costStructures, 'Fuel Expense');
    const cvCfNoFuel = avgField(costStructures, 'CV CF No Fuel');
    const totalFixedOp = avgField(costStructures, 'Total Fixed Operating Expense');
    const driverWagesMileage = avgField(costStructures, 'Driver Wages Mileage Pay');
    const driverWagesAcc = avgField(costStructures, 'Driver Wages Accessorial Other');
    const totalEquipMaint = avgField(costStructures, 'Total Equipment Maintenance');
    const roadTolls = avgField(costStructures, 'Road Expenses Tolls');
    const insurance = avgField(costStructures, 'Insurance');
    const transmexAlloc = avgField(costStructures, 'Transmex Allocation');
    const transmexBenefits = avgField(costStructures, 'Transmex Driver Benefits');

    const totalCostWithFuel = totalCostNoFuel + fuelExpense;

    return {
      totalCostNoFuel,
      fuelExpense,
      cvCfNoFuel,
      totalFixedOp,
      driverWagesMileage,
      driverWagesAcc,
      totalEquipMaint,
      roadTolls,
      insurance,
      transmexAlloc,
      transmexBenefits,
      totalCostWithFuel,
    };
  }, [costStructures]);

  const usRPM = lane.us_rate_per_mile || 0;
  const usFuelRPM = lane.us_fuel_rate || 0;
  const mxRPM = lane.mx_rate_per_mile || 0;
  const mxFuelRPM = lane.mx_fuel_rate || 0;
  const usLH = lane.us_rate || 0;
  const mxLH = lane.mx_rate || 0;
  const usMiles = lane.us_miles || 0;
  const mxMiles = lane.mx_miles || 0;
  const totalUSFuel = usMiles * usFuelRPM;
  const totalMXFuel = mxMiles * mxFuelRPM;
  const totalUSPortion = usLH + totalUSFuel;
  const totalMXPortion = mxLH + totalMXFuel;
  const borderFee = lane.border_crossing_fee || 0;
  const totalAccessorials = (lane.us_accessorials_amount || 0) + (lane.mx_accessorials_amount || 0) + (lane.accessorials_amount || 0);
  const totalLaneCost = totalUSPortion + totalMXPortion + borderFee + totalAccessorials;
  const fmt = (val: number) => val ? formatCurrency(val, curr) : '\u2014';
  const fmtPerMile = (val: number) => val ? `$${val.toFixed(2)}` : '\u2014';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Cost Structure</h3>
        {csData && (
          <span className="text-[10px] text-gray-400">
            Based on {costStructures.length} cost record{costStructures.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {csData && (
        <div className="grid grid-cols-5 gap-2 mb-2">
          <MetricCard label="Cost / Mile (No Fuel)" value={fmtPerMile(csData.totalCostNoFuel)} sub={`Fixed: ${fmtPerMile(csData.totalFixedOp)}`} colorScheme="gray" />
          <MetricCard label="Fuel / Mile" value={fmtPerMile(csData.fuelExpense)} sub={`CV+CF: ${fmtPerMile(csData.cvCfNoFuel)}`} colorScheme="gray" />
          <MetricCard label="Driver Wages / Mile" value={fmtPerMile(csData.driverWagesMileage)} sub={`Acc/Other: ${fmtPerMile(csData.driverWagesAcc)}`} colorScheme="gray" />
          <MetricCard label="Equip Maint / Mile" value={fmtPerMile(csData.totalEquipMaint)} sub={`Tolls: ${fmtPerMile(csData.roadTolls)}`} colorScheme="gray" />
          <MetricCard label="Total Cost / Mile" value={fmtPerMile(csData.totalCostWithFuel)} sub={`Ins: ${fmtPerMile(csData.insurance)}`} colorScheme="amber" />
        </div>
      )}

      {!csData && (
        <div className="mb-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-[11px] text-gray-400 italic text-center">
          No cost structure data for {lane.equipment_type || 'this equipment'} at {lane.border_crossing || 'this crossing'}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 mb-2">
        <MetricCard label="US LH Cost / Mile" value={fmt(usRPM)} sub={`Total US LH: ${fmt(usLH)}`} colorScheme="blue" />
        <MetricCard label="US Fuel / Mile" value={fmt(usFuelRPM)} sub={`Total US Fuel: ${fmt(totalUSFuel)}`} colorScheme="blue" />
        <MetricCard label="MX LH Cost / Mile" value={fmt(mxRPM)} sub={`Total MX LH: ${fmt(mxLH)}`} colorScheme="teal" />
        <MetricCard label="MX Fuel / Mile" value={fmt(mxFuelRPM)} sub={`Total MX Fuel: ${fmt(totalMXFuel)}`} colorScheme="teal" />
      </div>
      {hasFuelProgram && (
        <div className="mb-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-700">
          Customer Fuel Program active
        </div>
      )}
      <div className="flex items-center gap-2">
        {[
          { l: 'Total US Portion', v: fmt(totalUSPortion), s: 'LH + Fuel' },
          { l: 'Total MX Portion', v: fmt(totalMXPortion), s: 'LH + Fuel' },
          { l: 'Border Fee', v: fmt(borderFee), s: 'Crossing fee' },
          { l: 'Total Accessorials', v: fmt(totalAccessorials), s: 'US + MX + Global' },
        ].map(item => (
          <div key={item.l} className="flex-1 text-center">
            <div className="text-[9px] uppercase tracking-wider text-gray-500 font-semibold">{item.l}</div>
            <div className="text-sm font-bold text-gray-900">{item.v}</div>
            <div className="text-[9px] text-gray-400">{item.s}</div>
          </div>
        ))}
        <div className="flex-1 text-center bg-amber-50 rounded py-1 border border-amber-200">
          <div className="text-[9px] uppercase tracking-wider text-amber-700 font-semibold">Total Lane Cost</div>
          <div className="text-sm font-bold text-amber-900">{fmt(totalLaneCost)}</div>
          <div className="text-[9px] text-amber-600">Sum of all costs</div>
        </div>
      </div>
    </div>
  );
}
