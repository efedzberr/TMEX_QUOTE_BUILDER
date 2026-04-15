import { useState, useEffect } from 'react';
import './QuoteLanes.css';
import { CreditCard as Edit2, Trash2, FileText, Plus, Check, X, Truck, ChevronDown, Copy, Link2, Lock, CheckCircle, ArrowRight, ArrowLeftRight, Lock as LockIcon, DollarSign, BarChart2 } from 'lucide-react';
import { QuoteLane, Quote } from '../lib/supabase';
import { EQUIPMENT_TYPES, TRIP_TYPES, RATE_TYPES, LOAD_FREQUENCIES, LANE_TYPES, formatCurrencyOrDash, CurrencyCode, normalizeCountryCode } from '../lib/constants';
import { BorderCrossingLookup, useBorderCrossingCities } from './BorderCrossingLookup';
import { CityLookupField, CityInfo } from './CityLookupField';
import { CityAutocompleteInput } from './CityAutocompleteInput';
import { MarketFilteredCityLookup } from './MarketFilteredCityLookup';
import { TripTypeModal } from './TripTypeModal';
import { ServiceTypeModal } from './ServiceTypeModal';
import { LaneBadge } from './LaneBadge';
import { ReadOnlyCell } from './ReadOnlyCell';
import { GridHeader } from './GridHeader';
import { supabase } from '../lib/supabase';
import { createSplitBillingLanes } from '../lib/splitBillingHelper';

function GridCurrencyInput({ value, onChange, disabled, currencyCode = 'USD', hasError }: { value: number; onChange: (v: number) => void; disabled?: boolean; currencyCode?: string; hasError?: boolean }) {
  if (disabled) {
    return <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div>;
  }
  return (
    <div className="relative">
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px] whitespace-nowrap">{currencyCode} $</span>
      <input
        type="number"
        step="0.01"
        value={value || 0}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className={`w-full pl-12 pr-1 py-1 text-xs border rounded text-right ${hasError ? 'border-2 border-red-500' : 'border-gray-300'}`}
      />
    </div>
  );
}

interface QuoteLanesProps {
  lanes: QuoteLane[];
  quote?: Quote;
  currency?: string;
  locked?: boolean;
  onUpdateLane: (id: string, updates: Partial<QuoteLane>) => Promise<boolean>;
  onAddLane: (newLane: Partial<QuoteLane>, newLane2?: Partial<QuoteLane>) => Promise<void>;
  onAddSplitBillingGroup?: (lanes: Partial<QuoteLane>[]) => Promise<void>;
  onDeleteLane: (id: string) => void;
  onShowDetails: (lane: QuoteLane) => void;
  onGlobalEquipmentTypeChange?: (equipmentType: string) => void;
  onDeleteLinkedLanes?: (laneId: string, linkedLaneId: string) => void;
  onDeleteMultipleLanes?: (laneIds: string[]) => void;
  onDuplicateLane?: (lane: QuoteLane) => void;
  onUpdateLinkedLanes?: (laneId: string, updates: Partial<QuoteLane>, pairedLaneId: string, pairedUpdates: Partial<QuoteLane>) => void;
  onToggleLaneCurrency?: (lane: QuoteLane) => void;
  onBenchmarkLane?: (lane: QuoteLane) => void;
}

export function QuoteLanes({
  lanes,
  quote,
  currency = 'USD',
  locked = false,
  onUpdateLane,
  onAddLane,
  onAddSplitBillingGroup,
  onDeleteLane,
  onShowDetails,
  onGlobalEquipmentTypeChange,
  onDeleteLinkedLanes,
  onDeleteMultipleLanes,
  onDuplicateLane,
  onUpdateLinkedLanes,
  onToggleLaneCurrency,
  onBenchmarkLane,
}: QuoteLanesProps) {
  const currencyCode = (currency || 'USD') as CurrencyCode;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPairedId, setEditingPairedId] = useState<string | null>(null);
  const [editingGroupLanes, setEditingGroupLanes] = useState<{ [laneId: string]: Partial<QuoteLane> }>({});
  const [isAdding, setIsAdding] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState<'Loop' | 'Door to Door' | 'Domestic' | null>(null);
  const [selectedTripType, setSelectedTripType] = useState<'One Way' | 'Round Trip' | 'Circuit' | null>(null);
  const [editData, setEditData] = useState<Partial<QuoteLane>>({});
  const [editData2, setEditData2] = useState<Partial<QuoteLane>>({});
  const [splitBillingAddLanes, setSplitBillingAddLanes] = useState<Partial<QuoteLane>[]>([]);
  const [showEquipmentDropdown, setShowEquipmentDropdown] = useState(false);
  const [isDetailView, setIsDetailView] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ laneId: string; linkedLaneId?: string; splitBillingGroup?: string; splitBillingCount?: number } | null>(null);
  const [showServiceTypeModal, setShowServiceTypeModal] = useState(false);
  const [showTripTypeModal, setShowTripTypeModal] = useState(false);
  const [isSplitBilling, setIsSplitBilling] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    lane1: { [key: string]: string };
    lane2: { [key: string]: string };
    lane3: { [key: string]: string };
    lane4: { [key: string]: string };
  }>({
    lane1: {},
    lane2: {},
    lane3: {},
    lane4: {},
  });
  const [countryCodes, setCountryCodes] = useState<{ origin?: string; destination?: string }>({});
  const [laneCityInfo, setLaneCityInfo] = useState<{ [laneIndex: number]: { origin?: CityInfo; destination?: CityInfo } }>({});
  const { cities: borderCrossingCities } = useBorderCrossingCities();
  const [editLane1Markets, setEditLane1Markets] = useState<{ originMarket: string; destMarket: string }>({ originMarket: '', destMarket: '' });
  const [addLane1Markets, setAddLane1Markets] = useState<{ originMarket: string; destMarket: string }>({ originMarket: '', destMarket: '' });
  const [loopOriginIsBorder, setLoopOriginIsBorder] = useState<boolean | null>(null);
  const [editLoopOriginIsBorder, setEditLoopOriginIsBorder] = useState<boolean | null>(null);

  const getFieldVisibility = (lane: Partial<QuoteLane>, overrideCountry?: { origin?: string; dest?: string }) => {
    const serviceType = lane.service_type;
    const borderCrossingOnly = lane.border_crossing_only || false;
    const usFuelIncluded = lane.us_fuel_included_in_line_haul || false;
    const mxFuelIncluded = lane.mx_fuel_included_in_line_haul || false;

    let usFieldsDisabled = false;
    let mxFieldsDisabled = false;
    let borderCrossingDisabled = false;
    let borderFeeDisabled = false;
    let usFuelDisabled = usFuelIncluded;
    let mxFuelDisabled = mxFuelIncluded;

    if (serviceType === 'Door to Door' && lane.split_billing_group) {
      const sbIdx = lane.split_billing_index || 1;
      const originCC = normalizeCountryCode(overrideCountry?.origin || lane.origin_country_code);
      const destCC = normalizeCountryCode(overrideCountry?.dest || lane.destination_country_code);
      const isCrossBorder = originCC && destCC && originCC !== destCC;
      const bothSameNonMX = originCC && destCC && originCC === destCC && originCC !== 'MX';
      const anyMX = originCC === 'MX' || destCC === 'MX';

      const tripType = lane.trip_type;
      const isOneWay = tripType === 'One Way';
      const lane1OriginCC = overrideCountry?.origin || (sbIdx === 1 ? originCC : undefined);

      if (isOneWay && lane1OriginCC) {
        if (sbIdx === 1) {
          if (lane1OriginCC === 'MX') {
            usFieldsDisabled = true;
            mxFieldsDisabled = false;
            borderCrossingDisabled = false;
            borderFeeDisabled = false;
          } else {
            usFieldsDisabled = false;
            mxFieldsDisabled = true;
            borderCrossingDisabled = true;
            borderFeeDisabled = true;
          }
        } else if (sbIdx === 2) {
          if (lane1OriginCC === 'MX') {
            usFieldsDisabled = false;
            mxFieldsDisabled = true;
            borderCrossingDisabled = true;
            borderFeeDisabled = true;
          } else {
            usFieldsDisabled = true;
            mxFieldsDisabled = false;
            borderCrossingDisabled = false;
            borderFeeDisabled = false;
          }
        }

        return {
          usFieldsDisabled,
          mxFieldsDisabled,
          borderCrossingDisabled,
          borderFeeDisabled,
          usFuelDisabled: usFieldsDisabled ? true : usFuelDisabled,
          mxFuelDisabled: mxFieldsDisabled ? true : mxFuelDisabled,
          borderCrossingOnly: false,
        };
      }

      if (isCrossBorder) {
        usFieldsDisabled = true;
        mxFieldsDisabled = false;
      } else if (bothSameNonMX) {
        usFieldsDisabled = false;
        mxFieldsDisabled = true;
      } else {
        const knownCC = originCC || destCC;
        usFieldsDisabled = knownCC === 'MX';
        mxFieldsDisabled = !!knownCC && knownCC !== 'MX';
      }
      borderCrossingDisabled = !anyMX;
      borderFeeDisabled = !anyMX;

      return {
        usFieldsDisabled,
        mxFieldsDisabled,
        borderCrossingDisabled,
        borderFeeDisabled,
        usFuelDisabled: usFieldsDisabled ? true : usFuelDisabled,
        mxFuelDisabled: mxFieldsDisabled ? true : mxFuelDisabled,
        borderCrossingOnly: false,
      };
    }

    if (serviceType === 'Loop') {
      usFieldsDisabled = true;
      mxFieldsDisabled = false;
      borderCrossingDisabled = false;
      borderFeeDisabled = false;
    } else if (serviceType === 'Domestic') {
      mxFieldsDisabled = true;
      borderCrossingDisabled = true;
      borderFeeDisabled = true;
    }

    if (borderCrossingOnly) {
      mxFieldsDisabled = true;
      mxFuelDisabled = true;
    }

    return {
      usFieldsDisabled,
      mxFieldsDisabled,
      borderCrossingDisabled,
      borderFeeDisabled,
      usFuelDisabled,
      mxFuelDisabled,
      borderCrossingOnly,
    };
  };

  const calculateSubtotalFixed = (lane: Partial<QuoteLane>) => {
    const fv = getFieldVisibility(lane);
    const usRate = fv.usFieldsDisabled ? 0 : (lane.us_rate || 0);
    const mxRate = fv.mxFieldsDisabled ? 0 : (lane.mx_rate || 0);
    const borderFee = lane.service_type === 'Domestic' ? 0 : (lane.border_crossing_fee || 0);
    const accessorials = lane.accessorials_amount || 0;
    const usAccAmount = fv.usFieldsDisabled ? 0 : (lane.us_accessorials_amount || 0);
    const mxAccAmount = fv.mxFieldsDisabled ? 0 : (lane.mx_accessorials_amount || 0);
    return usRate + mxRate + borderFee + accessorials + usAccAmount + mxAccAmount;
  };

  const calculateTotalUSFuel = (lane: Partial<QuoteLane>) => {
    if (lane.us_fuel_included_in_line_haul) return 0;
    const miles = lane.us_miles || 0;
    const rate = lane.us_fuel_rate || 0;
    return miles * rate;
  };

  const calculateTotalMXFuel = (lane: Partial<QuoteLane>) => {
    if (lane.mx_fuel_included_in_line_haul) return 0;
    const miles = lane.mx_miles || 0;
    const rate = lane.mx_fuel_rate || 0;
    return miles * rate;
  };

  const calculateUSFixedCosts = (lane: Partial<QuoteLane>) => {
    return (lane.us_rate || 0) + (lane.us_accessorials_amount || 0);
  };

  const calculateUSVariableCosts = (lane: Partial<QuoteLane>) => {
    return calculateTotalUSFuel(lane);
  };

  const calculateUSPortion = (lane: Partial<QuoteLane>) => {
    const fv = getFieldVisibility(lane);
    if (fv.usFieldsDisabled) return 0;
    return calculateUSFixedCosts(lane) + calculateUSVariableCosts(lane);
  };

  const calculateTotalUS = (lane: Partial<QuoteLane>) => {
    return calculateUSPortion(lane);
  };

  const calculateMXFixedCosts = (lane: Partial<QuoteLane>) => {
    return (lane.mx_rate || 0) + (lane.mx_accessorials_amount || 0);
  };

  const calculateMXVariableCosts = (lane: Partial<QuoteLane>) => {
    return calculateTotalMXFuel(lane);
  };

  const calculateMXPortion = (lane: Partial<QuoteLane>) => {
    const fv = getFieldVisibility(lane);
    if (fv.mxFieldsDisabled) return 0;
    return calculateMXFixedCosts(lane) + calculateMXVariableCosts(lane);
  };

  const calculateTotalMX = (lane: Partial<QuoteLane>) => {
    return calculateMXPortion(lane);
  };

  const calculateLaneTotal = (lane: Partial<QuoteLane>) => {
    const usRate = lane.us_rate || 0;
    const mxRate = lane.mx_rate || 0;
    const borderFee = lane.border_crossing_fee || 0;
    const accessorials = lane.accessorials_amount || 0;
    const usAccAmount = lane.us_accessorials_amount || 0;
    const mxAccAmount = lane.mx_accessorials_amount || 0;
    const totalUSFuel = calculateTotalUSFuel(lane);
    const totalMXFuel = calculateTotalMXFuel(lane);
    const fv = getFieldVisibility(lane);
    const totalUSFixedCosts = (usRate) + usAccAmount;
    const totalUSPortion = fv.usFieldsDisabled ? 0 : totalUSFixedCosts + totalUSFuel;
    const totalMXFixedCosts = (mxRate) + mxAccAmount;
    const totalMXPortion = fv.mxFieldsDisabled ? 0 : totalMXFixedCosts + totalMXFuel;
    if (lane.service_type === 'Loop') {
      return totalMXPortion + borderFee;
    }
    if (lane.service_type === 'Domestic') {
      return totalUSPortion;
    }
    if (lane.service_type === 'Door to Door' && lane.split_billing_group) {
      if (fv.usFieldsDisabled && !fv.mxFieldsDisabled) return totalMXPortion + borderFee;
      if (!fv.usFieldsDisabled && fv.mxFieldsDisabled) return totalUSPortion;
      return totalUSPortion + totalMXPortion + borderFee;
    }
    if (lane.service_type === 'Door to Door' && lane.trip_type === 'Round Trip' && lane.is_primary_lane === false) {
      if (lane.border_crossing_only) {
        return totalUSPortion + borderFee;
      }
      return totalMXPortion + borderFee;
    }
    return totalUSPortion + totalMXPortion + borderFee + accessorials;
  };

  const lookupCityMarket = async (cityName: string): Promise<string> => {
    if (!cityName) return '';
    const { data } = await supabase
      .from('cities')
      .select('market_name, is_border_crossing_city')
      .eq('city_full_name', cityName)
      .order('is_border_crossing_city', { ascending: false })
      .limit(5);
    if (!data || data.length === 0) return '';
    if (data.length === 1) return data[0].market_name || '';
    const borderRow = data.find((r: any) => r.is_border_crossing_city);
    return (borderRow || data[0]).market_name || '';
  };

  const lookupIsBorderCity = async (cityName: string): Promise<boolean> => {
    if (!cityName) return false;
    const { data } = await supabase
      .from('cities')
      .select('is_border_crossing_city')
      .eq('city_full_name', cityName)
      .eq('is_border_crossing_city', true)
      .limit(1);
    return !!(data && data.length > 0);
  };

  const applyRateCalcs = (data: Partial<QuoteLane>, field: string): Partial<QuoteLane> => {
    const isSB = !!data.split_billing_group;
    const usRT = isSB ? (data.us_rate_type || data.rate_type || 'RPM') : (data.rate_type || 'RPM');
    const mxRT = isSB ? (data.mx_rate_type || data.rate_type || 'RPM') : (data.rate_type || 'RPM');
    if (usRT === 'RPM' && (field === 'us_miles' || field === 'us_rate_per_mile')) {
      data.us_rate = (data.us_miles || 0) * (data.us_rate_per_mile || 0);
    } else if ((usRT === 'FLT' || usRT === 'Flat Rate') && (field === 'us_rate' || field === 'us_miles')) {
      data.us_rate_per_mile = data.us_miles ? (data.us_rate || 0) / data.us_miles : 0;
    }
    if (mxRT === 'RPM' && (field === 'mx_miles' || field === 'mx_rate_per_mile')) {
      data.mx_rate = (data.mx_miles || 0) * (data.mx_rate_per_mile || 0);
    } else if ((mxRT === 'FLT' || mxRT === 'Flat Rate') && (field === 'mx_rate' || field === 'mx_miles')) {
      data.mx_rate_per_mile = data.mx_miles ? (data.mx_rate || 0) / data.mx_miles : 0;
    }
    return data;
  };

  const handleFieldChange = (laneId: string, field: string, value: any) => {
    if (editingId === laneId) {
      const updated = applyRateCalcs({ ...editData, [field]: value }, field);
      setEditData(updated);
      if (editingPairedId && (editData.service_type === 'Loop' || editData.service_type === 'Door to Door') && editData.trip_type === 'Round Trip') {
        if (field === 'origin_city') {
          setEditData2(prev => ({ ...prev, destination_city: value }));
        } else if (field === 'destination_city') {
          setEditData2(prev => ({ ...prev, origin_city: value }));
        } else if (field === 'border_crossing') {
          setEditData2(prev => ({ ...prev, border_crossing: value }));
        }
      }
      if (editingPairedId && editData.service_type === 'Domestic' && editData.trip_type === 'Round Trip') {
        if (field === 'origin_city') {
          setEditData2(prev => ({ ...prev, destination_city: value }));
        } else if (field === 'destination_city') {
          setEditData2(prev => ({ ...prev, origin_city: value }));
        }
      }
      if (editingPairedId && (editData.service_type === 'Loop' || editData.service_type === 'Domestic' || editData.service_type === 'Door to Door') && editData.trip_type === 'Circuit') {
        if (field === 'origin_city') {
          lookupCityMarket(value).then(m => setEditLane1Markets(prev => ({ ...prev, originMarket: m })));
        } else if (field === 'destination_city') {
          lookupCityMarket(value).then(m => setEditLane1Markets(prev => ({ ...prev, destMarket: m })));
        }
      }
      if (editData.service_type === 'Door to Door' && field === 'origin_country_code') {
        const prevOrigin = normalizeCountryCode(editData.origin_country_code);
        const newOrigin = normalizeCountryCode(value);
        if (prevOrigin && newOrigin && prevOrigin !== newOrigin && editData.destination_city) {
          setEditData(prev => ({ ...prev, destination_city: '' }));
          if (editingPairedId && editData.trip_type === 'Round Trip') {
            setEditData2(prev => ({ ...prev, origin_city: '' }));
          }
        }
      }
    } else if (editingPairedId === laneId) {
      setEditData2(applyRateCalcs({ ...editData2, [field]: value }, field));
    } else if (editingGroupLanes[laneId]) {
      const updatedGroup = {
        ...editingGroupLanes,
        [laneId]: applyRateCalcs({ ...editingGroupLanes[laneId], [field]: value }, field),
      };
      if (field === 'border_crossing') {
        const changedLane = editingGroupLanes[laneId];
        const changedIdx = changedLane.split_billing_index;
        const tripType = changedLane.trip_type;
        const findByIdx = (idx: number) => Object.entries(updatedGroup).find(([, l]) => l.split_billing_index === idx);

        if (tripType === 'Circuit' && changedIdx === 1 && changedLane.service_type === 'Door to Door') {
          updatedGroup[laneId] = { ...updatedGroup[laneId], destination_city: value };
          const bcCity = borderCrossingCities.find(c => (c.city_full_name || c.city_name) === value);
          const bcCountry = bcCity ? normalizeCountryCode(bcCity.country_code) : undefined;
          const lane2Entry = findByIdx(2);
          if (lane2Entry) {
            const l2Update: any = { ...lane2Entry[1], origin_city: value };
            if (bcCountry) l2Update.origin_country_code = bcCountry;
            updatedGroup[lane2Entry[0]] = l2Update;
          }
          const lane3Entry = findByIdx(3);
          if (lane3Entry) {
            const l3Update: any = { ...lane3Entry[1], destination_city: value, border_crossing: value };
            if (bcCountry) l3Update.destination_country_code = bcCountry;
            updatedGroup[lane3Entry[0]] = l3Update;
          }
          const lane4Entry = findByIdx(4);
          if (lane4Entry) {
            const l4Update: any = { ...lane4Entry[1], origin_city: value, border_crossing: 'N/A' };
            if (bcCountry) l4Update.origin_country_code = bcCountry;
            updatedGroup[lane4Entry[0]] = l4Update;
          }
        } else if (tripType === 'Circuit' && changedIdx === 2 && changedLane.service_type === 'Door to Door') {
          const bcCity = borderCrossingCities.find(c => (c.city_full_name || c.city_name) === value);
          const bcCountry = bcCity ? normalizeCountryCode(bcCity.country_code) : undefined;
          updatedGroup[laneId] = { ...updatedGroup[laneId], destination_city: value };
          if (bcCountry) updatedGroup[laneId].destination_country_code = bcCountry;
          const lane1Entry = findByIdx(1);
          if (lane1Entry) {
            const l1Update: any = { ...lane1Entry[1], destination_city: value };
            if (bcCountry) l1Update.destination_country_code = bcCountry;
            updatedGroup[lane1Entry[0]] = l1Update;
          }
          const lane3Entry = findByIdx(3);
          if (lane3Entry) {
            const l3Update: any = { ...lane3Entry[1], destination_city: value, border_crossing: value };
            if (bcCountry) l3Update.destination_country_code = bcCountry;
            updatedGroup[lane3Entry[0]] = l3Update;
          }
          const lane4Entry = findByIdx(4);
          if (lane4Entry) {
            const l4Update: any = { ...lane4Entry[1], origin_city: value, border_crossing: 'N/A' };
            if (bcCountry) l4Update.origin_country_code = bcCountry;
            updatedGroup[lane4Entry[0]] = l4Update;
          }
        } else if (tripType === 'Circuit' && changedIdx === 1) {
          updatedGroup[laneId] = { ...updatedGroup[laneId], destination_city: value };
          const lane2Entry = findByIdx(2);
          if (lane2Entry) updatedGroup[lane2Entry[0]] = { ...lane2Entry[1], origin_city: value };
          const lane3Entry = findByIdx(3);
          if (lane3Entry) updatedGroup[lane3Entry[0]] = { ...lane3Entry[1], destination_city: value, border_crossing: value };
          const lane4Entry = findByIdx(4);
          if (lane4Entry) updatedGroup[lane4Entry[0]] = { ...lane4Entry[1], origin_city: value, border_crossing: 'N/A' };
        } else {
          const pairedIdx = changedIdx === 1 ? 4 : changedIdx === 2 ? 3 : changedIdx === 3 ? 2 : 1;
          const pairedEntry = findByIdx(pairedIdx);
          if (pairedEntry) {
            const [pairedId, pairedData] = pairedEntry;
            const cityField = pairedIdx === 1 ? 'destination_city' : pairedIdx === 2 ? 'origin_city' : pairedIdx === 3 ? 'destination_city' : 'origin_city';
            updatedGroup[pairedId] = { ...pairedData, border_crossing: value, [cityField]: value };
          }
          if (changedIdx === 1) {
            updatedGroup[laneId] = { ...updatedGroup[laneId], destination_city: value };
          } else if (changedIdx === 2) {
            updatedGroup[laneId] = { ...updatedGroup[laneId], origin_city: value };
          }
        }
      }
      if (field === 'origin_city' || field === 'destination_city') {
        const changedLane = editingGroupLanes[laneId];
        if (changedLane.service_type === 'Door to Door' && changedLane.trip_type === 'Circuit') {
          const changedIdx = changedLane.split_billing_index;
          if (changedIdx === 1 && field === 'origin_city') {
            lookupCityMarket(value).then(m => setEditLane1Markets(prev => ({ ...prev, originMarket: m })));
          }
          if (changedIdx === 2 && field === 'destination_city') {
            lookupCityMarket(value).then(m => setEditLane1Markets(prev => ({ ...prev, destMarket: m })));
          }
        }
        if (changedLane.service_type === 'Door to Door' && changedLane.trip_type === 'One Way') {
          const changedIdx = changedLane.split_billing_index;
          const findByIdx = (idx: number) => Object.entries(updatedGroup).find(([, l]) => l.split_billing_index === idx);
          if (changedIdx === 1 && field === 'destination_city') {
            const lane2Entry = findByIdx(2);
            if (lane2Entry) {
              const bcCity = borderCrossingCities.find(c => (c.city_full_name || c.city_name) === value);
              const bcCountry = bcCity ? normalizeCountryCode(bcCity.country_code) : undefined;
              const l2Update: any = { ...lane2Entry[1], origin_city: value };
              if (bcCountry) l2Update.origin_country_code = bcCountry;
              updatedGroup[lane2Entry[0]] = l2Update;
            }
          }
        }
      }
      setEditingGroupLanes(updatedGroup);
    }
  };

  const handleEdit = (lane: QuoteLane) => {
    const isPairedDomesticRT = lane.service_type === 'Domestic' && lane.trip_type === 'Round Trip' && lane.paired_lane_id;
    const isPairedDomesticCircuit = lane.service_type === 'Domestic' && lane.trip_type === 'Circuit' && lane.paired_lane_id;
    const isPairedLoopRTOrCircuit = (lane.service_type === 'Loop' || lane.service_type === 'Door to Door') && (lane.trip_type === 'Round Trip' || lane.trip_type === 'Circuit') && lane.paired_lane_id;

    const isPairedDoorToDoorRT = lane.service_type === 'Door to Door' && lane.trip_type === 'Round Trip' && lane.paired_lane_id;
    const isPairedDoorToDoorCircuit = lane.service_type === 'Door to Door' && lane.trip_type === 'Circuit' && lane.paired_lane_id;
    if ((isPairedDomesticRT || isPairedDomesticCircuit || isPairedDoorToDoorRT || isPairedDoorToDoorCircuit) && lane.is_primary_lane === false) {
      const primaryLane = lanes.find((l) => l.id === lane.paired_lane_id);
      if (primaryLane) {
        setEditingId(primaryLane.id);
        setEditData(primaryLane);
        setEditingPairedId(lane.id);
        setEditData2(lane);
        setEditingGroupLanes({});
        if (isPairedDomesticCircuit || isPairedDoorToDoorCircuit) {
          lookupCityMarket(primaryLane.origin_city).then(m => setEditLane1Markets(prev => ({ ...prev, originMarket: m })));
          lookupCityMarket(primaryLane.destination_city).then(m => setEditLane1Markets(prev => ({ ...prev, destMarket: m })));
        }
        return;
      }
    }

    setEditingId(lane.id);
    setEditData(lane);
    setEditingGroupLanes({});

    if (lane.service_type === 'Loop' && lane.origin_city) {
      lookupIsBorderCity(lane.origin_city).then(isBorder => setEditLoopOriginIsBorder(isBorder));
    } else {
      setEditLoopOriginIsBorder(null);
    }

    if (lane.split_billing_group) {
      const groupLanes = lanes.filter((l) => l.split_billing_group === lane.split_billing_group);
      const groupData: { [laneId: string]: Partial<QuoteLane> } = {};
      groupLanes.forEach((l) => {
        groupData[l.id] = l;
      });
      setEditingGroupLanes(groupData);
      if (lane.service_type === 'Door to Door' && lane.trip_type === 'Circuit') {
        const lane1 = groupLanes.find(l => l.split_billing_index === 1);
        const lane2 = groupLanes.find(l => l.split_billing_index === 2);
        if (lane1?.origin_city) {
          lookupCityMarket(lane1.origin_city).then(m => setEditLane1Markets(prev => ({ ...prev, originMarket: m })));
        }
        if (lane2?.destination_city) {
          lookupCityMarket(lane2.destination_city).then(m => setEditLane1Markets(prev => ({ ...prev, destMarket: m })));
        }
      }
    } else if ((lane.trip_type === 'Round Trip' || lane.trip_type === 'Circuit') && lane.paired_lane_id) {
      const pairedLane = lanes.find((l) => l.id === lane.paired_lane_id);
      if (pairedLane) {
        setEditingPairedId(pairedLane.id);
        setEditData2(pairedLane);
      }
      if ((lane.service_type === 'Loop' || lane.service_type === 'Domestic' || lane.service_type === 'Door to Door') && lane.trip_type === 'Circuit') {
        const primaryLane = lane.is_primary_lane !== false ? lane : pairedLane;
        if (primaryLane) {
          lookupCityMarket(primaryLane.origin_city).then(m => setEditLane1Markets(prev => ({ ...prev, originMarket: m })));
          lookupCityMarket(primaryLane.destination_city).then(m => setEditLane1Markets(prev => ({ ...prev, destMarket: m })));
        }
      }
    }
  };


  const prepareSavePayload = (data: Partial<QuoteLane>): Partial<QuoteLane> => {
    const payload = { ...data };
    const isSB = !!payload.split_billing_group;
    const usRateType = isSB ? (payload.us_rate_type || payload.rate_type || 'RPM') : (payload.rate_type || 'RPM');
    const mxRateType = isSB ? (payload.mx_rate_type || payload.rate_type || 'RPM') : (payload.rate_type || 'RPM');
    payload.us_rate_type = usRateType;
    payload.mx_rate_type = mxRateType;
    if (usRateType === 'RPM') {
      payload.us_rate = (payload.us_miles || 0) * (payload.us_rate_per_mile || 0);
    } else {
      payload.us_rate_per_mile = payload.us_miles ? (payload.us_rate || 0) / payload.us_miles : 0;
    }
    if (mxRateType === 'RPM') {
      payload.mx_rate = (payload.mx_miles || 0) * (payload.mx_rate_per_mile || 0);
    } else {
      payload.mx_rate_per_mile = payload.mx_miles ? (payload.mx_rate || 0) / payload.mx_miles : 0;
    }
    const fv = getFieldVisibility(payload);
    if (fv.borderCrossingDisabled && !payload.border_crossing) {
      payload.border_crossing = 'N/A';
    }
    if (fv.borderFeeDisabled) {
      payload.border_crossing_fee = 0;
    }
    return payload;
  };

  const handleSaveEdit = async () => {
    if (!editingId && Object.keys(editingGroupLanes).length === 0) return;

    if (Object.keys(editingGroupLanes).length > 0 && editData.service_type === 'Door to Door' && editData.split_billing_group) {
      const groupLanesArr = Object.entries(editingGroupLanes)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => (a.split_billing_index || 0) - (b.split_billing_index || 0));

      const allErrs: Record<string, Record<string, string>> = {};
      const isOneWaySB = editData.trip_type === 'One Way';
      const lane1InGroup = groupLanesArr.find(l => l.split_billing_index === 1);
      const editSBOriginOverride = isOneWaySB && lane1InGroup?.origin_country_code ? { origin: normalizeCountryCode(lane1InGroup.origin_country_code) } : undefined;
      for (const gl of groupLanesArr) {
        const laneKey = `lane${gl.split_billing_index || 1}`;
        const fv = getFieldVisibility(gl, editSBOriginOverride);
        const lErrs: Record<string, string> = {};
        if (!fv.borderCrossingDisabled && !gl.border_crossing) {
          lErrs.border_crossing = 'This field is required';
        }
        if (!fv.borderFeeDisabled && (!gl.border_crossing_fee || gl.border_crossing_fee === 0)) {
          lErrs.border_crossing_fee = 'This field is required';
        }
        if (gl.split_billing_index === 1 && isOneWaySB) {
          if (!gl.origin_city) lErrs.origin_city = 'This field is required';
          if (editSBOriginOverride?.origin && editSBOriginOverride.origin !== 'MX' && !gl.destination_city) {
            lErrs.destination_city = 'This field is required';
          }
        }
        if (gl.split_billing_index === 2 && isOneWaySB && !gl.destination_city) {
          lErrs.destination_city = 'This field is required';
        }
        if (gl.split_billing_index === 3 && editData.trip_type === 'Circuit' && !gl.origin_city) {
          lErrs.origin_city = 'This field is required';
        }
        if (gl.split_billing_index === 4 && editData.trip_type === 'Circuit' && !gl.destination_city) {
          lErrs.destination_city = 'This field is required';
        }
        if (Object.keys(lErrs).length > 0) allErrs[laneKey] = lErrs;
      }
      if (Object.keys(allErrs).length > 0) {
        setValidationErrors({ lane1: allErrs.lane1 || {}, lane2: allErrs.lane2 || {}, lane3: allErrs.lane3 || {}, lane4: allErrs.lane4 || {} });
        return;
      }

      const results: boolean[] = [];
      for (const [laneId, laneData] of Object.entries(editingGroupLanes)) {
        const payload = prepareSavePayload(laneData);
        results.push(await onUpdateLane(laneId, payload));
      }
      if (results.some(r => !r)) return;

      setEditingId(null);
      setEditingPairedId(null);
      setEditData({});
      setEditData2({});
      setEditingGroupLanes({});
      setValidationErrors({ lane1: {}, lane2: {}, lane3: {}, lane4: {} });
      return;
    }

    const errs: Record<string, string> = {};
    if (!editData.origin_city) errs.origin_city = 'This field is required';
    if (!editData.destination_city) errs.destination_city = 'This field is required';
    if (editData.service_type === 'Loop' && editData.destination_city && editLoopOriginIsBorder === false) {
      const isValidBorder = borderCrossingCities.some(c => (c.city_full_name || c.city_name) === editData.destination_city);
      if (!isValidBorder) {
        errs.destination_city = 'Destination City must be a Border Crossing City when Origin City is not a border city';
      }
    }
    const fvEdit = getFieldVisibility(editData);
    if (!fvEdit.borderCrossingDisabled && !editData.border_crossing) errs.border_crossing = 'This field is required';
    if (!fvEdit.borderFeeDisabled && (!editData.border_crossing_fee || editData.border_crossing_fee === 0)) {
      errs.border_crossing_fee = 'This field is required';
    }
    if (editData.service_type === 'Door to Door' && !editData.split_billing_group) {
      if (editData.origin_city && editData.destination_city) {
        const originNorm = normalizeCountryCode(editData.origin_country_code);
        if (originNorm) {
          const { data: destCity } = await supabase.from('cities').select('country_code').eq('city_full_name', editData.destination_city).maybeSingle();
          if (destCity) {
            const destNorm = normalizeCountryCode(destCity.country_code);
            if (originNorm === destNorm) {
              errs.destination_city = 'Destination City must be in a different country than Origin City for Door to Door service';
            }
          }
        }
      }
    }
    if (editData.service_type === 'Domestic') {
      if (editData.origin_city) {
        const { data: origCity } = await supabase.from('cities').select('country_code').eq('city_full_name', editData.origin_city).maybeSingle();
        if (origCity) {
          const cc = normalizeCountryCode(origCity.country_code);
          if (cc && cc !== 'US' && cc !== 'CA') {
            errs.origin_city = 'This service type requires US cities only';
          }
        }
      }
      if (editData.destination_city) {
        const { data: destCity } = await supabase.from('cities').select('country_code').eq('city_full_name', editData.destination_city).maybeSingle();
        if (destCity) {
          const cc = normalizeCountryCode(destCity.country_code);
          if (cc && cc !== 'US' && cc !== 'CA') {
            errs.destination_city = 'This service type requires US cities only';
          }
        }
      }
    }

    const errs2: Record<string, string> = {};
    if (editingPairedId && editData2.service_type === 'Loop' && (editData2.trip_type === 'Round Trip' || editData2.trip_type === 'Circuit')) {
      if (!editData2.border_crossing_fee || editData2.border_crossing_fee === 0) {
        errs2.border_crossing_fee = 'This field is required';
      }
      if (editData2.trip_type === 'Circuit') {
        if (!editData2.origin_city) errs2.origin_city = 'This field is required';
        if (!editData2.destination_city) errs2.destination_city = 'This field is required';
        if (!editData2.border_crossing) errs2.border_crossing = 'This field is required';
      }
    }
    if (editingPairedId && editData2.service_type === 'Domestic' && editData2.trip_type === 'Circuit') {
      if (!editData2.origin_city) errs2.origin_city = 'This field is required';
      if (!editData2.destination_city) errs2.destination_city = 'This field is required';
    }
    if (editingPairedId && editData2.service_type === 'Door to Door' && editData2.trip_type === 'Round Trip') {
      if (!editData2.border_crossing_fee || editData2.border_crossing_fee === 0) {
        errs2.border_crossing_fee = 'This field is required';
      }
    }
    if (editingPairedId && editData2.service_type === 'Door to Door' && editData2.trip_type === 'Circuit') {
      if (!editData2.origin_city) errs2.origin_city = 'This field is required';
      if (!editData2.destination_city) errs2.destination_city = 'This field is required';
      const fvEdit2 = getFieldVisibility(editData2);
      if (!fvEdit2.borderCrossingDisabled && !editData2.border_crossing) errs2.border_crossing = 'This field is required';
      if (!fvEdit2.borderFeeDisabled && (!editData2.border_crossing_fee || editData2.border_crossing_fee === 0)) {
        errs2.border_crossing_fee = 'This field is required';
      }
    }

    if (Object.keys(errs).length > 0 || Object.keys(errs2).length > 0) {
      setValidationErrors({ lane1: errs, lane2: errs2, lane3: {}, lane4: {} });
      return;
    }

    const results: boolean[] = [];

    if (editingId) {
      const payload1 = prepareSavePayload(editData);
      results.push(await onUpdateLane(editingId, payload1));
    }

    if (editingPairedId) {
      let lane2Data = { ...editData2 };
      if (editData.service_type === 'Door to Door' && editData.trip_type === 'Round Trip') {
        lane2Data.origin_city = editData.destination_city;
        lane2Data.destination_city = editData.origin_city;
        lane2Data.border_crossing = editData.border_crossing;
        lane2Data.origin_country_code = editData.origin_country_code;
        lane2Data.border_crossing_only = editData.border_crossing_only;
      }
      if (editData.service_type === 'Door to Door' && editData.trip_type === 'Circuit') {
        lane2Data.border_crossing_only = editData.border_crossing_only;
      }
      if (editData.service_type === 'Domestic' && editData.trip_type === 'Round Trip') {
        lane2Data.origin_city = editData.destination_city;
        lane2Data.destination_city = editData.origin_city;
        lane2Data.border_crossing = 'N/A';
        lane2Data.border_crossing_fee = 0;
      }
      if (editData.service_type === 'Domestic' && editData.trip_type === 'Circuit') {
        lane2Data.border_crossing = 'N/A';
        lane2Data.border_crossing_fee = 0;
        lane2Data.border_crossing_rate = 0;
        lane2Data.mx_rate = 0;
        lane2Data.mx_miles = 0;
        lane2Data.mx_fuel_rate = 0;
        lane2Data.mx_rate_per_mile = 0;
      }
      const payload2 = prepareSavePayload(lane2Data);
      results.push(await onUpdateLane(editingPairedId, payload2));
    }

    if (Object.keys(editingGroupLanes).length > 0) {
      for (const [laneId, laneData] of Object.entries(editingGroupLanes)) {
        const payload = prepareSavePayload(laneData);
        results.push(await onUpdateLane(laneId, payload));
      }
    }

    if (results.some(r => !r)) {
      return;
    }

    setEditingId(null);
    setEditingPairedId(null);
    setEditData({});
    setEditData2({});
    setEditingGroupLanes({});
    setIsAdding(false);
    setSplitBillingAddLanes([]);
    setValidationErrors({ lane1: {}, lane2: {}, lane3: {}, lane4: {} });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingPairedId(null);
    setEditData({});
    setEditData2({});
    setEditingGroupLanes({});
    setIsAdding(false);
    setSplitBillingAddLanes([]);
    setValidationErrors({ lane1: {}, lane2: {}, lane3: {}, lane4: {} });
  };

  const handleStartAdd = () => {
    setIsDetailView(true);
    setShowServiceTypeModal(true);
  };

  const handleServiceTypeSelect = (serviceType: 'Loop' | 'Door to Door' | 'Domestic') => {
    setShowServiceTypeModal(false);
    setSelectedServiceType(serviceType);
    setShowTripTypeModal(true);
  };

  const handleTripTypeSelect = (tripType: 'One Way' | 'Round Trip' | 'Circuit', splitBilling?: boolean) => {
    setShowTripTypeModal(false);
    setSelectedTripType(tripType);

    if (selectedServiceType === 'Door to Door' && splitBilling) {
      handleStartAddingLane(tripType, true);
    } else {
      handleStartAddingLane(tripType, false);
    }
  };

  const handleStartAddingLane = (tripType: 'One Way' | 'Round Trip' | 'Circuit', splitBilling: boolean) => {
    setShowServiceTypeModal(false);
    setIsSplitBilling(splitBilling);
    setSelectedTripType(tripType);
    setIsAdding(true);
    setLoopOriginIsBorder(null);

    if (splitBilling) {
      const groupId = `${tripType.toLowerCase().replace(' ', '-')}-${Date.now()}`;
      const baseLane = { service_type: selectedServiceType, trip_type: tripType, rate_type: 'RPM' as const };

      if (tripType === 'One Way') {
        setSplitBillingAddLanes([
          { ...baseLane, split_billing_group: groupId, split_billing_index: 1, id: 'temp-1' },
          { ...baseLane, split_billing_group: groupId, split_billing_index: 2, id: 'temp-2' },
        ]);
      } else {
        setSplitBillingAddLanes([
          { ...baseLane, split_billing_group: groupId, split_billing_index: 1, id: 'temp-1' },
          { ...baseLane, split_billing_group: groupId, split_billing_index: 2, id: 'temp-2' },
          { ...baseLane, split_billing_group: groupId, split_billing_index: 3, id: 'temp-3', is_auto_populated: tripType === 'Round Trip' || tripType === 'Circuit' },
          { ...baseLane, split_billing_group: groupId, split_billing_index: 4, id: 'temp-4', is_auto_populated: tripType === 'Round Trip' || tripType === 'Circuit' },
        ]);
      }
    } else {
      setEditData({ service_type: selectedServiceType, trip_type: tripType, rate_type: 'RPM' });
      if (tripType !== 'One Way') {
        setEditData2({ service_type: selectedServiceType, trip_type: tripType, rate_type: 'RPM', is_primary_lane: false });
      }
    }
  };

  const validateDoorToDoorCountries = (originCountry?: string, destCountry?: string) => {
    if (selectedServiceType !== 'Door to Door') return '';
    if (!originCountry || !destCountry) return '';
    if (originCountry === destCountry) {
      return 'Door-to-Door requires origin and destination to be in different countries';
    }
    return '';
  };

  const areCitiesInSameMarket = (cityInfo1?: CityInfo, cityInfo2?: CityInfo): boolean => {
    if (!cityInfo1 || !cityInfo2) return true;
    if (cityInfo1.marketName && cityInfo2.marketName) {
      return cityInfo1.marketName === cityInfo2.marketName;
    }
    if (cityInfo1.stateCode && cityInfo2.stateCode) {
      return cityInfo1.stateCode === cityInfo2.stateCode;
    }
    return true;
  };

  const validateCircuitMarkets = (updatedCityInfo: { [laneIndex: number]: { origin?: CityInfo; destination?: CityInfo } }) => {
    if (selectedServiceType !== 'Door to Door' || selectedTripType !== 'Circuit' || !isSplitBilling) {
      return { lane3Error: '', lane4Error: '' };
    }

    let lane3Error = '';
    let lane4Error = '';

    const lane1Origin = updatedCityInfo[0]?.origin;
    const lane4Destination = updatedCityInfo[3]?.destination;
    if (lane1Origin && lane4Destination && !areCitiesInSameMarket(lane1Origin, lane4Destination)) {
      lane4Error = 'Destination City must be in the same market as Origin City of Lane 1';
    }

    const lane2Destination = updatedCityInfo[1]?.destination;
    const lane3Origin = updatedCityInfo[2]?.origin;
    if (lane2Destination && lane3Origin && !areCitiesInSameMarket(lane2Destination, lane3Origin)) {
      lane3Error = 'Origin City must be in the same market as Destination City of Lane 2';
    }

    return { lane3Error, lane4Error };
  };

  const handleSplitBillingLaneChange = (index: number, field: string, value: any, countryCode?: string, cityInfo?: CityInfo) => {
    if (field === 'origin_city' && index === 0 && countryCode) {
      const normCode = normalizeCountryCode(countryCode);
      const prevOrigin = countryCodes.origin;
      setCountryCodes((prev) => ({ ...prev, origin: normCode }));
      const error = validateDoorToDoorCountries(normCode, countryCodes.destination);
      if (error) {
        setValidationErrors((prev) => ({ ...prev, lane2: { ...prev.lane2, destination_city: error } }));
      } else {
        setValidationErrors((prev) => ({ ...prev, lane2: { ...prev.lane2, destination_city: '' } }));
      }

      const isD2DOneWaySB = selectedServiceType === 'Door to Door' && selectedTripType === 'One Way';
      if (isD2DOneWaySB && prevOrigin && prevOrigin !== normCode) {
        setSplitBillingAddLanes((prev) => {
          const updated = prev.map((lane) => ({ ...lane }));
          updated[0] = { ...updated[0], origin_country_code: normCode, destination_city: '', border_crossing: normCode === 'MX' ? '' : 'N/A', border_crossing_fee: 0 };
          updated[1] = { ...updated[1], origin_city: '', destination_city: '', border_crossing: normCode === 'MX' ? 'N/A' : '', border_crossing_fee: 0, origin_country_code: undefined, destination_country_code: undefined };
          return updated;
        });
        setValidationErrors({ lane1: {}, lane2: {}, lane3: {}, lane4: {} });
        return;
      }

      setSplitBillingAddLanes((prev) => {
        const updated = prev.map((lane) => ({ ...lane }));
        updated[0] = { ...updated[0], origin_country_code: normCode };
        if (isD2DOneWaySB) {
          if (normCode !== 'MX') {
            updated[0] = { ...updated[0], border_crossing: 'N/A', border_crossing_fee: 0 };
            if (!updated[1].border_crossing || updated[1].border_crossing === 'N/A') {
              updated[1] = { ...updated[1], border_crossing: '' };
            }
          } else {
            if (!updated[0].border_crossing || updated[0].border_crossing === 'N/A') {
              updated[0] = { ...updated[0], border_crossing: '' };
            }
            updated[1] = { ...updated[1], border_crossing: 'N/A', border_crossing_fee: 0 };
          }
        }
        if (updated.length > 3) {
          updated[3] = { ...updated[3], destination_country_code: normCode };
          const isD2DRT = selectedServiceType === 'Door to Door' && (selectedTripType === 'Round Trip' || selectedTripType === 'Circuit');
          if (isD2DRT && normCode !== 'MX') {
            updated[0] = { ...updated[0], origin_country_code: normCode, border_crossing: 'N/A', border_crossing_fee: 0 };
            updated[3] = { ...updated[3], destination_country_code: normCode, border_crossing: 'N/A', border_crossing_fee: 0 };
          } else if (isD2DRT && normCode === 'MX') {
            if (updated[0].border_crossing === 'N/A') {
              updated[0] = { ...updated[0], origin_country_code: normCode, border_crossing: '', border_crossing_fee: 0 };
            }
            if (updated[3].border_crossing === 'N/A') {
              updated[3] = { ...updated[3], destination_country_code: normCode, border_crossing: '', border_crossing_fee: 0 };
            }
          }
        }
        return updated;
      });
    }
    if (field === 'destination_city' && index === 1 && countryCode) {
      const normCode = normalizeCountryCode(countryCode);
      setCountryCodes((prev) => ({ ...prev, destination: normCode }));
      const error = validateDoorToDoorCountries(countryCodes.origin, normCode);
      if (error) {
        setValidationErrors((prev) => ({ ...prev, lane2: { ...prev.lane2, destination_city: error } }));
      } else {
        setValidationErrors((prev) => ({ ...prev, lane2: { ...prev.lane2, destination_city: '' } }));
      }
      setSplitBillingAddLanes((prev) => {
        const updated = prev.map((lane) => ({ ...lane }));
        updated[1] = { ...updated[1], destination_country_code: normCode };
        if (updated.length > 2) {
          updated[2] = { ...updated[2], origin_country_code: normCode };
          const isD2DRT = selectedServiceType === 'Door to Door' && (selectedTripType === 'Round Trip' || selectedTripType === 'Circuit');
          if (isD2DRT && normCode !== 'MX') {
            updated[1] = { ...updated[1], destination_country_code: normCode, border_crossing: 'N/A', border_crossing_fee: 0 };
            updated[2] = { ...updated[2], origin_country_code: normCode, border_crossing: 'N/A', border_crossing_fee: 0 };
          } else if (isD2DRT && normCode === 'MX') {
            if (updated[1].border_crossing === 'N/A') {
              updated[1] = { ...updated[1], destination_country_code: normCode, border_crossing: '', border_crossing_fee: 0 };
            }
            if (updated[2].border_crossing === 'N/A') {
              updated[2] = { ...updated[2], origin_country_code: normCode, border_crossing: '', border_crossing_fee: 0 };
            }
          }
        }
        return updated;
      });
    }

    if (cityInfo && (field === 'origin_city' || field === 'destination_city')) {
      setLaneCityInfo((prev) => {
        const updated = { ...prev };
        if (!updated[index]) updated[index] = {};
        if (field === 'origin_city') {
          updated[index].origin = cityInfo;
        } else {
          updated[index].destination = cityInfo;
        }

        if (selectedTripType === 'Circuit' && selectedServiceType === 'Door to Door' && isSplitBilling) {
          if (index === 0 && field === 'origin_city') {
            if (!updated[3]) updated[3] = {};
            updated[3].destination = cityInfo;
          }
          if (index === 1 && field === 'destination_city') {
            if (!updated[2]) updated[2] = {};
            updated[2].origin = cityInfo;
          }

          const { lane3Error, lane4Error } = validateCircuitMarkets(updated);
          setValidationErrors((prevErrors) => ({
            ...prevErrors,
            lane3: { ...prevErrors.lane3, origin_city: lane3Error },
            lane4: { ...prevErrors.lane4, destination_city: lane4Error },
          }));
        }

        return updated;
      });
    }

    if (selectedTripType === 'Circuit' && selectedServiceType === 'Door to Door' && isSplitBilling) {
      if (index === 0 && field === 'origin_city') {
        lookupCityMarket(value).then(m => setAddLane1Markets(prev => ({ ...prev, originMarket: m })));
      }
      if (index === 1 && field === 'destination_city') {
        lookupCityMarket(value).then(m => setAddLane1Markets(prev => ({ ...prev, destMarket: m })));
      }
      if (index === 2 && field === 'origin_city' && countryCode) {
        const normCode = normalizeCountryCode(countryCode);
        setSplitBillingAddLanes((prev) => {
          const u = prev.map((lane) => ({ ...lane }));
          u[2] = { ...u[2], origin_country_code: normCode };
          return u;
        });
      }
      if (index === 3 && field === 'destination_city' && countryCode) {
        const normCode = normalizeCountryCode(countryCode);
        setSplitBillingAddLanes((prev) => {
          const u = prev.map((lane) => ({ ...lane }));
          u[3] = { ...u[3], destination_country_code: normCode };
          return u;
        });
      }
    }

    setSplitBillingAddLanes((prev) => {
      const updated = prev.map((lane) => ({ ...lane }));
      updated[index] = { ...updated[index], [field]: value };

      if (index === 0 && field === 'currency_code') {
        for (let i = 1; i < updated.length; i++) {
          updated[i] = { ...updated[i], currency_code: value };
        }
      }

      const isD2DSB = selectedServiceType === 'Door to Door';

      if (selectedTripType === 'One Way') {
        const d2dSBOriginIsUS = isD2DSB && countryCodes.origin && countryCodes.origin !== 'MX';
        if (d2dSBOriginIsUS) {
          if (index === 0 && field === 'destination_city') {
            const bcCity = borderCrossingCities.find(c => (c.city_full_name || c.city_name) === value);
            const bcCountry = bcCity ? normalizeCountryCode(bcCity.country_code) : undefined;
            updated[1].origin_city = value;
            if (bcCountry) {
              updated[0].destination_country_code = bcCountry;
              updated[1].origin_country_code = bcCountry;
            }
            updated[0].border_crossing = 'N/A';
            updated[0].border_crossing_fee = 0;
          }
          if (index === 1 && field === 'border_crossing') {
          }
        } else {
          if (index === 0 && field === 'border_crossing') {
            const bcCity = borderCrossingCities.find(c => (c.city_full_name || c.city_name) === value);
            const bcCountry = bcCity ? normalizeCountryCode(bcCity.country_code) : undefined;
            updated[0].destination_city = value;
            if (bcCountry) updated[0].destination_country_code = bcCountry;
            updated[1].origin_city = value;
            if (bcCountry) updated[1].origin_country_code = bcCountry;
            updated[1].border_crossing = 'N/A';
            updated[1].border_crossing_fee = 0;
          }
        }
      } else if (selectedTripType === 'Round Trip') {
        if (index === 0 && field === 'origin_city') {
          updated[3].destination_city = value;
        } else if (index === 0 && field === 'border_crossing' && isD2DSB) {
          const bcCity = borderCrossingCities.find(c => (c.city_full_name || c.city_name) === value);
          const bcCountry = bcCity ? normalizeCountryCode(bcCity.country_code) : undefined;
          updated[0].destination_city = value;
          if (bcCountry) updated[0].destination_country_code = bcCountry;
          updated[3].origin_city = value;
          updated[3].border_crossing = value;
          if (bcCountry) updated[3].origin_country_code = bcCountry;
          const destCC = normalizeCountryCode(updated[1].destination_country_code);
          if (destCC && destCC !== 'MX') {
            updated[1].origin_city = value;
            if (bcCountry) updated[1].origin_country_code = bcCountry;
            updated[2].destination_city = value;
            if (bcCountry) updated[2].destination_country_code = bcCountry;
          }
        } else if (index === 1 && field === 'border_crossing' && isD2DSB) {
          const bcCity = borderCrossingCities.find(c => (c.city_full_name || c.city_name) === value);
          const bcCountry = bcCity ? normalizeCountryCode(bcCity.country_code) : undefined;
          updated[1].origin_city = value;
          if (bcCountry) updated[1].origin_country_code = bcCountry;
          updated[2].destination_city = value;
          updated[2].border_crossing = value;
          if (bcCountry) updated[2].destination_country_code = bcCountry;
          const originCC = normalizeCountryCode(updated[0].origin_country_code);
          if (originCC && originCC !== 'MX') {
            updated[0].destination_city = value;
            if (bcCountry) updated[0].destination_country_code = bcCountry;
            updated[3].origin_city = value;
            if (bcCountry) updated[3].origin_country_code = bcCountry;
          }
        } else if (index === 0 && field === 'border_crossing') {
          updated[0].destination_city = value;
          updated[1].origin_city = value;
          updated[1].border_crossing = value;
          updated[2].destination_city = value;
          updated[2].border_crossing = 'N/A';
          updated[3].origin_city = value;
          updated[3].border_crossing = 'N/A';
        } else if (index === 1 && field === 'destination_city') {
          updated[2].origin_city = value;
        }
      } else if (selectedTripType === 'Circuit') {
        if ((index === 0 || index === 1) && field === 'border_crossing' && selectedServiceType === 'Door to Door') {
          const bcCity = borderCrossingCities.find(c => (c.city_full_name || c.city_name) === value);
          const bcCountry = bcCity ? normalizeCountryCode(bcCity.country_code) : undefined;
          updated[0].destination_city = value;
          if (bcCountry) updated[0].destination_country_code = bcCountry;
          updated[1].origin_city = value;
          if (bcCountry) updated[1].origin_country_code = bcCountry;
        } else if ((index === 2 || index === 3) && field === 'border_crossing' && selectedServiceType === 'Door to Door') {
          const bcCity = borderCrossingCities.find(c => (c.city_full_name || c.city_name) === value);
          const bcCountry = bcCity ? normalizeCountryCode(bcCity.country_code) : undefined;
          updated[2].destination_city = value;
          if (bcCountry) updated[2].destination_country_code = bcCountry;
          updated[3].origin_city = value;
          if (bcCountry) updated[3].origin_country_code = bcCountry;
        } else if (index === 0 && field === 'border_crossing') {
          updated[0].destination_city = value;
          updated[1].origin_city = value;
          updated[1].border_crossing = 'N/A';
          updated[2].destination_city = value;
          updated[2].border_crossing = value;
          updated[3].origin_city = value;
          updated[3].border_crossing = 'N/A';
        } else if (index === 1 && field === 'destination_city') {
        } else if (index === 0 && field === 'origin_city') {
        } else if (index === 2 && field === 'origin_city') {
        } else if (index === 3 && field === 'destination_city') {
        }
      }

      return updated;
    });
  };

  const handleFinishAdd = async () => {
    if (isSplitBilling && splitBillingAddLanes.length > 0) {
      const lane1 = splitBillingAddLanes[0];
      const isD2D = selectedServiceType === 'Door to Door';
      const isD2DOneWaySB = isD2D && selectedTripType === 'One Way';
      const d2dSBOriginCC = isD2DOneWaySB && lane1.origin_country_code ? { origin: normalizeCountryCode(lane1.origin_country_code) } : undefined;
      const lane1Fv = getFieldVisibility(lane1, d2dSBOriginCC);
      const lane1Errs: Record<string, string> = {};
      if (!lane1.origin_city) lane1Errs.origin_city = 'This field is required';
      if (isD2DOneWaySB && d2dSBOriginCC?.origin && d2dSBOriginCC.origin !== 'MX') {
        if (!lane1.destination_city) lane1Errs.destination_city = 'This field is required';
      }
      if (!lane1Fv.borderCrossingDisabled && !lane1.border_crossing) lane1Errs.border_crossing = 'This field is required';
      if (!lane1Fv.borderFeeDisabled && (!lane1.border_crossing_fee || lane1.border_crossing_fee === 0)) lane1Errs.border_crossing_fee = 'This field is required';
      if (Object.keys(lane1Errs).length > 0) {
        setValidationErrors({ lane1: lane1Errs, lane2: {}, lane3: {}, lane4: {} });
        return;
      }

      const lane2 = splitBillingAddLanes[1];
      const lane2Fv = getFieldVisibility(lane2, d2dSBOriginCC);
      const lane2Errs: Record<string, string> = {};
      if (!lane2.destination_city) lane2Errs.destination_city = 'This field is required';
      if (!lane2Fv.borderCrossingDisabled && !lane2.border_crossing) lane2Errs.border_crossing = 'This field is required';
      if (!lane2Fv.borderFeeDisabled && (!lane2.border_crossing_fee || lane2.border_crossing_fee === 0)) lane2Errs.border_crossing_fee = 'This field is required';

      const lane3Errs: Record<string, string> = {};
      const lane4Errs: Record<string, string> = {};
      if (isD2D && selectedTripType === 'Circuit' && splitBillingAddLanes.length >= 4) {
        const lane3 = splitBillingAddLanes[2];
        const lane4 = splitBillingAddLanes[3];
        const lane3Fv = getFieldVisibility(lane3);
        const lane4Fv = getFieldVisibility(lane4);
        if (!lane3.origin_city) lane3Errs.origin_city = 'This field is required';
        if (!lane3Fv.borderCrossingDisabled && !lane3.border_crossing) lane3Errs.border_crossing = 'This field is required';
        if (!lane3Fv.borderFeeDisabled && (!lane3.border_crossing_fee || lane3.border_crossing_fee === 0)) lane3Errs.border_crossing_fee = 'This field is required';
        if (!lane4.destination_city) lane4Errs.destination_city = 'This field is required';
        if (!lane4Fv.borderCrossingDisabled && !lane4.border_crossing) lane4Errs.border_crossing = 'This field is required';
        if (!lane4Fv.borderFeeDisabled && (!lane4.border_crossing_fee || lane4.border_crossing_fee === 0)) lane4Errs.border_crossing_fee = 'This field is required';
      }

      if (Object.keys(lane2Errs).length > 0 || Object.keys(lane3Errs).length > 0 || Object.keys(lane4Errs).length > 0) {
        setValidationErrors({
          lane1: {},
          lane2: lane2Errs,
          lane3: lane3Errs,
          lane4: lane4Errs,
        });
        return;
      }

      const countryError = validateDoorToDoorCountries(countryCodes.origin, countryCodes.destination);
      if (countryError) {
        setValidationErrors({
          lane1: {},
          lane2: { destination_city: countryError },
          lane3: {},
          lane4: {},
        });
        return;
      }

      if (selectedServiceType === 'Door to Door' && selectedTripType === 'Circuit') {
        const { lane3Error, lane4Error } = validateCircuitMarkets(laneCityInfo);
        if (lane3Error || lane4Error) {
          setValidationErrors({
            lane1: {},
            lane2: {},
            lane3: { origin_city: lane3Error },
            lane4: { destination_city: lane4Error },
          });
          return;
        }
      }

      const lanesToInsert = splitBillingAddLanes.map((lane) => {
        const { id, ...rest } = lane;
        return prepareSavePayload(rest);
      });

      if (onAddSplitBillingGroup) {
        await onAddSplitBillingGroup(lanesToInsert);
      } else {
        for (let i = 0; i < lanesToInsert.length; i += 2) {
          await onAddLane(lanesToInsert[i], lanesToInsert[i + 1]);
        }
      }

      setIsAdding(false);
      setSplitBillingAddLanes([]);
    } else {
      const addErrs: Record<string, string> = {};
      if (!editData.origin_city) addErrs.origin_city = 'This field is required';
      if (!editData.destination_city) addErrs.destination_city = 'This field is required';
      if (selectedServiceType === 'Loop' && editData.destination_city && loopOriginIsBorder === false) {
        const isValidBorder = borderCrossingCities.some(c => (c.city_full_name || c.city_name) === editData.destination_city);
        if (!isValidBorder) {
          addErrs.destination_city = 'Destination City must be a Border Crossing City when Origin City is not a border city';
        }
      }
      const fvAdd = getFieldVisibility(editData);
      if (!fvAdd.borderCrossingDisabled && !editData.border_crossing) addErrs.border_crossing = 'This field is required';
      if (!fvAdd.borderFeeDisabled && (!editData.border_crossing_fee || editData.border_crossing_fee === 0)) {
        addErrs.border_crossing_fee = 'This field is required';
      }
      const addErrs2: Record<string, string> = {};
      if (selectedServiceType === 'Loop' && (selectedTripType === 'Round Trip' || selectedTripType === 'Circuit')) {
        if (!editData2.border_crossing_fee || editData2.border_crossing_fee === 0) {
          addErrs2.border_crossing_fee = 'This field is required';
        }
      }
      if (selectedServiceType === 'Loop' && selectedTripType === 'Circuit') {
        if (!editData2.origin_city) addErrs2.origin_city = 'This field is required';
        if (!editData2.destination_city) addErrs2.destination_city = 'This field is required';
        if (!editData2.border_crossing) addErrs2.border_crossing = 'This field is required';
      }
      if (selectedServiceType === 'Domestic' && selectedTripType === 'Circuit') {
        if (!editData2.origin_city) addErrs2.origin_city = 'This field is required';
        if (!editData2.destination_city) addErrs2.destination_city = 'This field is required';
      }
      if (selectedServiceType === 'Door to Door' && selectedTripType === 'Round Trip') {
        if (!editData2.border_crossing_fee || editData2.border_crossing_fee === 0) {
          addErrs2.border_crossing_fee = 'This field is required';
        }
      }
      if (Object.keys(addErrs).length > 0 || Object.keys(addErrs2).length > 0) {
        setValidationErrors({ lane1: addErrs, lane2: addErrs2, lane3: {}, lane4: {} });
        return;
      }
      const countryError = validateDoorToDoorCountries(countryCodes.origin, countryCodes.destination);
      if (countryError) {
        setValidationErrors({
          lane1: { destination_city: countryError },
          lane2: {},
          lane3: {},
          lane4: {},
        });
        return;
      }
      const addPayload = prepareSavePayload(editData);
      const addPayload2 = editData2 && selectedTripType !== 'One Way' ? prepareSavePayload(editData2) : undefined;
      await onAddLane(addPayload, addPayload2);
      setIsAdding(false);
    }

    setSelectedServiceType(null);
    setSelectedTripType(null);
    setIsSplitBilling(false);
    setEditData({});
    setEditData2({});
    setSplitBillingAddLanes([]);
    setValidationErrors({ lane1: {}, lane2: {}, lane3: {}, lane4: {} });
    setCountryCodes({});
    setLaneCityInfo({});
  };

  const handleDeleteClick = (lane: QuoteLane) => {
    if (lane.split_billing_group) {
      const groupLanes = lanes.filter(l => l.split_billing_group === lane.split_billing_group);
      setShowDeleteConfirm({ laneId: lane.id, linkedLaneId: lane.paired_lane_id, splitBillingGroup: lane.split_billing_group, splitBillingCount: groupLanes.length });
    } else {
      setShowDeleteConfirm({ laneId: lane.id, linkedLaneId: lane.paired_lane_id });
    }
  };

  const handleConfirmDelete = () => {
    if (!showDeleteConfirm) return;

    if (showDeleteConfirm.splitBillingGroup && onDeleteMultipleLanes) {
      const groupLanes = lanes.filter(l => l.split_billing_group === showDeleteConfirm.splitBillingGroup);
      onDeleteMultipleLanes(groupLanes.map(l => l.id));
    } else if (showDeleteConfirm.linkedLaneId && onDeleteMultipleLanes) {
      onDeleteMultipleLanes([showDeleteConfirm.laneId, showDeleteConfirm.linkedLaneId]);
    } else if (onDeleteMultipleLanes) {
      onDeleteMultipleLanes([showDeleteConfirm.laneId]);
    } else {
      onDeleteLane(showDeleteConfirm.laneId);
    }

    setShowDeleteConfirm(null);
  };

  const handleGlobalEquipmentChange = (type: string) => {
    setShowEquipmentDropdown(false);
    if (onGlobalEquipmentTypeChange) {
      onGlobalEquipmentTypeChange(type);
    }
  };

  const renderDisplayRow = (lane: QuoteLane, index: number) => {
    const isEditing = editingId === lane.id;
    const isInSplitBillingGroup = !!editingGroupLanes[lane.id];
    const isLane1 = isEditing;
    const isLane2 = editingPairedId === lane.id;
    const currentData = isLane1 ? editData : isLane2 ? editData2 : isInSplitBillingGroup ? editingGroupLanes[lane.id] : lane;
    const editSBLaneData = isInSplitBillingGroup ? { ...lane, ...editingGroupLanes[lane.id] } : lane;
    const editD2DOneWaySBOverride = (() => {
      if (!isInSplitBillingGroup || lane.service_type !== 'Door to Door' || lane.trip_type !== 'One Way') return undefined;
      const groupLanes = Object.values(editingGroupLanes);
      const lane1Data = groupLanes.find((l: any) => l.split_billing_index === 1 || (lanes.find(ll => ll.id === Object.keys(editingGroupLanes).find(k => editingGroupLanes[k] === l))?.split_billing_index === 1));
      const lane1FromDb = lanes.find(l => l.split_billing_group === lane.split_billing_group && l.split_billing_index === 1);
      const mergedLane1 = lane1FromDb ? { ...lane1FromDb, ...editingGroupLanes[lane1FromDb.id] } : undefined;
      const originCC = mergedLane1 ? normalizeCountryCode(mergedLane1.origin_country_code) : undefined;
      return originCC ? { origin: originCC } : undefined;
    })();
    const fieldVis = getFieldVisibility(editSBLaneData, editD2DOneWaySBOverride);
    const laneCurrencyEdit = (lane.currency_code || currency || 'USD') as CurrencyCode;
    const isLoopRoundTripLane2 = isLane2 && lane.service_type === 'Loop' && lane.trip_type === 'Round Trip' && lane.is_primary_lane === false;
    const isLoopCircuitLane2 = isLane2 && lane.service_type === 'Loop' && lane.trip_type === 'Circuit' && lane.is_primary_lane === false;
    const isDomesticRoundTripLane2 = isLane2 && lane.service_type === 'Domestic' && lane.trip_type === 'Round Trip' && lane.is_primary_lane === false;
    const isDomesticCircuitLane2 = isLane2 && lane.service_type === 'Domestic' && lane.trip_type === 'Circuit' && lane.is_primary_lane === false;
    const isDoorToDoorRoundTripLane2 = isLane2 && lane.service_type === 'Door to Door' && lane.trip_type === 'Round Trip' && lane.is_primary_lane === false;
    const isDoorToDoorCircuitLane2 = isLane2 && lane.service_type === 'Door to Door' && lane.trip_type === 'Circuit' && lane.is_primary_lane === false;
    const effectiveFieldVis = (isLoopRoundTripLane2 || isLoopCircuitLane2) ? { ...fieldVis, usFieldsDisabled: true } : fieldVis;

    if (isEditing || isLane2 || isInSplitBillingGroup) {
      const usDisabledEdit = effectiveFieldVis.usFieldsDisabled;
      const mxDisabledEdit = effectiveFieldVis.mxFieldsDisabled;
      const editRateType = currentData.rate_type || 'RPM';
      const editUsRateType = isInSplitBillingGroup ? (currentData.us_rate_type || currentData.rate_type || 'RPM') : editRateType;
      const editMxRateType = isInSplitBillingGroup ? (currentData.mx_rate_type || currentData.rate_type || 'RPM') : editRateType;
      const isRpm = editRateType === 'RPM';
      const isUsRpm = isInSplitBillingGroup ? editUsRateType === 'RPM' : isRpm;
      const isMxRpm = isInSplitBillingGroup ? editMxRateType === 'RPM' : isRpm;
      const errKey = isLane1 ? 'lane1' : isInSplitBillingGroup ? `lane${lane.split_billing_index || 1}` : 'lane2';
      const laneErrs = validationErrors[errKey as keyof typeof validationErrors] || {};
      const usEditBg = usDisabledEdit ? '#F3F4F6' : '#EFF6FF';
      const usReadonlyBg = usDisabledEdit ? '#F3F4F6' : '#BFDBFE';
      const mxEditBg = mxDisabledEdit ? '#F3F4F6' : '#F0FDF4';
      const mxReadonlyBg = mxDisabledEdit ? '#F3F4F6' : '#BBF7D0';
      const separatorRight = { borderRight: '2px solid #D1D5DB' };

      const handleRateTypeChange = (newRateType: string) => {
        if (isLane1) {
          const updates: Partial<QuoteLane> = { ...editData, rate_type: newRateType };
          if (newRateType === 'RPM') {
            updates.mx_rate = (editData.mx_miles || 0) * (editData.mx_rate_per_mile || 0);
            updates.us_rate = (editData.us_miles || 0) * (editData.us_rate_per_mile || 0);
          } else {
            updates.mx_rate_per_mile = editData.mx_miles ? (editData.mx_rate || 0) / editData.mx_miles : 0;
            updates.us_rate_per_mile = editData.us_miles ? (editData.us_rate || 0) / editData.us_miles : 0;
          }
          setEditData(updates);
        } else {
          const updates: Partial<QuoteLane> = { ...editData2, rate_type: newRateType };
          if (newRateType === 'RPM') {
            updates.mx_rate = (editData2.mx_miles || 0) * (editData2.mx_rate_per_mile || 0);
            updates.us_rate = (editData2.us_miles || 0) * (editData2.us_rate_per_mile || 0);
          } else {
            updates.mx_rate_per_mile = editData2.mx_miles ? (editData2.mx_rate || 0) / editData2.mx_miles : 0;
            updates.us_rate_per_mile = editData2.us_miles ? (editData2.us_rate || 0) / editData2.us_miles : 0;
          }
          setEditData2(updates);
        }
      };

      return (
        <tr key={lane.id} className={`bg-blue-50 border-b border-gray-200 ${lane.split_billing_group ? 'border-l-4 border-l-blue-500' : ''}`}>
          <td style={{ minWidth: '48px' }} className="px-3 py-2 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span>{index + 1}</span>
              <LaneBadge serviceType={lane.service_type || 'Door to Door'} tripType={lane.trip_type || 'One Way'} isSplitBilling={!!lane.split_billing_group} />
            </div>
          </td>
          <td style={{ minWidth: '128px' }} className="px-2 py-2">
            {isInSplitBillingGroup && lane.service_type === 'Door to Door' && lane.trip_type === 'Circuit' && lane.split_billing_index === 3 ? (
              <>
                <MarketFilteredCityLookup value={currentData.origin_city || ''} onChange={(value, _mkt, countryCode) => { handleFieldChange(lane.id, 'origin_city', value); if (countryCode) handleFieldChange(lane.id, 'origin_country_code', countryCode); }} marketFilter={editLane1Markets.destMarket} placeholder={editLane1Markets.destMarket ? 'Select city...' : '—'} hasError={!!laneErrs.origin_city} disabled={!editLane1Markets.destMarket} disabledMessage="Please select Destination City on Lane 2" />
                {laneErrs.origin_city && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.origin_city}</div>}
              </>
            ) : isInSplitBillingGroup && lane.service_type === 'Door to Door' && lane.trip_type === 'Circuit' && (lane.split_billing_index === 2 || lane.split_billing_index === 4) ? (
              <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}><LockIcon className="w-3 h-3" />{currentData.origin_city || 'Auto'}</div>
            ) : isInSplitBillingGroup && lane.service_type === 'Door to Door' && lane.trip_type === 'One Way' && lane.split_billing_index === 2 ? (
              <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}><LockIcon className="w-3 h-3" />{currentData.origin_city || 'Auto'}</div>
            ) : isDomesticRoundTripLane2 ? (
              <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}><LockIcon className="w-3 h-3" />{editData2.origin_city || 'Auto'}</div>
            ) : isDomesticCircuitLane2 ? (
              <>
                <MarketFilteredCityLookup value={currentData.origin_city || ''} onChange={(value) => handleFieldChange(lane.id, 'origin_city', value)} marketFilter={editLane1Markets.destMarket} placeholder={editLane1Markets.destMarket ? 'Select city...' : '—'} hasError={!!validationErrors.lane2?.origin_city} disabled={!editLane1Markets.destMarket} disabledMessage="Select Lane 1 Dest first" countryFilter="USA" />
                {validationErrors.lane2?.origin_city && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.origin_city}</div>}
              </>
            ) : (isLane2 && lane.trip_type === 'Round Trip') ? (
              <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}><LockIcon className="w-3 h-3" />{editData2.origin_city || 'Auto'}</div>
            ) : (isLoopCircuitLane2 || isDoorToDoorCircuitLane2) ? (
              <>
                <MarketFilteredCityLookup value={currentData.origin_city || ''} onChange={(value, _mkt, countryCode) => { handleFieldChange(lane.id, 'origin_city', value); if (countryCode) handleFieldChange(lane.id, 'origin_country_code', countryCode); }} marketFilter={editLane1Markets.destMarket} placeholder={editLane1Markets.destMarket ? 'Select city...' : '—'} hasError={!!validationErrors.lane2?.origin_city} disabled={!editLane1Markets.destMarket} disabledMessage="Select Lane 1 Dest first" />
                {validationErrors.lane2?.origin_city && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.origin_city}</div>}
              </>
            ) : (
              <>
                <CityLookupField value={currentData.origin_city || ''} onChange={(value, countryCode) => { handleFieldChange(lane.id, 'origin_city', value); if (countryCode) handleFieldChange(lane.id, 'origin_country_code', countryCode); if (lane.service_type === 'Loop' && isLane1) { lookupIsBorderCity(value).then(isBorder => { const prev = editLoopOriginIsBorder; setEditLoopOriginIsBorder(isBorder); if (prev !== null && prev !== isBorder && editData.destination_city) { setEditData(p => ({ ...p, destination_city: '' })); setValidationErrors(p => ({ ...p, lane1: { ...p.lane1, destination_city: 'Please reselect Destination City' } })); } }); } }} placeholder={lane.service_type === 'Loop' ? "Search MX or border cities..." : lane.service_type === 'Domestic' ? "Search US/CAN cities..." : "Origin City"} countryFilter={lane.service_type === 'Loop' ? 'MEX' : lane.service_type === 'Domestic' ? 'US_CAN' : undefined} includeBorderCrossing={lane.service_type === 'Loop'} />
                {isLane1 && laneErrs.origin_city && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.origin_city}</div>}
              </>
            )}
          </td>
          {showStopsBefore && (
            <td style={{ minWidth: '64px' }} className="px-3 py-2 text-center">
              {Array.isArray(lane.stops_before) && lane.stops_before.length > 0 ? (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-700 text-white text-[10px] font-semibold">{lane.stops_before.length}</span>
              ) : (<span className="text-xs text-gray-400">—</span>)}
            </td>
          )}
          {showStopsAfter && (
            <td style={{ minWidth: '64px' }} className="px-3 py-2 text-center">
              {Array.isArray(lane.stops_after) && lane.stops_after.length > 0 ? (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-700 text-white text-[10px] font-semibold">{lane.stops_after.length}</span>
              ) : (<span className="text-xs text-gray-400">—</span>)}
            </td>
          )}
          <td style={{ minWidth: '128px' }} className="px-2 py-2">
            {isInSplitBillingGroup && lane.service_type === 'Door to Door' && lane.trip_type === 'Circuit' && lane.split_billing_index === 4 ? (
              <>
                <MarketFilteredCityLookup value={currentData.destination_city || ''} onChange={(value, _mkt, countryCode) => { handleFieldChange(lane.id, 'destination_city', value); if (countryCode) handleFieldChange(lane.id, 'destination_country_code', countryCode); }} marketFilter={editLane1Markets.originMarket} placeholder={editLane1Markets.originMarket ? 'Select city...' : '—'} hasError={!!laneErrs.destination_city} disabled={!editLane1Markets.originMarket} disabledMessage="Please select Origin City on Lane 1" />
                {laneErrs.destination_city && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.destination_city}</div>}
              </>
            ) : isInSplitBillingGroup && lane.service_type === 'Door to Door' && lane.trip_type === 'Circuit' && (lane.split_billing_index === 1 || lane.split_billing_index === 3) ? (
              <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}><LockIcon className="w-3 h-3" />{currentData.destination_city || 'Auto'}</div>
            ) : isInSplitBillingGroup && lane.service_type === 'Door to Door' && lane.trip_type === 'One Way' && lane.split_billing_index === 1 ? (
              (() => {
                const editOriginCC = editD2DOneWaySBOverride?.origin;
                if (editOriginCC && editOriginCC !== 'MX') {
                  return (
                    <>
                      <BorderCrossingLookup value={currentData.destination_city || ''} onChange={(value) => handleFieldChange(lane.id, 'destination_city', value)} size="sm" placeholder="Select border city" hasError={!!laneErrs.destination_city} />
                      {laneErrs.destination_city && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.destination_city}</div>}
                    </>
                  );
                }
                return <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}><LockIcon className="w-3 h-3" />{currentData.destination_city || 'Auto'}</div>;
              })()
            ) : isInSplitBillingGroup && lane.service_type === 'Door to Door' && lane.trip_type === 'One Way' && lane.split_billing_index === 2 ? (
              (() => {
                const editOriginCC = editD2DOneWaySBOverride?.origin;
                const filterCountry = editOriginCC === 'MX' ? 'US_CAN' : 'MEX';
                const placeholder = editOriginCC === 'MX' ? 'Search US/CAN cities...' : 'Search MX cities...';
                return (
                  <>
                    <div className={laneErrs.destination_city ? 'border-2 border-red-500 rounded' : ''}>
                      <CityLookupField value={currentData.destination_city || ''} onChange={(value, countryCode) => { handleFieldChange(lane.id, 'destination_city', value); if (countryCode) handleFieldChange(lane.id, 'destination_country_code', countryCode); }} placeholder={placeholder} countryFilter={filterCountry} />
                    </div>
                    {laneErrs.destination_city && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.destination_city}</div>}
                  </>
                );
              })()
            ) : isDomesticRoundTripLane2 ? (
              <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}><LockIcon className="w-3 h-3" />{editData2.destination_city || 'Auto'}</div>
            ) : isDomesticCircuitLane2 ? (
              <>
                <MarketFilteredCityLookup value={currentData.destination_city || ''} onChange={(value) => handleFieldChange(lane.id, 'destination_city', value)} marketFilter={editLane1Markets.originMarket} placeholder={editLane1Markets.originMarket ? 'Select city...' : '—'} hasError={!!validationErrors.lane2?.destination_city} disabled={!editLane1Markets.originMarket} disabledMessage="Select Lane 1 Origin first" countryFilter="USA" />
                {validationErrors.lane2?.destination_city && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.destination_city}</div>}
              </>
            ) : (isLane2 && lane.trip_type === 'Round Trip') ? (
              <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}><LockIcon className="w-3 h-3" />{editData2.destination_city || 'Auto'}</div>
            ) : (isLoopCircuitLane2 || isDoorToDoorCircuitLane2) ? (
              <>
                <MarketFilteredCityLookup value={currentData.destination_city || ''} onChange={(value, _mkt, countryCode) => { handleFieldChange(lane.id, 'destination_city', value); if (countryCode) handleFieldChange(lane.id, 'destination_country_code', countryCode); }} marketFilter={editLane1Markets.originMarket} placeholder={editLane1Markets.originMarket ? 'Select city...' : '—'} hasError={!!validationErrors.lane2?.destination_city} disabled={!editLane1Markets.originMarket} disabledMessage="Select Lane 1 Origin first" />
                {validationErrors.lane2?.destination_city && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.destination_city}</div>}
              </>
            ) : lane.service_type === 'Loop' && isLane1 && editLoopOriginIsBorder === true ? (
              <>
                <CityLookupField value={currentData.destination_city || ''} onChange={(value) => handleFieldChange(lane.id, 'destination_city', value)} placeholder="Search MX cities..." countryFilter="MEX" />
                {laneErrs.destination_city && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.destination_city}</div>}
              </>
            ) : lane.service_type === 'Loop' ? (
              <>
                <BorderCrossingLookup value={currentData.destination_city || ''} onChange={(value) => handleFieldChange(lane.id, 'destination_city', value)} size="sm" placeholder="Select border city" hasError={!!(isLane1 && laneErrs.destination_city)} />
                {isLane1 && laneErrs.destination_city && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.destination_city}</div>}
              </>
            ) : (
              <>
                <CityLookupField value={currentData.destination_city || ''} onChange={(value) => handleFieldChange(lane.id, 'destination_city', value)} placeholder={lane.service_type === 'Domestic' ? "Search US/CAN cities..." : lane.service_type === 'Door to Door' ? (() => { const oc = normalizeCountryCode(currentData.origin_country_code); return oc === 'MX' ? 'Search US/CAN cities...' : (oc === 'US' || oc === 'CA') ? 'Search MX cities...' : 'Destination City'; })() : "Destination City"} countryFilter={lane.service_type === 'Domestic' ? 'US_CAN' : lane.service_type === 'Door to Door' ? (() => { const oc = normalizeCountryCode(currentData.origin_country_code); if (oc === 'MX') return 'US_CAN'; if (oc === 'US' || oc === 'CA') return 'MEX'; return undefined; })() : undefined} />
                {isLane1 && laneErrs.destination_city && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.destination_city}</div>}
              </>
            )}
          </td>
          <td style={{ minWidth: '128px' }} className="px-2 py-2">
            {(isDomesticRoundTripLane2 || isDomesticCircuitLane2) ? (
              <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}><LockIcon className="w-3 h-3" />N/A</div>
            ) : (isLane2 && lane.trip_type === 'Round Trip') ? (
              <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}><LockIcon className="w-3 h-3" />{editData2.border_crossing || 'Auto'}</div>
            ) : fieldVis.borderCrossingDisabled ? (
              <div className="w-full px-2 py-1 text-xs rounded text-gray-500 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}>
                <LockIcon className="w-3 h-3" />
                {currentData.border_crossing && currentData.border_crossing !== 'N/A' ? currentData.border_crossing : 'N/A'}
              </div>
            ) : (
              <>
                <BorderCrossingLookup value={currentData.border_crossing || ''} onChange={(value) => handleFieldChange(lane.id, 'border_crossing', value)} size="sm" placeholder="Select border" hasError={!!laneErrs.border_crossing} />
                {laneErrs.border_crossing && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.border_crossing}</div>}
              </>
            )}
          </td>
          <td style={{ minWidth: '100px' }} className="px-2 py-2">
            {effectiveFieldVis.borderFeeDisabled ? (
              <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>{laneCurrencyEdit} $0.00</div>
            ) : (
              <>
                <GridCurrencyInput value={currentData.border_crossing_fee || 0} onChange={(v) => handleFieldChange(lane.id, 'border_crossing_fee', v)} currencyCode={laneCurrencyEdit} hasError={!!((isLane1 && validationErrors.lane1?.border_crossing_fee) || (isLane2 && validationErrors.lane2?.border_crossing_fee))} />
                {isLane1 && validationErrors.lane1?.border_crossing_fee && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane1.border_crossing_fee}</div>}
                {isLane2 && validationErrors.lane2?.border_crossing_fee && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.border_crossing_fee}</div>}
              </>
            )}
          </td>
          <td style={{ minWidth: '120px', ...separatorRight }} className="px-2 py-2">
            <ReadOnlyCell value={calculateLaneTotal(currentData)} isCurrency currencyCode={laneCurrencyEdit} />
          </td>

          <td style={{ minWidth: '80px', backgroundColor: usEditBg }} className="px-2 py-2">
            {usDisabledEdit ? (
              <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div>
            ) : (
              <>
                <input type="number" step="0.01" value={currentData.us_miles || 0} onChange={(e) => handleFieldChange(lane.id, 'us_miles', parseFloat(e.target.value) || 0)} className={`w-full px-2 py-1 text-xs border rounded text-right bg-white ${laneErrs.us_miles ? 'border-2 border-red-500' : 'border-gray-300'}`} />
                {laneErrs.us_miles && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.us_miles}</div>}
              </>
            )}
          </td>
          <td style={{ minWidth: '100px', backgroundColor: usEditBg }} className="px-2 py-2">
            {usDisabledEdit ? (
              <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={laneCurrencyEdit} />
            ) : (
              <>
                <GridCurrencyInput value={currentData.us_fuel_rate || 0} onChange={(v) => handleFieldChange(lane.id, 'us_fuel_rate', v)} currencyCode={laneCurrencyEdit} hasError={!!laneErrs.us_fuel_rate} />
                {laneErrs.us_fuel_rate && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.us_fuel_rate}</div>}
              </>
            )}
          </td>
          <td style={{ minWidth: '100px', backgroundColor: usDisabledEdit ? '#F3F4F6' : (isUsRpm ? usReadonlyBg : usEditBg) }} className="px-2 py-2">
            {usDisabledEdit ? (
              <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={laneCurrencyEdit} />
            ) : isUsRpm ? (
              <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: usReadonlyBg }}>{formatCurrencyOrDash((currentData.us_miles || 0) * (currentData.us_rate_per_mile || 0), laneCurrencyEdit)}</div>
            ) : (
              <>
                <GridCurrencyInput value={currentData.us_rate || 0} onChange={(v) => handleFieldChange(lane.id, 'us_rate', v)} currencyCode={laneCurrencyEdit} hasError={!!laneErrs.us_rate} />
                {laneErrs.us_rate && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.us_rate}</div>}
              </>
            )}
          </td>
          <td style={{ minWidth: '100px', backgroundColor: usDisabledEdit ? '#F3F4F6' : (!isUsRpm ? usReadonlyBg : usEditBg) }} className="px-2 py-2">
            {usDisabledEdit ? (
              <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={laneCurrencyEdit} />
            ) : !isUsRpm ? (
              <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: usReadonlyBg }}>{formatCurrencyOrDash(currentData.us_miles ? (currentData.us_rate || 0) / currentData.us_miles : 0, laneCurrencyEdit)}</div>
            ) : (
              <>
                <GridCurrencyInput value={currentData.us_rate_per_mile || 0} onChange={(v) => handleFieldChange(lane.id, 'us_rate_per_mile', v)} currencyCode={laneCurrencyEdit} hasError={!!laneErrs.us_rate_per_mile} />
                {laneErrs.us_rate_per_mile && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.us_rate_per_mile}</div>}
              </>
            )}
          </td>
          <td style={{ minWidth: '80px', backgroundColor: usEditBg }} className="px-2 py-2">
            {usDisabledEdit ? (
              <div className="w-full px-2 py-1 text-xs rounded text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div>
            ) : isInSplitBillingGroup ? (
              <select value={editUsRateType} onChange={(e) => handleFieldChange(lane.id, 'us_rate_type', e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white">
                {RATE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            ) : (
              <select value={editRateType} onChange={(e) => handleRateTypeChange(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white">
                {RATE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            )}
          </td>
          <td style={{ minWidth: '100px', backgroundColor: usReadonlyBg }} className="px-2 py-2">
            <ReadOnlyCell value={usDisabledEdit ? 0 : calculateTotalUSFuel(currentData)} isCurrency currencyCode={laneCurrencyEdit} />
          </td>
          <td style={{ minWidth: '100px', backgroundColor: usReadonlyBg }} className="px-2 py-2">
            <ReadOnlyCell value={usDisabledEdit ? 0 : calculateUSFixedCosts(currentData)} isCurrency currencyCode={laneCurrencyEdit} />
          </td>
          <td style={{ minWidth: '100px', backgroundColor: usReadonlyBg }} className="px-2 py-2">
            <ReadOnlyCell value={usDisabledEdit ? 0 : calculateUSVariableCosts(currentData)} isCurrency currencyCode={laneCurrencyEdit} />
          </td>
          <td style={{ minWidth: '100px', backgroundColor: usReadonlyBg, ...separatorRight }} className="px-2 py-2">
            <ReadOnlyCell value={calculateUSPortion(currentData)} isCurrency currencyCode={laneCurrencyEdit} />
          </td>

          <td style={{ minWidth: '80px', backgroundColor: mxEditBg }} className="px-2 py-2">
            {mxDisabledEdit ? (
              <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div>
            ) : (
              <>
                <input type="number" step="0.01" value={currentData.mx_miles || 0} onChange={(e) => handleFieldChange(lane.id, 'mx_miles', parseFloat(e.target.value) || 0)} className={`w-full px-2 py-1 text-xs border rounded text-right bg-white ${laneErrs.mx_miles ? 'border-2 border-red-500' : 'border-gray-300'}`} />
                {laneErrs.mx_miles && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.mx_miles}</div>}
              </>
            )}
          </td>
          <td style={{ minWidth: '100px', backgroundColor: mxEditBg }} className="px-2 py-2">
            {mxDisabledEdit ? (
              <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={laneCurrencyEdit} />
            ) : (
              <>
                <GridCurrencyInput value={currentData.mx_fuel_rate || 0} onChange={(v) => handleFieldChange(lane.id, 'mx_fuel_rate', v)} currencyCode={laneCurrencyEdit} hasError={!!laneErrs.mx_fuel_rate} />
                {laneErrs.mx_fuel_rate && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.mx_fuel_rate}</div>}
              </>
            )}
          </td>
          <td style={{ minWidth: '100px', backgroundColor: mxDisabledEdit ? '#F3F4F6' : (isMxRpm ? mxReadonlyBg : mxEditBg) }} className="px-2 py-2">
            {mxDisabledEdit ? (
              <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={laneCurrencyEdit} />
            ) : isMxRpm ? (
              <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: mxReadonlyBg }}>{formatCurrencyOrDash((currentData.mx_miles || 0) * (currentData.mx_rate_per_mile || 0), laneCurrencyEdit)}</div>
            ) : (
              <>
                <GridCurrencyInput value={currentData.mx_rate || 0} onChange={(v) => handleFieldChange(lane.id, 'mx_rate', v)} currencyCode={laneCurrencyEdit} hasError={!!laneErrs.mx_rate} />
                {laneErrs.mx_rate && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.mx_rate}</div>}
              </>
            )}
          </td>
          <td style={{ minWidth: '100px', backgroundColor: mxDisabledEdit ? '#F3F4F6' : (!isMxRpm ? mxReadonlyBg : mxEditBg) }} className="px-2 py-2">
            {mxDisabledEdit ? (
              <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={laneCurrencyEdit} />
            ) : !isMxRpm ? (
              <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: mxReadonlyBg }}>{formatCurrencyOrDash(currentData.mx_miles ? (currentData.mx_rate || 0) / currentData.mx_miles : 0, laneCurrencyEdit)}</div>
            ) : (
              <>
                <GridCurrencyInput value={currentData.mx_rate_per_mile || 0} onChange={(v) => handleFieldChange(lane.id, 'mx_rate_per_mile', v)} currencyCode={laneCurrencyEdit} hasError={!!laneErrs.mx_rate_per_mile} />
                {laneErrs.mx_rate_per_mile && <div className="text-[10px] text-red-500 mt-0.5">{laneErrs.mx_rate_per_mile}</div>}
              </>
            )}
          </td>
          <td style={{ minWidth: '80px', backgroundColor: mxEditBg }} className="px-2 py-2">
            {mxDisabledEdit ? (
              <div className="w-full px-2 py-1 text-xs rounded text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div>
            ) : isInSplitBillingGroup ? (
              <select value={editMxRateType} onChange={(e) => handleFieldChange(lane.id, 'mx_rate_type', e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white">
                {RATE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            ) : (
              <select value={editRateType} onChange={(e) => handleRateTypeChange(e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white">
                {RATE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </select>
            )}
          </td>
          <td style={{ minWidth: '100px', backgroundColor: mxReadonlyBg }} className="px-2 py-2">
            <ReadOnlyCell value={mxDisabledEdit ? 0 : calculateTotalMXFuel(currentData)} isCurrency currencyCode={laneCurrencyEdit} />
          </td>
          <td style={{ minWidth: '100px', backgroundColor: mxReadonlyBg }} className="px-2 py-2">
            <ReadOnlyCell value={mxDisabledEdit ? 0 : calculateMXFixedCosts(currentData)} isCurrency currencyCode={laneCurrencyEdit} />
          </td>
          <td style={{ minWidth: '100px', backgroundColor: mxReadonlyBg }} className="px-2 py-2">
            <ReadOnlyCell value={mxDisabledEdit ? 0 : calculateMXVariableCosts(currentData)} isCurrency currencyCode={laneCurrencyEdit} />
          </td>
          <td style={{ minWidth: '100px', backgroundColor: mxReadonlyBg, ...separatorRight }} className="px-2 py-2">
            <ReadOnlyCell value={calculateMXPortion(currentData)} isCurrency currencyCode={laneCurrencyEdit} />
          </td>

          <td style={{ minWidth: '120px' }} className="px-2 py-2">
            <ReadOnlyCell value={calculateLaneTotal(currentData)} isCurrency currencyCode={laneCurrencyEdit} />
          </td>
          <td style={{ minWidth: '100px' }} className="px-3 py-2">
            {isLane1 && (
              <div className="flex gap-1">
                <button onClick={handleSaveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-3 h-3" /></button>
                <button onClick={handleCancelEdit} className="p-1 text-gray-600 hover:bg-gray-100 rounded"><X className="w-3 h-3" /></button>
              </div>
            )}
          </td>
        </tr>
      );
    }

    const laneCurrency = (lane.currency_code || 'USD') as CurrencyCode;

    const fvDisplay = getFieldVisibility(lane);
    const usDisabled = fvDisplay.usFieldsDisabled;
    const mxDisabled = fvDisplay.mxFieldsDisabled;
    const usRateType = lane.us_rate_type || lane.rate_type || 'RPM';
    const mxRateType = lane.mx_rate_type || lane.rate_type || 'RPM';
    const usCellBg = usDisabled ? '#F3F4F6' : '#EFF6FF';
    const mxCellBg = mxDisabled ? '#F3F4F6' : '#F0FDF4';
    const separatorRight = { borderRight: '2px solid #D1D5DB' };

    return (
      <tr key={lane.id} className={`border-b border-gray-200 ${laneStatusMap[lane.id] ? getLaneStatusStyle(lane.id) : (lane.split_billing_group ? 'border-l-4 border-l-blue-500' : '')}`}>
        <td style={{ minWidth: '48px' }} className="px-3 py-2 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span>{index + 1}</span>
            <LaneBadge serviceType={lane.service_type || 'Door to Door'} tripType={lane.trip_type || 'One Way'} isSplitBilling={!!lane.split_billing_group} />
          </div>
        </td>
        <td style={{ minWidth: '128px' }} className={`px-3 py-2 text-sm ${lane.is_auto_populated ? 'text-gray-600' : 'text-gray-900'}`}>
          <div className="flex items-center gap-2">
            {lane.origin_city}
            {lane.is_auto_populated && <LockIcon className="w-3 h-3 text-gray-400" />}
          </div>
        </td>
        {showStopsBefore && (
          <td style={{ minWidth: '64px' }} className="px-3 py-2 text-center">
            {Array.isArray(lane.stops_before) && lane.stops_before.length > 0 ? (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-700 text-white text-[10px] font-semibold">{lane.stops_before.length}</span>
            ) : (
              <span className="text-xs text-gray-400">—</span>
            )}
          </td>
        )}
        {showStopsAfter && (
          <td style={{ minWidth: '64px' }} className="px-3 py-2 text-center">
            {Array.isArray(lane.stops_after) && lane.stops_after.length > 0 ? (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-700 text-white text-[10px] font-semibold">{lane.stops_after.length}</span>
            ) : (
              <span className="text-xs text-gray-400">—</span>
            )}
          </td>
        )}
        <td style={{ minWidth: '128px' }} className={`px-3 py-2 text-sm ${lane.is_auto_populated ? 'text-gray-600' : 'text-gray-900'}`}>
          <div className="flex items-center gap-2">
            {lane.destination_city}
            {lane.is_auto_populated && <LockIcon className="w-3 h-3 text-gray-400" />}
          </div>
        </td>
        <td style={{ minWidth: '128px' }} className={`px-3 py-2 text-sm ${lane.is_auto_populated ? 'text-gray-600' : 'text-gray-900'}`}>
          <div className="flex items-center gap-2">
            {lane.border_crossing}
            {lane.is_auto_populated && <LockIcon className="w-3 h-3 text-gray-400" />}
            {lane.border_crossing && lane.border_crossing !== 'N/A' && lane.is_auto_populated && borderCrossingCities.length > 0 && !borderCrossingCities.find(c => (c.city_full_name || c.city_name) === lane.border_crossing) && (
              <span className="text-amber-600 text-xs font-semibold cursor-help" title={`Border Crossing City ${lane.border_crossing} is no longer marked as a border crossing. Please review this lane.`}>!</span>
            )}
          </div>
        </td>
        <td style={{ minWidth: '100px' }} className="px-3 py-2 text-sm text-right">{formatCurrencyOrDash(lane.border_crossing_fee || 0, laneCurrency)}</td>
        <td style={{ minWidth: '120px', ...separatorRight }} className="px-3 py-2 text-sm text-right font-semibold">
          <ReadOnlyCell value={calculateLaneTotal(lane)} isCurrency currencyCode={laneCurrency} />
        </td>

        <td style={{ minWidth: '80px', backgroundColor: usCellBg }} className="px-3 py-2 text-sm text-right">{usDisabled ? '—' : (lane.us_miles || 0).toFixed(2)}</td>
        <td style={{ minWidth: '100px', backgroundColor: usCellBg }} className="px-3 py-2 text-sm text-right">{usDisabled ? '—' : formatCurrencyOrDash(lane.us_fuel_rate || 0, laneCurrency)}</td>
        <td style={{ minWidth: '100px', backgroundColor: usCellBg }} className="px-3 py-2 text-sm text-right">{usDisabled ? '—' : formatCurrencyOrDash(lane.us_rate || 0, laneCurrency)}</td>
        <td style={{ minWidth: '100px', backgroundColor: usCellBg }} className="px-3 py-2 text-sm text-right">{usDisabled ? '—' : formatCurrencyOrDash(lane.us_rate_per_mile || 0, laneCurrency)}</td>
        <td style={{ minWidth: '80px', backgroundColor: usCellBg }} className="px-3 py-2 text-sm">{usDisabled ? '—' : usRateType}</td>
        <td style={{ minWidth: '100px', backgroundColor: usCellBg }} className="px-3 py-2 text-sm text-right"><ReadOnlyCell value={usDisabled ? 0 : calculateTotalUSFuel(lane)} isCurrency currencyCode={laneCurrency} /></td>
        <td style={{ minWidth: '100px', backgroundColor: usCellBg }} className="px-3 py-2 text-sm text-right"><ReadOnlyCell value={usDisabled ? 0 : calculateUSFixedCosts(lane)} isCurrency currencyCode={laneCurrency} /></td>
        <td style={{ minWidth: '100px', backgroundColor: usCellBg }} className="px-3 py-2 text-sm text-right"><ReadOnlyCell value={usDisabled ? 0 : calculateUSVariableCosts(lane)} isCurrency currencyCode={laneCurrency} /></td>
        <td style={{ minWidth: '100px', backgroundColor: usCellBg, ...separatorRight }} className="px-3 py-2 text-sm text-right"><ReadOnlyCell value={calculateUSPortion(lane)} isCurrency currencyCode={laneCurrency} /></td>

        <td style={{ minWidth: '80px', backgroundColor: mxCellBg }} className="px-3 py-2 text-sm text-right">{mxDisabled ? '—' : (lane.mx_miles || 0).toFixed(2)}</td>
        <td style={{ minWidth: '100px', backgroundColor: mxCellBg }} className="px-3 py-2 text-sm text-right">{mxDisabled ? '—' : formatCurrencyOrDash(lane.mx_fuel_rate || 0, laneCurrency)}</td>
        <td style={{ minWidth: '100px', backgroundColor: mxCellBg }} className="px-3 py-2 text-sm text-right">{mxDisabled ? '—' : formatCurrencyOrDash(lane.mx_rate || 0, laneCurrency)}</td>
        <td style={{ minWidth: '100px', backgroundColor: mxCellBg }} className="px-3 py-2 text-sm text-right">{mxDisabled ? '—' : formatCurrencyOrDash(lane.mx_rate_per_mile || 0, laneCurrency)}</td>
        <td style={{ minWidth: '80px', backgroundColor: mxCellBg }} className="px-3 py-2 text-sm">{mxDisabled ? '—' : mxRateType}</td>
        <td style={{ minWidth: '100px', backgroundColor: mxCellBg }} className="px-3 py-2 text-sm text-right"><ReadOnlyCell value={mxDisabled ? 0 : calculateTotalMXFuel(lane)} isCurrency currencyCode={laneCurrency} /></td>
        <td style={{ minWidth: '100px', backgroundColor: mxCellBg }} className="px-3 py-2 text-sm text-right"><ReadOnlyCell value={mxDisabled ? 0 : calculateMXFixedCosts(lane)} isCurrency currencyCode={laneCurrency} /></td>
        <td style={{ minWidth: '100px', backgroundColor: mxCellBg }} className="px-3 py-2 text-sm text-right"><ReadOnlyCell value={mxDisabled ? 0 : calculateMXVariableCosts(lane)} isCurrency currencyCode={laneCurrency} /></td>
        <td style={{ minWidth: '100px', backgroundColor: mxCellBg, ...separatorRight }} className="px-3 py-2 text-sm text-right"><ReadOnlyCell value={calculateMXPortion(lane)} isCurrency currencyCode={laneCurrency} /></td>

        <td style={{ minWidth: '120px' }} className="px-3 py-2 text-sm text-right font-semibold">
          <ReadOnlyCell value={calculateLaneTotal(lane)} isCurrency currencyCode={laneCurrency} />
        </td>
        <td style={{ minWidth: '100px' }} className="px-3 py-2">
          <div className="flex gap-1">
            <button onClick={() => !locked && handleEdit(lane)} disabled={locked} className={`p-1 rounded ${locked ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`} title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => onShowDetails(lane)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Details"><FileText className="w-3.5 h-3.5" /></button>
            <button onClick={() => onBenchmarkLane?.(lane)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Benchmark this lane"><BarChart2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => !locked && onToggleLaneCurrency?.(lane)} disabled={locked} className={`p-1 rounded ${locked ? 'text-gray-300 cursor-not-allowed' : 'text-green-600 hover:bg-green-50'}`} title={`Currency: ${lane.currency_code || 'USD'}`}><DollarSign className="w-3.5 h-3.5" /></button>
            <button onClick={() => !locked && onDuplicateLane?.(lane)} disabled={locked} className={`p-1 rounded ${locked ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`} title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
            <button onClick={() => !locked && handleDeleteClick(lane)} disabled={locked} className={`p-1 rounded ${locked ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`} title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </td>
      </tr>
    );
  };

  const showStopsBefore = lanes.some(l => Array.isArray(l.stops_before) && l.stops_before.length > 0);
  const showStopsAfter = lanes.some(l => Array.isArray(l.stops_after) && l.stops_after.length > 0);

  const laneAcceptance = quote?.lane_acceptance || {};
  const hasAcceptance = Object.keys(laneAcceptance).length > 0;

  const laneStatusMap: Record<string, 'accepted' | 'rejected' | 'negotiate'> = {};
  if (hasAcceptance) {
    for (const [, group] of Object.entries(laneAcceptance)) {
      if (group.lane_ids && group.status) {
        for (const laneId of group.lane_ids) {
          laneStatusMap[laneId] = group.status;
        }
      }
    }
  }

  const acceptedLaneCount = Object.values(laneStatusMap).filter(s => s === 'accepted').length;
  const rejectedLaneCount = Object.values(laneStatusMap).filter(s => s === 'rejected').length;
  const negotiateLaneCount = Object.values(laneStatusMap).filter(s => s === 'negotiate').length;

  const getLaneStatusStyle = (laneId: string): string => {
    const status = laneStatusMap[laneId];
    if (!status) return '';
    if (status === 'accepted') return 'border-l-[3px] border-l-green-500 bg-green-50/30';
    if (status === 'rejected') return 'border-l-[3px] border-l-red-500 bg-red-50/30';
    if (status === 'negotiate') return 'border-l-[3px] border-l-blue-500 bg-blue-50/30';
    return '';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {hasAcceptance && (
        <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer Response:</span>
          {acceptedLaneCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-green-100 text-green-700 rounded-full">
              <CheckCircle className="w-3 h-3" /> {acceptedLaneCount} Accepted
            </span>
          )}
          {rejectedLaneCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-red-100 text-red-700 rounded-full">
              <X className="w-3 h-3" /> {rejectedLaneCount} Rejected
            </span>
          )}
          {negotiateLaneCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-700 rounded-full">
              <ArrowLeftRight className="w-3 h-3" /> {negotiateLaneCount} Negotiating
            </span>
          )}
        </div>
      )}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Quote Lanes</h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{lanes.length} {lanes.length === 1 ? 'lane' : 'lanes'}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowEquipmentDropdown(!showEquipmentDropdown)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
            >
              <Truck className="w-4 h-4" />
              <span>Equipment Type</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {showEquipmentDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                {EQUIPMENT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => handleGlobalEquipmentChange(type)}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors first:rounded-t-md last:rounded-b-md"
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleStartAdd}
            disabled={isAdding || editingId !== null || locked}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              locked ? 'bg-gray-300 text-gray-500' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            New Lane
          </button>
        </div>
      </div>

      <div className="lanes-grid-container min-h-[520px]">
        <table className="lanes-grid divide-y divide-gray-200">
          <thead className="sticky top-0 z-30 bg-gray-50">
            <GridHeader showStopsBefore={showStopsBefore} showStopsAfter={showStopsAfter} />
          </thead>
          <tbody className="divide-y divide-gray-200">
            {lanes.map((lane, index) => renderDisplayRow(lane, index))}
            {isAdding && isSplitBilling && splitBillingAddLanes.length > 0 && splitBillingAddLanes.map((lane, index) => {
              const isFirstLane = index === 0;
              const isLastLane = index === splitBillingAddLanes.length - 1;
              const isAutoPopulated = lane.is_auto_populated;

              return (
                <tr key={lane.id} className="bg-blue-50 border-b border-gray-200 border-l-4 border-l-blue-500">
                  <td style={{ minWidth: '48px' }} className="px-3 py-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <span>{lanes.length + index + 1}</span>
                      <LaneBadge serviceType={selectedServiceType || 'Door to Door'} tripType={selectedTripType || 'One Way'} isSplitBilling={true} />
                    </div>
                  </td>
                  <td style={{ minWidth: '128px' }} className="px-2 py-2">
                    {(() => {
                      const isD2DCircuitSB = selectedServiceType === 'Door to Door' && selectedTripType === 'Circuit';
                      const isOriginAuto = selectedTripType === 'Round Trip'
                        ? index >= 1
                        : selectedTripType === 'Circuit'
                          ? (index === 1 || index === 3)
                          : (selectedTripType === 'One Way' ? index === 1 : false);
                      if (isD2DCircuitSB && index === 2) {
                        return (
                          <>
                            <MarketFilteredCityLookup
                              value={lane.origin_city || ''}
                              onChange={(value, _mkt, countryCode) => handleSplitBillingLaneChange(index, 'origin_city', value, countryCode)}
                              marketFilter={addLane1Markets.destMarket}
                              placeholder={addLane1Markets.destMarket ? 'Select city...' : '—'}
                              hasError={!!validationErrors.lane3?.origin_city}
                              disabled={!addLane1Markets.destMarket}
                              disabledMessage="Please select Destination City on Lane 2"
                            />
                            {validationErrors.lane3?.origin_city && <div className="text-xs text-red-500 mt-1">{validationErrors.lane3.origin_city}</div>}
                          </>
                        );
                      }
                      if (isOriginAuto) {
                        return (
                          <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}>
                            <LockIcon className="w-3 h-3" />
                            {lane.origin_city || 'Auto'}
                          </div>
                        );
                      }
                      return (
                        <>
                          <div className={isFirstLane && validationErrors.lane1?.origin_city ? 'border-2 border-red-500 rounded' : ''}>
                            <CityLookupField
                              value={lane.origin_city || ''}
                              onChange={(value, countryCode, cityInfo) => handleSplitBillingLaneChange(index, 'origin_city', value, countryCode, cityInfo)}
                              placeholder="Origin City"
                            />
                          </div>
                          {isFirstLane && validationErrors.lane1?.origin_city && <div className="text-xs text-red-500 mt-1">{validationErrors.lane1.origin_city}</div>}
                        </>
                      );
                    })()}
                  </td>
                  {showStopsBefore && <td style={{ minWidth: '64px' }} className="px-3 py-2" />}
                  {showStopsAfter && <td style={{ minWidth: '64px' }} className="px-3 py-2" />}
                  <td style={{ minWidth: '128px' }} className="px-2 py-2">
                    {(() => {
                      const isD2DCircuitSB = selectedServiceType === 'Door to Door' && selectedTripType === 'Circuit';
                      const isD2DOneWaySB = selectedServiceType === 'Door to Door' && selectedTripType === 'One Way';
                      const d2dSBOriginIsUS = isD2DOneWaySB && countryCodes.origin && countryCodes.origin !== 'MX';
                      const isDestAuto = selectedTripType === 'Round Trip'
                        ? (index === 0 || index >= 2)
                        : selectedTripType === 'Circuit'
                          ? (index === 0 || index === 2)
                          : (selectedTripType === 'One Way' ? (d2dSBOriginIsUS ? false : index === 0) : false);
                      if (isD2DCircuitSB && index === 3) {
                        return (
                          <>
                            <MarketFilteredCityLookup
                              value={lane.destination_city || ''}
                              onChange={(value, _mkt, countryCode) => handleSplitBillingLaneChange(index, 'destination_city', value, countryCode)}
                              marketFilter={addLane1Markets.originMarket}
                              placeholder={addLane1Markets.originMarket ? 'Select city...' : '—'}
                              hasError={!!validationErrors.lane4?.destination_city}
                              disabled={!addLane1Markets.originMarket}
                              disabledMessage="Please select Destination City on Lane 1"
                            />
                            {validationErrors.lane4?.destination_city && <div className="text-xs text-red-500 mt-1">{validationErrors.lane4.destination_city}</div>}
                          </>
                        );
                      }
                      if (isD2DOneWaySB && d2dSBOriginIsUS && index === 0) {
                        return (
                          <>
                            <BorderCrossingLookup
                              value={lane.destination_city || ''}
                              onChange={(value) => handleSplitBillingLaneChange(index, 'destination_city', value)}
                              size="sm"
                              placeholder="Select border city"
                              hasError={!!validationErrors.lane1?.destination_city}
                            />
                            {validationErrors.lane1?.destination_city && <div className="text-xs text-red-500 mt-1">{validationErrors.lane1.destination_city}</div>}
                          </>
                        );
                      }
                      if (isDestAuto) {
                        return (
                          <>
                            <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}>
                              <LockIcon className="w-3 h-3" />
                              {lane.destination_city || 'Auto'}
                            </div>
                          </>
                        );
                      }
                      return (
                        <>
                          <div className={index === 1 && validationErrors.lane2?.destination_city ? 'border-2 border-red-500 rounded' : ''}>
                            <CityLookupField
                              value={lane.destination_city || ''}
                              onChange={(value, countryCode, cityInfo) => handleSplitBillingLaneChange(index, 'destination_city', value, countryCode, cityInfo)}
                              placeholder={index === 1 && selectedServiceType === 'Door to Door' && countryCodes.origin ? (countryCodes.origin === 'MX' ? 'Search US/CAN cities...' : 'Search MX cities...') : 'Destination City'}
                              countryFilter={index === 1 && selectedServiceType === 'Door to Door' && countryCodes.origin ? (countryCodes.origin === 'MX' ? 'US_CAN' : 'MEX') : undefined}
                            />
                          </div>
                          {index === 1 && validationErrors.lane2?.destination_city && <div className="text-xs text-red-500 mt-1">{validationErrors.lane2.destination_city}</div>}
                        </>
                      );
                    })()}
                  </td>
                  <td style={{ minWidth: '128px' }} className="px-2 py-2">
                    {(() => {
                      const laneOriginCC = lane.origin_country_code ? normalizeCountryCode(lane.origin_country_code) : undefined;
                      const laneDestCC = lane.destination_country_code ? normalizeCountryCode(lane.destination_country_code) : undefined;
                      const laneAnyMX = laneOriginCC === 'MX' || laneDestCC === 'MX';
                      const isD2DRTSB = selectedServiceType === 'Door to Door' && (selectedTripType === 'Round Trip' || selectedTripType === 'Circuit');
                      const isD2DOneWaySB = selectedServiceType === 'Door to Door' && selectedTripType === 'One Way';
                      const d2dSBOriginIsUS = isD2DOneWaySB && countryCodes.origin && countryCodes.origin !== 'MX';
                      let bcEditable = false;
                      if (isD2DRTSB) {
                        bcEditable = laneAnyMX;
                      } else if (isD2DOneWaySB) {
                        bcEditable = d2dSBOriginIsUS ? index === 1 : index === 0;
                      } else {
                        bcEditable = index === 0;
                      }
                      if (!bcEditable) {
                        const displayVal = (isD2DRTSB && !laneAnyMX) ? 'N/A' : (isD2DOneWaySB ? 'N/A' : (lane.border_crossing === 'N/A' ? 'N/A' : (lane.border_crossing || 'Auto')));
                        return (
                          <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}>
                            <LockIcon className="w-3 h-3" />
                            {displayVal}
                          </div>
                        );
                      }
                      const bcErrKeys = ['lane1', 'lane2', 'lane3', 'lane4'];
                      const bcErrKey = bcErrKeys[index] || 'lane1';
                      return (
                        <>
                          <BorderCrossingLookup
                            value={lane.border_crossing || ''}
                            onChange={(value) => handleSplitBillingLaneChange(index, 'border_crossing', value)}
                            size="sm"
                            placeholder="Select border"
                            hasError={!!validationErrors[bcErrKey as keyof typeof validationErrors]?.border_crossing}
                          />
                          {validationErrors[bcErrKey as keyof typeof validationErrors]?.border_crossing && <div className="text-xs text-red-500 mt-1">{validationErrors[bcErrKey as keyof typeof validationErrors].border_crossing}</div>}
                        </>
                      );
                    })()}
                  </td>
                  {(() => {
                    const sbCurrency = (lane.currency_code || splitBillingAddLanes[0]?.currency_code || 'USD') as CurrencyCode;
                    const sbUsEditBg = '#EFF6FF';
                    const sbMxEditBg = '#F0FDF4';
                    const disabledBg = '#F3F4F6';
                    const separatorRight = { borderRight: '2px solid #D1D5DB' };
                    const sbOneWayOverride = (selectedServiceType === 'Door to Door' && selectedTripType === 'One Way' && splitBillingAddLanes[0]?.origin_country_code) ? { origin: normalizeCountryCode(splitBillingAddLanes[0].origin_country_code) } : undefined;
                    const fv = getFieldVisibility(lane, sbOneWayOverride);
                    const usDisabled = fv.usFieldsDisabled;
                    const mxDisabled = fv.mxFieldsDisabled;
                    const bcFeeDisabled = fv.borderFeeDisabled;
                    const sbUsRateType = lane.us_rate_type || lane.rate_type || 'RPM';
                    const sbMxRateType = lane.mx_rate_type || lane.rate_type || 'RPM';
                    const sbUsIsRpm = sbUsRateType === 'RPM';
                    const sbMxIsRpm = sbMxRateType === 'RPM';
                    const sbUsReadonlyBg = '#BFDBFE';
                    const sbMxReadonlyBg = '#BBF7D0';
                    return (<>
                  <td style={{ minWidth: '100px' }} className="px-2 py-2">
                    <GridCurrencyInput value={lane.border_crossing_fee || 0} onChange={(v) => handleSplitBillingLaneChange(index, 'border_crossing_fee', v)} currencyCode={sbCurrency} disabled={bcFeeDisabled} />
                  </td>
                  <td style={{ minWidth: '120px', ...separatorRight }} className="px-2 py-2">
                    <ReadOnlyCell value={calculateLaneTotal(lane)} isCurrency currencyCode={sbCurrency} />
                  </td>

                  <td style={{ minWidth: '80px', backgroundColor: usDisabled ? disabledBg : sbUsEditBg }} className="px-2 py-2">
                    {usDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500">—</div> : <input type="number" step="0.01" value={lane.us_miles || 0} onChange={(e) => handleSplitBillingLaneChange(index, 'us_miles', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-right bg-white" />}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: usDisabled ? disabledBg : sbUsEditBg }} className="px-2 py-2">
                    <GridCurrencyInput value={lane.us_fuel_rate || 0} onChange={(v) => handleSplitBillingLaneChange(index, 'us_fuel_rate', v)} currencyCode={sbCurrency} disabled={usDisabled} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: usDisabled ? disabledBg : (sbUsIsRpm ? sbUsReadonlyBg : sbUsEditBg) }} className="px-2 py-2">
                    {usDisabled ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500">—</div>
                    ) : sbUsIsRpm ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: sbUsReadonlyBg }}>{formatCurrencyOrDash((lane.us_miles || 0) * (lane.us_rate_per_mile || 0), sbCurrency)}</div>
                    ) : (
                      <GridCurrencyInput value={lane.us_rate || 0} onChange={(v) => handleSplitBillingLaneChange(index, 'us_rate', v)} currencyCode={sbCurrency} />
                    )}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: usDisabled ? disabledBg : (!sbUsIsRpm ? sbUsReadonlyBg : sbUsEditBg) }} className="px-2 py-2">
                    {usDisabled ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500">—</div>
                    ) : !sbUsIsRpm ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: sbUsReadonlyBg }}>{formatCurrencyOrDash(lane.us_miles ? (lane.us_rate || 0) / lane.us_miles : 0, sbCurrency)}</div>
                    ) : (
                      <GridCurrencyInput value={lane.us_rate_per_mile || 0} onChange={(v) => handleSplitBillingLaneChange(index, 'us_rate_per_mile', v)} currencyCode={sbCurrency} />
                    )}
                  </td>
                  <td style={{ minWidth: '80px', backgroundColor: usDisabled ? disabledBg : sbUsEditBg }} className="px-2 py-2">
                    {usDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-gray-500">—</div> : <select value={sbUsRateType} onChange={(e) => handleSplitBillingLaneChange(index, 'us_rate_type', e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white">{RATE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}</select>}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: usDisabled ? disabledBg : sbUsEditBg }} className="px-2 py-2">
                    <ReadOnlyCell value={usDisabled ? 0 : calculateTotalUSFuel(lane)} isCurrency currencyCode={sbCurrency} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: usDisabled ? disabledBg : sbUsEditBg }} className="px-2 py-2">
                    <ReadOnlyCell value={usDisabled ? 0 : calculateUSFixedCosts(lane)} isCurrency currencyCode={sbCurrency} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: usDisabled ? disabledBg : sbUsEditBg }} className="px-2 py-2">
                    <ReadOnlyCell value={usDisabled ? 0 : calculateUSVariableCosts(lane)} isCurrency currencyCode={sbCurrency} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: usDisabled ? disabledBg : sbUsEditBg, ...separatorRight }} className="px-2 py-2">
                    <ReadOnlyCell value={usDisabled ? 0 : calculateUSPortion(lane)} isCurrency currencyCode={sbCurrency} />
                  </td>

                  <td style={{ minWidth: '80px', backgroundColor: mxDisabled ? disabledBg : sbMxEditBg }} className="px-2 py-2">
                    {mxDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500">—</div> : <input type="number" step="0.01" value={lane.mx_miles || 0} onChange={(e) => handleSplitBillingLaneChange(index, 'mx_miles', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded text-right bg-white" />}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: mxDisabled ? disabledBg : sbMxEditBg }} className="px-2 py-2">
                    <GridCurrencyInput value={lane.mx_fuel_rate || 0} onChange={(v) => handleSplitBillingLaneChange(index, 'mx_fuel_rate', v)} currencyCode={sbCurrency} disabled={mxDisabled} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: mxDisabled ? disabledBg : (sbMxIsRpm ? sbMxReadonlyBg : sbMxEditBg) }} className="px-2 py-2">
                    {mxDisabled ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500">—</div>
                    ) : sbMxIsRpm ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: sbMxReadonlyBg }}>{formatCurrencyOrDash((lane.mx_miles || 0) * (lane.mx_rate_per_mile || 0), sbCurrency)}</div>
                    ) : (
                      <GridCurrencyInput value={lane.mx_rate || 0} onChange={(v) => handleSplitBillingLaneChange(index, 'mx_rate', v)} currencyCode={sbCurrency} />
                    )}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: mxDisabled ? disabledBg : (!sbMxIsRpm ? sbMxReadonlyBg : sbMxEditBg) }} className="px-2 py-2">
                    {mxDisabled ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500">—</div>
                    ) : !sbMxIsRpm ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: sbMxReadonlyBg }}>{formatCurrencyOrDash(lane.mx_miles ? (lane.mx_rate || 0) / lane.mx_miles : 0, sbCurrency)}</div>
                    ) : (
                      <GridCurrencyInput value={lane.mx_rate_per_mile || 0} onChange={(v) => handleSplitBillingLaneChange(index, 'mx_rate_per_mile', v)} currencyCode={sbCurrency} />
                    )}
                  </td>
                  <td style={{ minWidth: '80px', backgroundColor: mxDisabled ? disabledBg : sbMxEditBg }} className="px-2 py-2">
                    {mxDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-gray-500">—</div> : <select value={sbMxRateType} onChange={(e) => handleSplitBillingLaneChange(index, 'mx_rate_type', e.target.value)} className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white">{RATE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}</select>}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: mxDisabled ? disabledBg : sbMxEditBg }} className="px-2 py-2">
                    <ReadOnlyCell value={mxDisabled ? 0 : calculateTotalMXFuel(lane)} isCurrency currencyCode={sbCurrency} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: mxDisabled ? disabledBg : sbMxEditBg }} className="px-2 py-2">
                    <ReadOnlyCell value={mxDisabled ? 0 : calculateMXFixedCosts(lane)} isCurrency currencyCode={sbCurrency} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: mxDisabled ? disabledBg : sbMxEditBg }} className="px-2 py-2">
                    <ReadOnlyCell value={mxDisabled ? 0 : calculateMXVariableCosts(lane)} isCurrency currencyCode={sbCurrency} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: mxDisabled ? disabledBg : sbMxEditBg, ...separatorRight }} className="px-2 py-2">
                    <ReadOnlyCell value={mxDisabled ? 0 : calculateMXPortion(lane)} isCurrency currencyCode={sbCurrency} />
                  </td>

                  <td style={{ minWidth: '120px' }} className="px-2 py-2">
                    <ReadOnlyCell value={calculateLaneTotal(lane)} isCurrency currencyCode={sbCurrency} />
                  </td>
                    </>);
                  })()}
                  <td style={{ minWidth: '100px' }} className="px-2 py-2">
                    <div className="flex flex-col gap-1">
                      {isFirstLane && (
                        <select
                          value={lane.currency_code || 'USD'}
                          onChange={(e) => handleSplitBillingLaneChange(index, 'currency_code', e.target.value)}
                          className="w-full px-1 py-1 text-xs border border-gray-300 rounded"
                          title="Currency"
                        >
                          <option value="USD">USD</option>
                          <option value="MXN">MXN</option>
                          <option value="CAD">CAD</option>
                        </select>
                      )}
                      {isLastLane && (
                        <div className="flex gap-1">
                          <button onClick={handleFinishAdd} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-3 h-3" /></button>
                          <button onClick={() => { setIsAdding(false); setSelectedServiceType(null); setSelectedTripType(null); setSplitBillingAddLanes([]); setIsSplitBilling(false); }} className="p-1 text-gray-600 hover:bg-gray-100 rounded"><X className="w-3 h-3" /></button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {isAdding && !isSplitBilling && (
              <>
              <tr className="bg-blue-50 border-b border-gray-200">
                <td style={{ minWidth: '48px' }} className="px-3 py-2 text-sm text-gray-500 ">
                  <div className="flex items-center gap-2">
                    <span>{lanes.length + 1}</span>
                    <LaneBadge serviceType={selectedServiceType || 'Door to Door'} tripType={selectedTripType || 'One Way'} isSplitBilling={false} />
                  </div>
                </td>
                <td style={{ minWidth: '128px' }} className="px-2 py-2">
                  <div className={validationErrors.lane1?.origin_city ? 'border-2 border-red-500 rounded' : ''}>
                    <CityLookupField
                      value={editData.origin_city || ''}
                      onChange={(value, countryCode) => {
                        setEditData((prev) => ({ ...prev, origin_city: value, origin_country_code: countryCode }));
                        if (selectedTripType === 'Round Trip') {
                          setEditData2((prev) => ({ ...prev, destination_city: value }));
                        }
                        if ((selectedServiceType === 'Loop' || selectedServiceType === 'Domestic' || selectedServiceType === 'Door to Door') && selectedTripType === 'Circuit') {
                          lookupCityMarket(value).then(m => setAddLane1Markets(prev => ({ ...prev, originMarket: m })));
                        }
                        if (selectedServiceType === 'Loop') {
                          lookupIsBorderCity(value).then(isBorder => {
                            const prev = loopOriginIsBorder;
                            setLoopOriginIsBorder(isBorder);
                            if (prev !== null && prev !== isBorder && editData.destination_city) {
                              setEditData(p => ({ ...p, destination_city: '' }));
                              setValidationErrors(p => ({ ...p, lane1: { ...p.lane1, destination_city: 'Please reselect Destination City' } }));
                            }
                          });
                        }
                        if (countryCode) {
                          const newOrigin = normalizeCountryCode(countryCode);
                          const prevOrigin = countryCodes.origin;
                          setCountryCodes((prev) => ({ ...prev, origin: newOrigin }));
                          if (selectedServiceType === 'Door to Door' && prevOrigin && newOrigin !== prevOrigin && editData.destination_city) {
                            setEditData((prev) => ({ ...prev, destination_city: '' }));
                            setCountryCodes((prev) => ({ ...prev, destination: undefined }));
                          }
                          const error = validateDoorToDoorCountries(newOrigin, countryCodes.destination);
                          if (error) {
                            setValidationErrors((prev) => ({ ...prev, lane1: { ...prev.lane1, destination_city: error } }));
                          } else {
                            setValidationErrors((prev) => ({ ...prev, lane1: { ...prev.lane1, destination_city: '' } }));
                          }
                        }
                      }}
                      placeholder={selectedServiceType === 'Loop' ? "Search MX or border cities..." : selectedServiceType === 'Domestic' ? "Search US/CAN cities..." : "Origin City"}
                      countryFilter={selectedServiceType === 'Loop' ? 'MEX' : selectedServiceType === 'Domestic' ? 'US_CAN' : undefined}
                      includeBorderCrossing={selectedServiceType === 'Loop'}
                    />
                  </div>
                  {validationErrors.lane1?.origin_city && <div className="text-xs text-red-500 mt-1">{validationErrors.lane1.origin_city}</div>}
                </td>
                {showStopsBefore && <td style={{ minWidth: '64px' }} className="px-3 py-2" />}
                {showStopsAfter && <td style={{ minWidth: '64px' }} className="px-3 py-2" />}
                <td style={{ minWidth: '128px' }} className="px-2 py-2">
                  {selectedServiceType === 'Loop' && loopOriginIsBorder === true ? (
                    <>
                      <div className={validationErrors.lane1?.destination_city ? 'border-2 border-red-500 rounded' : ''}>
                        <CityLookupField
                          value={editData.destination_city || ''}
                          onChange={(value) => {
                            setEditData((prev) => ({ ...prev, destination_city: value }));
                            if (selectedTripType === 'Round Trip') {
                              setEditData2((prev) => ({ ...prev, origin_city: value }));
                            }
                            if (selectedTripType === 'Circuit') {
                              lookupCityMarket(value).then(m => setAddLane1Markets(prev => ({ ...prev, destMarket: m })));
                            }
                          }}
                          placeholder="Search MX cities..."
                          countryFilter="MEX"
                        />
                      </div>
                      {validationErrors.lane1?.destination_city && <div className="text-xs text-red-500 mt-1">{validationErrors.lane1.destination_city}</div>}
                    </>
                  ) : selectedServiceType === 'Loop' ? (
                    <>
                      <BorderCrossingLookup
                        value={editData.destination_city || ''}
                        onChange={(value) => {
                          setEditData((prev) => ({ ...prev, destination_city: value }));
                          if (selectedTripType === 'Round Trip') {
                            setEditData2((prev) => ({ ...prev, origin_city: value }));
                          }
                          if (selectedTripType === 'Circuit') {
                            lookupCityMarket(value).then(m => setAddLane1Markets(prev => ({ ...prev, destMarket: m })));
                          }
                        }}
                        size="sm"
                        placeholder="Select border city"
                        hasError={!!validationErrors.lane1?.destination_city}
                      />
                      {validationErrors.lane1?.destination_city && <div className="text-xs text-red-500 mt-1">{validationErrors.lane1.destination_city}</div>}
                    </>
                  ) : (
                    <>
                      <div className={validationErrors.lane1?.destination_city ? 'border-2 border-red-500 rounded' : ''}>
                        <CityLookupField
                          value={editData.destination_city || ''}
                          onChange={(value, countryCode) => {
                            setEditData((prev) => ({ ...prev, destination_city: value }));
                            if (selectedTripType === 'Round Trip') {
                              setEditData2((prev) => ({ ...prev, origin_city: value }));
                            }
                            if ((selectedServiceType === 'Loop' || selectedServiceType === 'Domestic' || selectedServiceType === 'Door to Door') && selectedTripType === 'Circuit') {
                              lookupCityMarket(value).then(m => setAddLane1Markets(prev => ({ ...prev, destMarket: m })));
                            }
                            if (countryCode) {
                              setCountryCodes((prev) => ({ ...prev, destination: normalizeCountryCode(countryCode) }));
                              const error = validateDoorToDoorCountries(countryCodes.origin, normalizeCountryCode(countryCode));
                              if (error) {
                                setValidationErrors((prev) => ({ ...prev, lane1: { ...prev.lane1, destination_city: error } }));
                              } else {
                                setValidationErrors((prev) => ({ ...prev, lane1: { ...prev.lane1, destination_city: '' } }));
                              }
                            }
                          }}
                          placeholder={selectedServiceType === 'Domestic' ? "Search US/CAN cities..." : selectedServiceType === 'Door to Door' ? (countryCodes.origin === 'MX' ? 'Search US/CAN cities...' : (countryCodes.origin === 'US' || countryCodes.origin === 'CA') ? 'Search MX cities...' : 'Destination City') : "Destination City"}
                          countryFilter={selectedServiceType === 'Domestic' ? 'US_CAN' : selectedServiceType === 'Door to Door' ? (countryCodes.origin === 'MX' ? 'US_CAN' : (countryCodes.origin === 'US' || countryCodes.origin === 'CA') ? 'MEX' : undefined) : undefined}
                        />
                      </div>
                      {validationErrors.lane1?.destination_city && <div className="text-xs text-red-500 mt-1">{validationErrors.lane1.destination_city}</div>}
                    </>
                  )}
                </td>
                <td style={{ minWidth: '128px' }} className="px-2 py-2">
                  {selectedServiceType === 'Domestic' ? (
                    <div className="w-full px-2 py-1 text-xs rounded text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>N/A</div>
                  ) : (
                    <>
                      <BorderCrossingLookup
                        value={editData.border_crossing || ''}
                        onChange={(value) => {
                          setEditData((prev) => ({ ...prev, border_crossing: value }));
                          if (selectedTripType === 'Round Trip') {
                            setEditData2((prev) => ({ ...prev, border_crossing: value }));
                          }
                        }}
                        size="sm"
                        placeholder="Select border"
                        hasError={!!validationErrors.lane1?.border_crossing}
                      />
                      {validationErrors.lane1?.border_crossing && <div className="text-xs text-red-500 mt-1">{validationErrors.lane1.border_crossing}</div>}
                    </>
                  )}
                </td>
                {(() => {
                  const addCurr = (editData.currency_code || 'USD') as CurrencyCode;
                  const addUsDisabled = selectedServiceType === 'Loop';
                  const addMxDisabled = selectedServiceType === 'Domestic';
                  const addBorderDisabled = selectedServiceType === 'Domestic';
                  const addUsEditBg = addUsDisabled ? '#F3F4F6' : '#EFF6FF';
                  const addUsReadonlyBg = addUsDisabled ? '#F3F4F6' : '#BFDBFE';
                  const addMxEditBg = addMxDisabled ? '#F3F4F6' : '#F0FDF4';
                  const addMxReadonlyBg = addMxDisabled ? '#F3F4F6' : '#BBF7D0';
                  const separatorRight = { borderRight: '2px solid #D1D5DB' };
                  const addIsRpm = (editData.rate_type || 'RPM') === 'RPM';
                  return (<>
                <td style={{ minWidth: '100px' }} className="px-2 py-2">
                  {addBorderDisabled ? (
                    <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>{addCurr} $0.00</div>
                  ) : (
                    <>
                      <GridCurrencyInput value={editData.border_crossing_fee || 0} onChange={(v) => setEditData({ ...editData, border_crossing_fee: v })} currencyCode={addCurr} hasError={!!validationErrors.lane1?.border_crossing_fee} />
                      {validationErrors.lane1?.border_crossing_fee && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane1.border_crossing_fee}</div>}
                    </>
                  )}
                </td>
                <td style={{ minWidth: '120px', ...separatorRight }} className="px-2 py-2">
                  <ReadOnlyCell value={calculateLaneTotal(editData)} isCurrency currencyCode={addCurr as CurrencyCode} />
                </td>

                <td style={{ minWidth: '80px', backgroundColor: addUsEditBg }} className="px-2 py-2">
                  {addUsDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div> : (
                    <>
                      <input type="number" step="0.01" value={editData.us_miles || 0} onChange={(e) => setEditData({ ...editData, us_miles: parseFloat(e.target.value) || 0 })} className={`w-full px-2 py-1 text-xs border rounded text-right bg-white ${validationErrors.lane1?.us_miles ? 'border-2 border-red-500' : 'border-gray-300'}`} />
                      {validationErrors.lane1?.us_miles && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane1.us_miles}</div>}
                    </>
                  )}
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addUsEditBg }} className="px-2 py-2">
                  {addUsDisabled ? <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={addCurr} /> : (
                    <>
                      <GridCurrencyInput value={editData.us_fuel_rate || 0} onChange={(v) => setEditData({ ...editData, us_fuel_rate: v })} currencyCode={addCurr} hasError={!!validationErrors.lane1?.us_fuel_rate} />
                      {validationErrors.lane1?.us_fuel_rate && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane1.us_fuel_rate}</div>}
                    </>
                  )}
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addUsDisabled ? '#F3F4F6' : (addIsRpm ? addUsReadonlyBg : addUsEditBg) }} className="px-2 py-2">
                  {addUsDisabled ? (
                    <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={addCurr} />
                  ) : addIsRpm ? (
                    <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: addUsReadonlyBg }}>{formatCurrencyOrDash((editData.us_miles || 0) * (editData.us_rate_per_mile || 0), addCurr)}</div>
                  ) : (
                    <>
                      <GridCurrencyInput value={editData.us_rate || 0} onChange={(v) => setEditData({ ...editData, us_rate: v })} currencyCode={addCurr} hasError={!!validationErrors.lane1?.us_rate} />
                      {validationErrors.lane1?.us_rate && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane1.us_rate}</div>}
                    </>
                  )}
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addUsDisabled ? '#F3F4F6' : (!addIsRpm ? addUsReadonlyBg : addUsEditBg) }} className="px-2 py-2">
                  {addUsDisabled ? (
                    <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={addCurr} />
                  ) : !addIsRpm ? (
                    <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: addUsReadonlyBg }}>{formatCurrencyOrDash(editData.us_miles ? (editData.us_rate || 0) / editData.us_miles : 0, addCurr)}</div>
                  ) : (
                    <>
                      <GridCurrencyInput value={editData.us_rate_per_mile || 0} onChange={(v) => setEditData({ ...editData, us_rate_per_mile: v })} currencyCode={addCurr} hasError={!!validationErrors.lane1?.us_rate_per_mile} />
                      {validationErrors.lane1?.us_rate_per_mile && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane1.us_rate_per_mile}</div>}
                    </>
                  )}
                </td>
                <td style={{ minWidth: '80px', backgroundColor: addUsEditBg }} className="px-2 py-2">
                  {addUsDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div> : (
                    <select value={editData.rate_type || 'RPM'} onChange={(e) => setEditData({ ...editData, rate_type: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white">
                      {RATE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                    </select>
                  )}
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addUsReadonlyBg }} className="px-2 py-2">
                  <ReadOnlyCell value={addUsDisabled ? 0 : calculateTotalUSFuel(editData)} isCurrency currencyCode={addCurr as CurrencyCode} />
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addUsReadonlyBg }} className="px-2 py-2">
                  <ReadOnlyCell value={addUsDisabled ? 0 : calculateUSFixedCosts(editData)} isCurrency currencyCode={addCurr as CurrencyCode} />
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addUsReadonlyBg }} className="px-2 py-2">
                  <ReadOnlyCell value={addUsDisabled ? 0 : calculateUSVariableCosts(editData)} isCurrency currencyCode={addCurr as CurrencyCode} />
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addUsReadonlyBg, ...separatorRight }} className="px-2 py-2">
                  <ReadOnlyCell value={calculateUSPortion(editData)} isCurrency currencyCode={addCurr as CurrencyCode} />
                </td>

                <td style={{ minWidth: '80px', backgroundColor: addMxEditBg }} className="px-2 py-2">
                  {addMxDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div> : (
                    <>
                      <input type="number" step="0.01" value={editData.mx_miles || 0} onChange={(e) => setEditData({ ...editData, mx_miles: parseFloat(e.target.value) || 0 })} className={`w-full px-2 py-1 text-xs border rounded text-right bg-white ${validationErrors.lane1?.mx_miles ? 'border-2 border-red-500' : 'border-gray-300'}`} />
                      {validationErrors.lane1?.mx_miles && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane1.mx_miles}</div>}
                    </>
                  )}
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addMxEditBg }} className="px-2 py-2">
                  {addMxDisabled ? <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={addCurr} /> : (
                    <>
                      <GridCurrencyInput value={editData.mx_fuel_rate || 0} onChange={(v) => setEditData({ ...editData, mx_fuel_rate: v })} currencyCode={addCurr} hasError={!!validationErrors.lane1?.mx_fuel_rate} />
                      {validationErrors.lane1?.mx_fuel_rate && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane1.mx_fuel_rate}</div>}
                    </>
                  )}
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addMxDisabled ? '#F3F4F6' : (addIsRpm ? addMxReadonlyBg : addMxEditBg) }} className="px-2 py-2">
                  {addMxDisabled ? (
                    <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={addCurr} />
                  ) : addIsRpm ? (
                    <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: addMxReadonlyBg }}>{formatCurrencyOrDash((editData.mx_miles || 0) * (editData.mx_rate_per_mile || 0), addCurr)}</div>
                  ) : (
                    <>
                      <GridCurrencyInput value={editData.mx_rate || 0} onChange={(v) => setEditData({ ...editData, mx_rate: v })} currencyCode={addCurr} hasError={!!validationErrors.lane1?.mx_rate} />
                      {validationErrors.lane1?.mx_rate && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane1.mx_rate}</div>}
                    </>
                  )}
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addMxDisabled ? '#F3F4F6' : (!addIsRpm ? addMxReadonlyBg : addMxEditBg) }} className="px-2 py-2">
                  {addMxDisabled ? (
                    <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={addCurr} />
                  ) : !addIsRpm ? (
                    <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: addMxReadonlyBg }}>{formatCurrencyOrDash(editData.mx_miles ? (editData.mx_rate || 0) / editData.mx_miles : 0, addCurr)}</div>
                  ) : (
                    <>
                      <GridCurrencyInput value={editData.mx_rate_per_mile || 0} onChange={(v) => setEditData({ ...editData, mx_rate_per_mile: v })} currencyCode={addCurr} hasError={!!validationErrors.lane1?.mx_rate_per_mile} />
                      {validationErrors.lane1?.mx_rate_per_mile && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane1.mx_rate_per_mile}</div>}
                    </>
                  )}
                </td>
                <td style={{ minWidth: '80px', backgroundColor: addMxEditBg }} className="px-2 py-2">
                  {addMxDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div> : (
                    <select value={editData.rate_type || 'RPM'} onChange={(e) => setEditData({ ...editData, rate_type: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white">
                      {RATE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                    </select>
                  )}
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addMxEditBg }} className="px-2 py-2">
                  <ReadOnlyCell value={addMxDisabled ? 0 : calculateTotalMXFuel(editData)} isCurrency currencyCode={addCurr as CurrencyCode} />
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addMxEditBg }} className="px-2 py-2">
                  <ReadOnlyCell value={addMxDisabled ? 0 : calculateMXFixedCosts(editData)} isCurrency currencyCode={addCurr as CurrencyCode} />
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addMxEditBg }} className="px-2 py-2">
                  <ReadOnlyCell value={addMxDisabled ? 0 : calculateMXVariableCosts(editData)} isCurrency currencyCode={addCurr as CurrencyCode} />
                </td>
                <td style={{ minWidth: '100px', backgroundColor: addMxEditBg, ...separatorRight }} className="px-2 py-2">
                  <ReadOnlyCell value={calculateMXPortion(editData)} isCurrency currencyCode={addCurr as CurrencyCode} />
                </td>

                <td style={{ minWidth: '120px' }} className="px-2 py-2">
                  <ReadOnlyCell value={calculateLaneTotal(editData)} isCurrency currencyCode={addCurr as CurrencyCode} />
                </td>
                <td style={{ minWidth: '100px' }} className="px-2 py-2">
                  <div className="flex flex-col gap-1">
                    <select
                      value={editData.currency_code || 'USD'}
                      onChange={(e) => setEditData({ ...editData, currency_code: e.target.value })}
                      className="w-full px-1 py-1 text-xs border border-gray-300 rounded"
                      title="Currency"
                    >
                      <option value="USD">USD</option>
                      <option value="MXN">MXN</option>
                      <option value="CAD">CAD</option>
                    </select>
                    <div className="flex gap-1">
                      <button onClick={handleFinishAdd} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setIsAdding(false);
                          setSelectedServiceType(null);
                          setSelectedTripType(null);
                          setEditData({});
                          setEditData2({});
                        }}
                        className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </td>
                  </>);
                })()}
              </tr>
              {selectedTripType !== 'One Way' && (
                <tr className="bg-blue-50 border-b border-gray-200 border-l-4 border-l-orange-400">
                  <td style={{ minWidth: '48px' }} className="px-3 py-2 text-sm text-gray-500">
                    <div className="flex items-center gap-2">
                      <span>{lanes.length + 2}</span>
                      <LaneBadge serviceType={selectedServiceType || 'Door to Door'} tripType={selectedTripType || 'One Way'} isSplitBilling={false} />
                    </div>
                  </td>
                  <td style={{ minWidth: '128px' }} className="px-2 py-2">
                    {selectedServiceType === 'Domestic' && selectedTripType === 'Circuit' ? (
                      <>
                        <MarketFilteredCityLookup
                          value={editData2.origin_city || ''}
                          onChange={(value) => setEditData2(prev => ({ ...prev, origin_city: value }))}
                          marketFilter={addLane1Markets.destMarket}
                          placeholder={addLane1Markets.destMarket ? 'Select city...' : '—'}
                          hasError={!!validationErrors.lane2?.origin_city}
                          disabled={!addLane1Markets.destMarket}
                          disabledMessage="Please select Destination City on the first Lane"
                          countryFilter="USA"
                        />
                        {validationErrors.lane2?.origin_city && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.origin_city}</div>}
                      </>
                    ) : (selectedServiceType === 'Loop' || selectedServiceType === 'Door to Door') && selectedTripType === 'Circuit' ? (
                      <>
                        <MarketFilteredCityLookup
                          value={editData2.origin_city || ''}
                          onChange={(value) => setEditData2(prev => ({ ...prev, origin_city: value }))}
                          marketFilter={addLane1Markets.destMarket}
                          placeholder={addLane1Markets.destMarket ? 'Select city...' : '—'}
                          hasError={!!validationErrors.lane2?.origin_city}
                          disabled={!addLane1Markets.destMarket}
                          disabledMessage="Please select Destination City on the first Lane"
                        />
                        {validationErrors.lane2?.origin_city && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.origin_city}</div>}
                      </>
                    ) : (
                      <div className="text-xs bg-gray-200 px-2 py-1 rounded italic text-gray-600 flex items-center gap-1">
                        <LockIcon className="w-3 h-3" />
                        {editData2.origin_city || editData.destination_city || 'Auto'}
                      </div>
                    )}
                  </td>
                  {showStopsBefore && <td style={{ minWidth: '64px' }} className="px-3 py-2" />}
                  {showStopsAfter && <td style={{ minWidth: '64px' }} className="px-3 py-2" />}
                  <td style={{ minWidth: '128px' }} className="px-2 py-2">
                    {selectedServiceType === 'Domestic' && selectedTripType === 'Circuit' ? (
                      <>
                        <MarketFilteredCityLookup
                          value={editData2.destination_city || ''}
                          onChange={(value) => setEditData2(prev => ({ ...prev, destination_city: value }))}
                          marketFilter={addLane1Markets.originMarket}
                          placeholder={addLane1Markets.originMarket ? 'Select city...' : '—'}
                          hasError={!!validationErrors.lane2?.destination_city}
                          disabled={!addLane1Markets.originMarket}
                          disabledMessage="Please select Origin City on the first Lane"
                          countryFilter="USA"
                        />
                        {validationErrors.lane2?.destination_city && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.destination_city}</div>}
                      </>
                    ) : (selectedServiceType === 'Loop' || selectedServiceType === 'Door to Door') && selectedTripType === 'Circuit' ? (
                      <>
                        <MarketFilteredCityLookup
                          value={editData2.destination_city || ''}
                          onChange={(value) => setEditData2(prev => ({ ...prev, destination_city: value }))}
                          marketFilter={addLane1Markets.originMarket}
                          placeholder={addLane1Markets.originMarket ? 'Select city...' : '—'}
                          hasError={!!validationErrors.lane2?.destination_city}
                          disabled={!addLane1Markets.originMarket}
                          disabledMessage="Please select Origin City on the first Lane"
                        />
                        {validationErrors.lane2?.destination_city && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.destination_city}</div>}
                      </>
                    ) : (
                      <div className="text-xs bg-gray-200 px-2 py-1 rounded italic text-gray-600 flex items-center gap-1">
                        <LockIcon className="w-3 h-3" />
                        {editData2.destination_city || editData.origin_city || 'Auto'}
                      </div>
                    )}
                  </td>
                  <td style={{ minWidth: '128px' }} className="px-2 py-2">
                    {selectedServiceType === 'Domestic' ? (
                      <div className="text-xs px-2 py-1 rounded italic text-gray-600 flex items-center gap-1" style={{ backgroundColor: '#F3F4F6' }}>
                        <LockIcon className="w-3 h-3" />
                        N/A
                      </div>
                    ) : (selectedServiceType === 'Loop' || selectedServiceType === 'Door to Door') && selectedTripType === 'Circuit' ? (
                      <>
                        <BorderCrossingLookup
                          value={editData2.border_crossing || ''}
                          onChange={(value) => setEditData2(prev => ({ ...prev, border_crossing: value }))}
                          size="sm"
                          placeholder="Select border"
                          hasError={!!validationErrors.lane2?.border_crossing}
                        />
                        {validationErrors.lane2?.border_crossing && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.border_crossing}</div>}
                      </>
                    ) : (
                      <div className="text-xs bg-gray-200 px-2 py-1 rounded italic text-gray-600 flex items-center gap-1">
                        <LockIcon className="w-3 h-3" />
                        {editData2.border_crossing || editData.border_crossing || 'Auto'}
                      </div>
                    )}
                  </td>
                  {(() => {
                    const lane2UsDisabled = selectedServiceType === 'Loop';
                    const lane2MxDisabled = selectedServiceType === 'Domestic';
                    const lane2CurrCode = (editData.currency_code || 'USD') as CurrencyCode;
                    const l2UsEditBg = lane2UsDisabled ? '#F3F4F6' : '#EFF6FF';
                    const l2UsReadonlyBg = lane2UsDisabled ? '#F3F4F6' : '#BFDBFE';
                    const l2MxEditBg = lane2MxDisabled ? '#F3F4F6' : '#F0FDF4';
                    const l2MxReadonlyBg = lane2MxDisabled ? '#F3F4F6' : '#BBF7D0';
                    const separatorRight = { borderRight: '2px solid #D1D5DB' };
                    const l2IsRpm = (editData2.rate_type || 'RPM') === 'RPM';
                    return (<>
                  <td style={{ minWidth: '100px' }} className="px-2 py-2">
                    {lane2MxDisabled ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>{lane2CurrCode} $0.00</div>
                    ) : (
                      <>
                        <GridCurrencyInput value={editData2.border_crossing_fee || 0} onChange={(v) => setEditData2({ ...editData2, border_crossing_fee: v })} currencyCode={lane2CurrCode} hasError={!!validationErrors.lane2?.border_crossing_fee} />
                        {validationErrors.lane2?.border_crossing_fee && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.border_crossing_fee}</div>}
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: '120px', ...separatorRight }} className="px-2 py-2">
                    <ReadOnlyCell value={calculateLaneTotal(editData2)} isCurrency currencyCode={lane2CurrCode as CurrencyCode} />
                  </td>

                  <td style={{ minWidth: '80px', backgroundColor: l2UsEditBg }} className="px-2 py-2">
                    {lane2UsDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div> : (
                      <>
                        <input type="number" step="0.01" value={editData2.us_miles || 0} onChange={(e) => setEditData2({ ...editData2, us_miles: parseFloat(e.target.value) || 0 })} className={`w-full px-2 py-1 text-xs border rounded text-right bg-white ${validationErrors.lane2?.us_miles ? 'border-2 border-red-500' : 'border-gray-300'}`} />
                        {validationErrors.lane2?.us_miles && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.us_miles}</div>}
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: l2UsEditBg }} className="px-2 py-2">
                    {lane2UsDisabled ? <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={lane2CurrCode} /> : (
                      <>
                        <GridCurrencyInput value={editData2.us_fuel_rate || 0} onChange={(v) => setEditData2({ ...editData2, us_fuel_rate: v })} currencyCode={lane2CurrCode} hasError={!!validationErrors.lane2?.us_fuel_rate} />
                        {validationErrors.lane2?.us_fuel_rate && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.us_fuel_rate}</div>}
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: lane2UsDisabled ? '#F3F4F6' : (l2IsRpm ? l2UsReadonlyBg : l2UsEditBg) }} className="px-2 py-2">
                    {lane2UsDisabled ? (
                      <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={lane2CurrCode} />
                    ) : l2IsRpm ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: l2UsReadonlyBg }}>{formatCurrencyOrDash((editData2.us_miles || 0) * (editData2.us_rate_per_mile || 0), lane2CurrCode)}</div>
                    ) : (
                      <>
                        <GridCurrencyInput value={editData2.us_rate || 0} onChange={(v) => setEditData2({ ...editData2, us_rate: v })} currencyCode={lane2CurrCode} hasError={!!validationErrors.lane2?.us_rate} />
                        {validationErrors.lane2?.us_rate && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.us_rate}</div>}
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: lane2UsDisabled ? '#F3F4F6' : (!l2IsRpm ? l2UsReadonlyBg : l2UsEditBg) }} className="px-2 py-2">
                    {lane2UsDisabled ? (
                      <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={lane2CurrCode} />
                    ) : !l2IsRpm ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: l2UsReadonlyBg }}>{formatCurrencyOrDash(editData2.us_miles ? (editData2.us_rate || 0) / editData2.us_miles : 0, lane2CurrCode)}</div>
                    ) : (
                      <>
                        <GridCurrencyInput value={editData2.us_rate_per_mile || 0} onChange={(v) => setEditData2({ ...editData2, us_rate_per_mile: v })} currencyCode={lane2CurrCode} hasError={!!validationErrors.lane2?.us_rate_per_mile} />
                        {validationErrors.lane2?.us_rate_per_mile && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.us_rate_per_mile}</div>}
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: '80px', backgroundColor: l2UsEditBg }} className="px-2 py-2">
                    {lane2UsDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div> : (
                      <select value={editData2.rate_type || 'RPM'} onChange={(e) => setEditData2({ ...editData2, rate_type: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white">
                        {RATE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                      </select>
                    )}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: l2UsReadonlyBg }} className="px-2 py-2">
                    <ReadOnlyCell value={lane2UsDisabled ? 0 : calculateTotalUSFuel(editData2)} isCurrency currencyCode={lane2CurrCode as CurrencyCode} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: l2UsReadonlyBg }} className="px-2 py-2">
                    <ReadOnlyCell value={lane2UsDisabled ? 0 : calculateUSFixedCosts(editData2)} isCurrency currencyCode={lane2CurrCode as CurrencyCode} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: l2UsReadonlyBg }} className="px-2 py-2">
                    <ReadOnlyCell value={lane2UsDisabled ? 0 : calculateUSVariableCosts(editData2)} isCurrency currencyCode={lane2CurrCode as CurrencyCode} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: l2UsReadonlyBg, ...separatorRight }} className="px-2 py-2">
                    <ReadOnlyCell value={calculateUSPortion(editData2)} isCurrency currencyCode={lane2CurrCode as CurrencyCode} />
                  </td>

                  <td style={{ minWidth: '80px', backgroundColor: l2MxEditBg }} className="px-2 py-2">
                    {lane2MxDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div> : (
                      <>
                        <input type="number" step="0.01" value={editData2.mx_miles || 0} onChange={(e) => setEditData2({ ...editData2, mx_miles: parseFloat(e.target.value) || 0 })} className={`w-full px-2 py-1 text-xs border rounded text-right bg-white ${validationErrors.lane2?.mx_miles ? 'border-2 border-red-500' : 'border-gray-300'}`} />
                        {validationErrors.lane2?.mx_miles && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.mx_miles}</div>}
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: l2MxEditBg }} className="px-2 py-2">
                    {lane2MxDisabled ? <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={lane2CurrCode} /> : (
                      <>
                        <GridCurrencyInput value={editData2.mx_fuel_rate || 0} onChange={(v) => setEditData2({ ...editData2, mx_fuel_rate: v })} currencyCode={lane2CurrCode} hasError={!!validationErrors.lane2?.mx_fuel_rate} />
                        {validationErrors.lane2?.mx_fuel_rate && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.mx_fuel_rate}</div>}
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: lane2MxDisabled ? '#F3F4F6' : (l2IsRpm ? l2MxReadonlyBg : l2MxEditBg) }} className="px-2 py-2">
                    {lane2MxDisabled ? (
                      <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={lane2CurrCode} />
                    ) : l2IsRpm ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: l2MxReadonlyBg }}>{formatCurrencyOrDash((editData2.mx_miles || 0) * (editData2.mx_rate_per_mile || 0), lane2CurrCode)}</div>
                    ) : (
                      <>
                        <GridCurrencyInput value={editData2.mx_rate || 0} onChange={(v) => setEditData2({ ...editData2, mx_rate: v })} currencyCode={lane2CurrCode} hasError={!!validationErrors.lane2?.mx_rate} />
                        {validationErrors.lane2?.mx_rate && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.mx_rate}</div>}
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: lane2MxDisabled ? '#F3F4F6' : (!l2IsRpm ? l2MxReadonlyBg : l2MxEditBg) }} className="px-2 py-2">
                    {lane2MxDisabled ? (
                      <GridCurrencyInput value={0} onChange={() => {}} disabled currencyCode={lane2CurrCode} />
                    ) : !l2IsRpm ? (
                      <div className="w-full px-2 py-1 text-xs rounded text-right text-gray-500" style={{ backgroundColor: l2MxReadonlyBg }}>{formatCurrencyOrDash(editData2.mx_miles ? (editData2.mx_rate || 0) / editData2.mx_miles : 0, lane2CurrCode)}</div>
                    ) : (
                      <>
                        <GridCurrencyInput value={editData2.mx_rate_per_mile || 0} onChange={(v) => setEditData2({ ...editData2, mx_rate_per_mile: v })} currencyCode={lane2CurrCode} hasError={!!validationErrors.lane2?.mx_rate_per_mile} />
                        {validationErrors.lane2?.mx_rate_per_mile && <div className="text-[10px] text-red-500 mt-0.5">{validationErrors.lane2.mx_rate_per_mile}</div>}
                      </>
                    )}
                  </td>
                  <td style={{ minWidth: '80px', backgroundColor: l2MxEditBg }} className="px-2 py-2">
                    {lane2MxDisabled ? <div className="w-full px-2 py-1 text-xs rounded text-gray-500" style={{ backgroundColor: '#F3F4F6' }}>—</div> : (
                      <select value={editData2.rate_type || 'RPM'} onChange={(e) => setEditData2({ ...editData2, rate_type: e.target.value })} className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white">
                        {RATE_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                      </select>
                    )}
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: l2MxReadonlyBg }} className="px-2 py-2">
                    <ReadOnlyCell value={lane2MxDisabled ? 0 : calculateTotalMXFuel(editData2)} isCurrency currencyCode={lane2CurrCode as CurrencyCode} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: l2MxReadonlyBg }} className="px-2 py-2">
                    <ReadOnlyCell value={lane2MxDisabled ? 0 : calculateMXFixedCosts(editData2)} isCurrency currencyCode={lane2CurrCode as CurrencyCode} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: l2MxReadonlyBg }} className="px-2 py-2">
                    <ReadOnlyCell value={lane2MxDisabled ? 0 : calculateMXVariableCosts(editData2)} isCurrency currencyCode={lane2CurrCode as CurrencyCode} />
                  </td>
                  <td style={{ minWidth: '100px', backgroundColor: l2MxReadonlyBg, ...separatorRight }} className="px-2 py-2">
                    <ReadOnlyCell value={calculateMXPortion(editData2)} isCurrency currencyCode={lane2CurrCode as CurrencyCode} />
                  </td>

                  <td style={{ minWidth: '120px' }} className="px-2 py-2">
                    <ReadOnlyCell value={calculateLaneTotal(editData2)} isCurrency currencyCode={lane2CurrCode as CurrencyCode} />
                  </td>
                  <td style={{ minWidth: '100px' }} className="px-3 py-2" />
                    </>);
                  })()}
                </tr>
              )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {showDeleteConfirm && (() => {
        const deleteLane = lanes.find(l => l.id === showDeleteConfirm.laneId);
        const isSBGroup = !!showDeleteConfirm.splitBillingGroup;
        const sbCount = showDeleteConfirm.splitBillingCount || 0;
        const isD2DRTSB = isSBGroup && deleteLane?.service_type === 'Door to Door' && deleteLane?.trip_type === 'Round Trip';
        const isD2DOWSB = isSBGroup && deleteLane?.service_type === 'Door to Door' && deleteLane?.trip_type === 'One Way';
        const isLinkedPair = !!showDeleteConfirm.linkedLaneId;
        const isLoopPair = isLinkedPair && deleteLane?.service_type === 'Loop' && (deleteLane?.trip_type === 'Round Trip' || deleteLane?.trip_type === 'Circuit');
        const isDomesticRTPair = isLinkedPair && deleteLane?.service_type === 'Domestic' && deleteLane?.trip_type === 'Round Trip';
        const isDomesticCircuitPair = isLinkedPair && deleteLane?.service_type === 'Domestic' && deleteLane?.trip_type === 'Circuit';
        const isDoorToDoorRTPair = isLinkedPair && !isSBGroup && deleteLane?.service_type === 'Door to Door' && deleteLane?.trip_type === 'Round Trip';
        const isPairedDelete = isSBGroup || isLoopPair || isDomesticRTPair || isDomesticCircuitPair || isDoorToDoorRTPair;
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {isSBGroup ? `Delete All ${sbCount} Lanes?` : isPairedDelete ? 'Delete Both Lanes?' : 'Delete Lane?'}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {isD2DRTSB
                ? `This lane is part of a Door to Door Round Trip Split Billing group (${sbCount} lanes). Deleting one lane will delete all ${sbCount} lanes. Do you want to continue?`
                : isD2DOWSB
                ? 'This lane is part of a Door to Door Split Billing pair. Deleting one lane will delete both lanes. Do you want to continue?'
                : isDoorToDoorRTPair
                ? 'This lane is part of a Door to Door Round Trip pair. Deleting one lane will delete both lanes. Do you want to continue?'
                : isDomesticCircuitPair
                ? 'This lane is part of a Domestic Circuit pair. Deleting one lane will delete both lanes. Do you want to continue?'
                : isDomesticRTPair
                ? 'This lane is part of a Domestic Round Trip pair. Deleting one lane will delete both lanes. Do you want to continue?'
                : isLoopPair
                  ? `This lane is part of a Loop ${deleteLane?.trip_type} pair. Deleting one lane will delete both lanes. Do you want to continue?`
                  : isLinkedPair
                    ? 'This will delete both the lane and its paired lane.'
                    : 'This will delete the lane.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleConfirmDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700">
                {isSBGroup ? `Delete All ${sbCount} Lanes` : isPairedDelete ? 'Delete Both Lanes' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {showServiceTypeModal && (
        <ServiceTypeModal onSelect={handleServiceTypeSelect} onClose={() => setShowServiceTypeModal(false)} />
      )}
      {showTripTypeModal && (
        <TripTypeModal
          onSelect={handleTripTypeSelect}
          onClose={() => {
            setShowTripTypeModal(false);
            setShowServiceTypeModal(false);
          }}
          onBack={() => {
            setShowTripTypeModal(false);
            setShowServiceTypeModal(true);
          }}
          serviceType={selectedServiceType}
        />
      )}
    </div>
  );
}
