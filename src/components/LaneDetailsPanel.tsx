import { X, AlertCircle, Plus, Lock, BarChart2, ChevronDown } from 'lucide-react';
import { supabase, Quote, QuoteLane } from '../lib/supabase';
import { useState, useEffect, useRef } from 'react';
import { CityLookupField } from './CityLookupField';
import { SelectedAccessorial } from './AccessorialSelector';
import { LaneSectionAccessorials, SectionAccessorial, calcSectionAccessorialsTotal } from './LaneSectionAccessorials';
import { LANE_TYPES, LOAD_FREQUENCIES, COMMITMENT_TYPES, PRIORITIES, EQUIPMENT_TYPES, LIVE_LOAD_OPTIONS, formatCurrencyOrDash, CurrencyCode, CURRENCIES, normalizeCountryCode } from '../lib/constants';
import { BorderCrossingLookup, useBorderCrossingCities, validateBorderCrossing } from './BorderCrossingLookup';
import { MarketFilteredCityLookup } from './MarketFilteredCityLookup';

const UNITS_OPTIONS = ['Mi', 'Km'] as const;
type UnitsCode = typeof UNITS_OPTIONS[number];


function CurrencyInput({ value, onChange, className, hasError, currencyCode = 'USD' }: { value: number; onChange: (value: number) => void; className?: string; hasError?: boolean; currencyCode?: CurrencyCode }) {
  const [displayValue, setDisplayValue] = useState(value > 0 ? value.toFixed(2) : '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDisplayValue(value > 0 ? value.toFixed(2) : '');
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '');
    setDisplayValue(raw);
    const parsed = parseFloat(raw);
    onChange(isNaN(parsed) ? 0 : parsed);
  };

  const handleBlur = () => {
    const parsed = parseFloat(displayValue);
    if (!isNaN(parsed)) {
      setDisplayValue(parsed.toFixed(2));
    } else {
      setDisplayValue('');
    }
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{currencyCode} $</span>
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`w-full pl-16 pr-3 py-2 border rounded text-sm ${hasError ? 'border-2 border-red-500' : 'border-gray-300'} ${className || ''}`}
      />
    </div>
  );
}

interface LaneDetailsPanelProps {
  lane: QuoteLane;
  pairedLane?: QuoteLane | null;
  currency?: string;
  quote?: Quote;
  locked?: boolean;
  onClose: () => void;
  onSave: (updatedLane: Partial<QuoteLane>, pairedLaneUpdates?: Partial<QuoteLane>) => Promise<void> | void;
  onChangeCurrency?: (newCurrency: string) => Promise<void>;
  onNextLane?: () => void;
  hasNextLane?: boolean;
  onPreviousLane?: () => void;
  hasPreviousLane?: boolean;
  onUpdatePairedLaneBCO?: (pairedLaneId: string, borderCrossingOnly: boolean) => Promise<void>;
  onBenchmark?: (lane: QuoteLane) => void;
}

export function LaneDetailsPanel({ lane, pairedLane, currency = 'USD', quote, locked = false, onClose, onSave, onChangeCurrency, onNextLane, hasNextLane, onPreviousLane, hasPreviousLane, onUpdatePairedLaneBCO, onBenchmark }: LaneDetailsPanelProps) {
  const [formData, setFormData] = useState({
    origin_city: lane.origin_city || '',
    destination_city: lane.destination_city || '',
    border_crossing: lane.border_crossing || '',
    border_crossing_rate: lane.border_crossing_rate || 0,
    border_crossing_fee: lane.border_crossing_fee || 0,
    rate_type: lane.rate_type || 'RPM',
    us_rate_type: lane.us_rate_type || lane.rate_type || 'RPM',
    mx_rate_type: lane.mx_rate_type || lane.rate_type || 'RPM',
    lane_type: lane.lane_type || '',
    load_volume: lane.load_volume || '',
    load_frequency: lane.load_frequency || '',
    commitment_type: lane.commitment_type || '',
    target: lane.target || '',
    product: lane.product || '',
    type_of_service: lane.type_of_service || lane.equipment_type || '',
    priority: lane.priority || '',
    us_miles: lane.us_miles || 0,
    us_rate_per_mile: lane.us_rate_per_mile || 0,
    us_rate: lane.us_rate || 0,
    us_fuel_rate: lane.us_fuel_rate || 0,
    mx_miles: lane.mx_miles || 0,
    mx_rate_per_mile: lane.mx_rate_per_mile || 0,
    mx_rate: lane.mx_rate || 0,
    mx_fuel_rate: lane.mx_fuel_rate || 0,
    additional_accessories: lane.additional_accessories || '',
    comments: lane.comments || '',
    un_number: lane.un_number || '',
    msds: lane.msds || '',
    weight: lane.weight || '',
    dimensions: lane.dimensions || '',
    invoice_value: lane.invoice_value || 0,
    tarps: lane.tarps || '',
    temperature: lane.temperature || '',
    packaging: lane.packaging || '',
    vin_dimensions: lane.vin_dimensions || '',
    number_of_vins: lane.number_of_vins || 0,
    live_load_or_drop: lane.live_load_or_drop || '',
    currency_code: lane.currency_code || currency || 'USD',
    units_code: lane.units_code || 'Mi',
    border_crossing_only: lane.border_crossing_only || false,
    us_fuel_included_in_line_haul: lane.us_fuel_included_in_line_haul || false,
    mx_fuel_included_in_line_haul: lane.mx_fuel_included_in_line_haul || false,
    estimated_total_us_section: lane.estimated_total_us_section || 0,
    estimated_total_mx_section: lane.estimated_total_mx_section || 0,
  });

  const currencyCode = (formData.currency_code || 'USD') as CurrencyCode;

  const [originCountryCode, setOriginCountryCodeRaw] = useState<string | undefined>(normalizeCountryCode(lane.origin_country_code));
  const setOriginCountryCode = (code: string | undefined | null) => setOriginCountryCodeRaw(normalizeCountryCode(code));
  const [currencyWarning, setCurrencyWarning] = useState('');
  const [pendingGlobalRateType, setPendingGlobalRateType] = useState<string | null>(null);

  const [selectedAccessorials, setSelectedAccessorials] = useState<SelectedAccessorial[]>(
    lane.accessorials_list ? (Array.isArray(lane.accessorials_list) ? lane.accessorials_list : []) : []
  );

  const [usAccessorials, setUsAccessorials] = useState<SectionAccessorial[]>(
    lane.us_accessorials_list ? (Array.isArray(lane.us_accessorials_list) ? lane.us_accessorials_list : []) : []
  );
  const [mxAccessorials, setMxAccessorials] = useState<SectionAccessorial[]>(
    lane.mx_accessorials_list ? (Array.isArray(lane.mx_accessorials_list) ? lane.mx_accessorials_list : []) : []
  );

  const [stopsBefore, setStopsBefore] = useState<string[]>(
    Array.isArray(lane.stops_before) ? lane.stops_before : []
  );
  const [stopsAfter, setStopsAfter] = useState<string[]>(
    Array.isArray(lane.stops_after) ? lane.stops_after : []
  );
  const { cities: borderCrossingCities } = useBorderCrossingCities();
  const [isDirty, setIsDirty] = useState(false);
  const [unsavedDialog, setUnsavedDialog] = useState<{ action: 'next' | 'previous' | 'close' } | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    actions: true,
    us: false,
    mx: false,
    additional: true,
  });

  const [accountFuelData, setAccountFuelData] = useState<{ customer_fuel_program: boolean; fuel_program_type: string; fuel_rate_per_mile: number; fuel_program_method: string }>({ customer_fuel_program: false, fuel_program_type: 'FRPM', fuel_rate_per_mile: 0, fuel_program_method: 'per_mile' });

  useEffect(() => {
    const partnerAccount = quote?.partner_account;
    if (!partnerAccount) return;
    (async () => {
      const { data } = await supabase
        .from('accounts')
        .select('customer_fuel_program, fuel_program_type, fuel_rate_per_mile, fuel_program_method')
        .eq('account_name', partnerAccount)
        .maybeSingle();
      if (data) {
        setAccountFuelData({
          customer_fuel_program: data.customer_fuel_program || false,
          fuel_program_type: data.fuel_program_type || 'FRPM',
          fuel_rate_per_mile: data.fuel_rate_per_mile || 0,
          fuel_program_method: data.fuel_program_method || 'per_mile',
        });
      }
    })();
  }, [quote?.partner_account]);

  const isLoop = lane.service_type === 'Loop';
  const isDomestic = lane.service_type === 'Domestic';
  const isDoorToDoor = lane.service_type === 'Door to Door';
  const isRoundTrip = lane.trip_type === 'Round Trip';
  const isCircuit = lane.trip_type === 'Circuit';
  const hasPairedLane = (isLoop || isDomestic || isDoorToDoor) && (isRoundTrip || isCircuit) && !!pairedLane;
  const isSecondaryRoundTripLane = isLoop && isRoundTrip && hasPairedLane && lane.is_primary_lane === false;
  const isSecondaryCircuitLane = isLoop && isCircuit && hasPairedLane && lane.is_primary_lane === false;
  const isDomesticRTPrimary = isDomestic && isRoundTrip && hasPairedLane && lane.is_primary_lane !== false;
  const isDomesticRTSecondary = isDomestic && isRoundTrip && hasPairedLane && lane.is_primary_lane === false;
  const isDomesticCircuitPrimary = isDomestic && isCircuit && hasPairedLane && lane.is_primary_lane !== false;
  const isDomesticCircuitSecondary = isDomestic && isCircuit && hasPairedLane && lane.is_primary_lane === false;
  const isDoorToDoorRTPrimary = isDoorToDoor && isRoundTrip && hasPairedLane && lane.is_primary_lane !== false;
  const isDoorToDoorRTSecondary = isDoorToDoor && isRoundTrip && hasPairedLane && lane.is_primary_lane === false;
  const isD2DSplitBilling = isDoorToDoor && !!lane.split_billing_group;
  const isD2DSBLane1 = isD2DSplitBilling && lane.split_billing_index === 1;
  const isD2DSBLane2 = isD2DSplitBilling && lane.split_billing_index === 2;
  const isD2DSBLane3 = isD2DSplitBilling && lane.split_billing_index === 3;
  const isD2DSBLane4 = isD2DSplitBilling && lane.split_billing_index === 4;
  const isD2DSBLane3or4 = isD2DSBLane3 || isD2DSBLane4;
  const isD2DSBRT = isD2DSplitBilling && isRoundTrip;
  const isD2DSBCircuit = isD2DSplitBilling && isCircuit;
  const isD2DSBOneWay = isD2DSplitBilling && lane.trip_type === 'One Way';
  const [destinationCountryCode, setDestinationCountryCode] = useState<string | undefined>(undefined);

  const [lane1OriginMarket, setLane1OriginMarket] = useState('');
  const [lane1DestMarket, setLane1DestMarket] = useState('');
  const [loopOriginIsBorderModal, setLoopOriginIsBorderModal] = useState<boolean | null>(null);
  const [sbOneWayLane1OriginCC, setSbOneWayLane1OriginCC] = useState<string | undefined>(undefined);
  const [sbRTLane1OriginCC, setSbRTLane1OriginCC] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isLoop || !formData.origin_city) { setLoopOriginIsBorderModal(null); return; }
    const check = async () => {
      const { data } = await supabase
        .from('cities')
        .select('is_border_crossing_city')
        .eq('city_full_name', formData.origin_city)
        .eq('is_border_crossing_city', true)
        .limit(1);
      setLoopOriginIsBorderModal(!!(data && data.length > 0));
    };
    check();
  }, [isLoop, formData.origin_city]);

  useEffect(() => {
    if (!(isSecondaryCircuitLane || isDomesticCircuitSecondary) || !pairedLane) return;
    const lookupMarket = async (cityName: string, setter: (m: string) => void) => {
      if (!cityName) { setter(''); return; }
      const { data } = await supabase
        .from('cities')
        .select('market_name')
        .eq('city_full_name', cityName)
        .maybeSingle();
      setter(data?.market_name || '');
    };
    lookupMarket(pairedLane.origin_city, setLane1OriginMarket);
    lookupMarket(pairedLane.destination_city, setLane1DestMarket);
  }, [isSecondaryCircuitLane, isDomesticCircuitSecondary, pairedLane?.origin_city, pairedLane?.destination_city]);

  useEffect(() => {
    if (!isD2DSBOneWay || !lane.split_billing_group) return;
    if (isD2DSBLane1) {
      setSbOneWayLane1OriginCC(normalizeCountryCode(lane.origin_country_code));
      return;
    }
    const fetchLane1Origin = async () => {
      const { data: groupLanes } = await supabase
        .from('quote_lanes')
        .select('split_billing_index, origin_country_code')
        .eq('split_billing_group', lane.split_billing_group);
      if (!groupLanes) return;
      const lane1Data = groupLanes.find((l: any) => l.split_billing_index === 1);
      if (lane1Data?.origin_country_code) {
        setSbOneWayLane1OriginCC(normalizeCountryCode(lane1Data.origin_country_code));
      }
    };
    fetchLane1Origin();
  }, [isD2DSBOneWay, lane.split_billing_group, lane.id]);

  useEffect(() => {
    if (!(isD2DSBRT || isD2DSBCircuit) || !lane.split_billing_group) return;
    if (isD2DSBLane1) {
      setSbRTLane1OriginCC(normalizeCountryCode(lane.origin_country_code));
      return;
    }
    const fetchLane1Origin = async () => {
      const { data: groupLanes } = await supabase
        .from('quote_lanes')
        .select('split_billing_index, origin_country_code')
        .eq('split_billing_group', lane.split_billing_group);
      if (!groupLanes) return;
      const lane1Data = groupLanes.find((l: any) => l.split_billing_index === 1);
      if (lane1Data?.origin_country_code) {
        setSbRTLane1OriginCC(normalizeCountryCode(lane1Data.origin_country_code));
      }
    };
    fetchLane1Origin();
  }, [isD2DSBRT, isD2DSBCircuit, lane.split_billing_group, lane.id]);

  useEffect(() => {
    if (!isD2DSBCircuit || !lane.split_billing_group) return;
    const fetchGroupMarkets = async () => {
      const { data: groupLanes } = await supabase
        .from('quote_lanes')
        .select('split_billing_index, origin_city, destination_city')
        .eq('split_billing_group', lane.split_billing_group);
      if (!groupLanes) return;
      const lane1Data = groupLanes.find((l: any) => l.split_billing_index === 1);
      const lane2Data = groupLanes.find((l: any) => l.split_billing_index === 2);
      const lookupMarket = async (cityName: string | undefined, setter: (m: string) => void) => {
        if (!cityName) { setter(''); return; }
        const { data } = await supabase
          .from('cities')
          .select('market_name')
          .eq('city_full_name', cityName)
          .maybeSingle();
        setter(data?.market_name || '');
      };
      if (lane1Data?.origin_city) lookupMarket(lane1Data.origin_city, setLane1OriginMarket);
      if (lane2Data?.destination_city) lookupMarket(lane2Data.destination_city, setLane1DestMarket);
    };
    fetchGroupMarkets();
  }, [isD2DSBCircuit, lane.split_billing_group, lane.id]);

  useEffect(() => {
    if (!isD2DSplitBilling || !lane.destination_city) return;
    const lookupCountry = async () => {
      const { data } = await supabase
        .from('cities')
        .select('country_code')
        .eq('city_full_name', lane.destination_city)
        .maybeSingle();
      if (data) setDestinationCountryCode(normalizeCountryCode(data.country_code));
    };
    lookupCountry();
  }, [isD2DSplitBilling, lane.destination_city]);

  const buildLaneFormData = (l: QuoteLane) => ({
    origin_city: l.origin_city || '',
    destination_city: l.destination_city || '',
    border_crossing: l.border_crossing || '',
    border_crossing_rate: l.border_crossing_rate || 0,
    border_crossing_fee: l.border_crossing_fee || 0,
    rate_type: l.rate_type || 'RPM',
    us_rate_type: l.us_rate_type || l.rate_type || 'RPM',
    mx_rate_type: l.mx_rate_type || l.rate_type || 'RPM',
    lane_type: l.lane_type || '',
    load_volume: l.load_volume || '',
    load_frequency: l.load_frequency || '',
    commitment_type: l.commitment_type || '',
    target: l.target || '',
    product: l.product || '',
    type_of_service: l.type_of_service || l.equipment_type || '',
    priority: l.priority || '',
    us_miles: l.us_miles || 0,
    us_rate_per_mile: l.us_rate_per_mile || 0,
    us_rate: l.us_rate || 0,
    us_fuel_rate: l.us_fuel_rate || 0,
    mx_miles: l.mx_miles || 0,
    mx_rate_per_mile: l.mx_rate_per_mile || 0,
    mx_rate: l.mx_rate || 0,
    mx_fuel_rate: l.mx_fuel_rate || 0,
    additional_accessories: l.additional_accessories || '',
    comments: l.comments || '',
    un_number: l.un_number || '',
    msds: l.msds || '',
    weight: l.weight || '',
    dimensions: l.dimensions || '',
    invoice_value: l.invoice_value || 0,
    tarps: l.tarps || '',
    temperature: l.temperature || '',
    packaging: l.packaging || '',
    vin_dimensions: l.vin_dimensions || '',
    number_of_vins: l.number_of_vins || 0,
    live_load_or_drop: l.live_load_or_drop || '',
    currency_code: l.currency_code || currency || 'USD',
    units_code: l.units_code || 'Mi',
    border_crossing_only: l.border_crossing_only || false,
    us_fuel_included_in_line_haul: l.us_fuel_included_in_line_haul || false,
    mx_fuel_included_in_line_haul: l.mx_fuel_included_in_line_haul || false,
  });


  useEffect(() => {
    if ((isLoop || isDoorToDoor) && !originCountryCode && formData.origin_city) {
      (async () => {
        const { data } = await supabase
          .from('cities')
          .select('country_code')
          .eq('city_full_name', formData.origin_city)
          .maybeSingle();
        if (data?.country_code) {
          setOriginCountryCode(data.country_code);
        }
      })();
    }
  }, [isLoop, isDoorToDoor, formData.origin_city, originCountryCode]);

  useEffect(() => {
    setFormData(buildLaneFormData(lane));
    setSelectedAccessorials(
      lane.accessorials_list ? (Array.isArray(lane.accessorials_list) ? lane.accessorials_list : []) : []
    );
    setUsAccessorials(
      lane.us_accessorials_list ? (Array.isArray(lane.us_accessorials_list) ? lane.us_accessorials_list : []) : []
    );
    setMxAccessorials(
      lane.mx_accessorials_list ? (Array.isArray(lane.mx_accessorials_list) ? lane.mx_accessorials_list : []) : []
    );
    setStopsBefore(Array.isArray(lane.stops_before) ? lane.stops_before : []);
    setStopsAfter(Array.isArray(lane.stops_after) ? lane.stops_after : []);
    const normCode = normalizeCountryCode(lane.origin_country_code) || undefined;
    setOriginCountryCode(normCode);
    prevOriginCountry.current = normCode;
    setIsDirty(false);
    setUnsavedDialog(null);
    setErrors({
      origin_city: '',
      destination_city: '',
      border_crossing: '',
      us_rate: '',
      us_miles: '',
      us_rate_per_mile: '',
      us_fuel_rate: '',
      mx_rate: '',
      mx_miles: '',
      mx_rate_per_mile: '',
      mx_fuel_rate: '',
      border_crossing_fee: '',
    });
  }, [lane.id, currency]);

  const [errors, setErrors] = useState({
    origin_city: '',
    destination_city: '',
    border_crossing: '',
    us_rate: '',
    us_miles: '',
    us_rate_per_mile: '',
    us_fuel_rate: '',
    mx_rate: '',
    mx_miles: '',
    mx_rate_per_mile: '',
    mx_fuel_rate: '',
    border_crossing_fee: '',
    estimated_total_us_section: '',
    estimated_total_mx_section: '',
  });



  const getFieldVisibility = (serviceType: string | null | undefined, _countryOverride?: string) => {
    const defaults = {
      usFieldsDisabled: false,
      mxFieldsDisabled: false,
      borderCrossingDisabled: false,
      borderFeeDisabled: false,
    };

    if (isD2DSplitBilling) {
      const sbIdx = lane.split_billing_index || 1;
      const oCC = originCountryCode;
      const dCC = destinationCountryCode;

      if (isD2DSBOneWay && sbOneWayLane1OriginCC) {
        let usDisabled = false;
        let mxDisabled = false;
        let bcDisabled = false;
        let bfDisabled = false;
        if (sbIdx === 1) {
          if (sbOneWayLane1OriginCC === 'MX') {
            usDisabled = true; mxDisabled = false; bcDisabled = false; bfDisabled = false;
          } else {
            usDisabled = false; mxDisabled = true; bcDisabled = true; bfDisabled = true;
          }
        } else if (sbIdx === 2) {
          if (sbOneWayLane1OriginCC === 'MX') {
            usDisabled = false; mxDisabled = true; bcDisabled = true; bfDisabled = true;
          } else {
            usDisabled = true; mxDisabled = false; bcDisabled = false; bfDisabled = false;
          }
        }
        return {
          usFieldsDisabled: usDisabled,
          mxFieldsDisabled: mxDisabled,
          borderCrossingDisabled: bcDisabled,
          borderFeeDisabled: bfDisabled,
        };
      }

      if ((isD2DSBRT || isD2DSBCircuit) && sbRTLane1OriginCC) {
        const lane1IsUS = sbRTLane1OriginCC !== 'MX';
        if (sbIdx === 1 || sbIdx === 4) {
          return {
            usFieldsDisabled: !lane1IsUS,
            mxFieldsDisabled: lane1IsUS,
            borderCrossingDisabled: lane1IsUS,
            borderFeeDisabled: lane1IsUS,
          };
        } else if (sbIdx === 2 || sbIdx === 3) {
          return {
            usFieldsDisabled: lane1IsUS,
            mxFieldsDisabled: !lane1IsUS,
            borderCrossingDisabled: !lane1IsUS,
            borderFeeDisabled: !lane1IsUS,
          };
        }
      }

      const isCrossBorder = oCC && dCC && oCC !== dCC;
      const bothSameNonMX = oCC && dCC && oCC === dCC && oCC !== 'MX';
      const anyMX = oCC === 'MX' || dCC === 'MX';

      let usDisabled: boolean;
      let mxDisabled: boolean;
      if (isCrossBorder) {
        usDisabled = true;
        mxDisabled = false;
      } else if (bothSameNonMX) {
        usDisabled = false;
        mxDisabled = true;
      } else {
        const knownCC = oCC || dCC;
        usDisabled = knownCC === 'MX';
        mxDisabled = !!knownCC && knownCC !== 'MX';
      }

      return {
        usFieldsDisabled: usDisabled,
        mxFieldsDisabled: mxDisabled,
        borderCrossingDisabled: !anyMX,
        borderFeeDisabled: !anyMX,
      };
    }

    if (serviceType === 'Loop') {
      return {
        usFieldsDisabled: true,
        mxFieldsDisabled: false,
        borderCrossingDisabled: false,
        borderFeeDisabled: false,
      };
    } else if (serviceType === 'Domestic') {
      return {
        usFieldsDisabled: false,
        mxFieldsDisabled: true,
        borderCrossingDisabled: true,
        borderFeeDisabled: true,
      };
    }

    return defaults;
  };


  const getFieldClassName = (isDisabled: boolean, hasError: boolean) => {
    if (isDisabled) {
      return 'px-3 py-2 border rounded bg-gray-200 text-gray-500 border-0 cursor-not-allowed text-sm';
    }
    if (hasError) {
      return 'px-3 py-2 border-2 border-red-500 rounded text-sm';
    }
    return 'px-3 py-2 border rounded text-sm';
  };

  const calculateTotal = () => {
    const usRate = formData.us_rate || 0;
    const mxRate = formData.mx_rate || 0;
    const borderRate = formData.border_crossing_rate || 0;
    return usRate + mxRate + borderRate;
  };

  const prevOriginCountry = useRef(originCountryCode);
  useEffect(() => {
    if (isLoop && prevOriginCountry.current && originCountryCode && prevOriginCountry.current !== originCountryCode) {
      if (originCountryCode === 'US') {
        setFormData(prev => ({ ...prev, mx_miles: 0, mx_rate: 0, mx_rate_per_mile: 0, mx_fuel_rate: 0, mx_fuel_included_in_line_haul: false }));
      } else if (originCountryCode === 'MX') {
        setFormData(prev => ({ ...prev, us_miles: 0, us_rate: 0, us_rate_per_mile: 0, us_fuel_rate: 0, us_fuel_included_in_line_haul: false }));
      }
    }
    if (isDoorToDoor && prevOriginCountry.current && originCountryCode && prevOriginCountry.current !== originCountryCode) {
      setFormData(prev => ({ ...prev, destination_city: '' }));
    }
    prevOriginCountry.current = originCountryCode;
  }, [originCountryCode, isLoop, isDoorToDoor]);


  useEffect(() => {
    if (formData.us_rate_type === 'RPM' && formData.us_miles && formData.us_rate_per_mile) {
      setFormData(prev => ({
        ...prev,
        us_rate: formData.us_miles * formData.us_rate_per_mile,
      }));
    }
  }, [formData.us_rate_type, formData.us_miles, formData.us_rate_per_mile]);

  useEffect(() => {
    if (formData.mx_rate_type === 'RPM' && formData.mx_miles && formData.mx_rate_per_mile) {
      setFormData(prev => ({
        ...prev,
        mx_rate: formData.mx_miles * formData.mx_rate_per_mile,
      }));
    }
  }, [formData.mx_rate_type, formData.mx_miles, formData.mx_rate_per_mile]);

  useEffect(() => {
    if (formData.us_rate_type === 'FLT' && formData.us_rate && formData.us_miles) {
      setFormData(prev => ({
        ...prev,
        us_rate_per_mile: formData.us_rate / formData.us_miles,
      }));
    }
  }, [formData.us_rate_type, formData.us_rate, formData.us_miles]);

  useEffect(() => {
    if (formData.mx_rate_type === 'FLT' && formData.mx_rate && formData.mx_miles) {
      setFormData(prev => ({
        ...prev,
        mx_rate_per_mile: formData.mx_rate / formData.mx_miles,
      }));
    }
  }, [formData.mx_rate_type, formData.mx_rate, formData.mx_miles]);


  const markDirty = () => setIsDirty(true);

  const setStopsBeforeDirty = (fn: string[] | ((prev: string[]) => string[])) => {
    setStopsBefore(fn); markDirty();
  };
  const setStopsAfterDirty = (fn: string[] | ((prev: string[]) => string[])) => {
    setStopsAfter(fn); markDirty();
  };
  const setUsAccessorialsDirty = (val: SectionAccessorial[]) => {
    setUsAccessorials(val); markDirty();
  };
  const setMxAccessorialsDirty = (val: SectionAccessorial[]) => {
    setMxAccessorials(val); markDirty();
  };

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    markDirty();
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleNavigateWithCheck = (action: 'next' | 'previous' | 'close') => {
    if (isDirty) {
      setUnsavedDialog({ action });
    } else if (action === 'next') {
      onNextLane?.();
    } else if (action === 'previous') {
      onPreviousLane?.();
    } else {
      onClose();
    }
  };

  const handleUnsavedSaveAndContinue = async () => {
    if (!unsavedDialog) return;
    const saved = await handleSubmit(true);
    if (saved) {
      setIsDirty(false);
      if (unsavedDialog.action === 'next') onNextLane?.();
      else if (unsavedDialog.action === 'previous') onPreviousLane?.();
      else onClose();
    }
    setUnsavedDialog(null);
  };

  const handleUnsavedDiscard = () => {
    if (!unsavedDialog) return;
    setIsDirty(false);
    if (unsavedDialog.action === 'next') onNextLane?.();
    else if (unsavedDialog.action === 'previous') onPreviousLane?.();
    else onClose();
    setUnsavedDialog(null);
  };


  const validateSectionFields = () => {
    return {
      us_rate: '',
      us_miles: '',
      us_rate_per_mile: '',
      us_fuel_rate: '',
      mx_rate: '',
      mx_miles: '',
      mx_rate_per_mile: '',
      mx_fuel_rate: '',
    };
  };

  const validateForm = () => {
    const serviceType = lane.service_type;
    const fieldVis = getFieldVisibility(serviceType);

    let borderCrossingValidation = '';
    if (!fieldVis.borderCrossingDisabled) {
      borderCrossingValidation = formData.border_crossing
        ? (validateBorderCrossing(formData.border_crossing, borderCrossingCities) || '')
        : 'This field is required';
    }

    let destinationCityError = '';
    if (isD2DSBOneWay && isD2DSBLane1) {
      if (sbOneWayLane1OriginCC && sbOneWayLane1OriginCC !== 'MX') {
        destinationCityError = !formData.destination_city ? 'This field is required' : '';
      }
    } else if (isD2DSBOneWay && isD2DSBLane2) {
      destinationCityError = !formData.destination_city ? 'This field is required' : '';
    } else if (isD2DSBCircuit && isD2DSBLane4) {
      destinationCityError = !formData.destination_city ? 'This field is required' : '';
    } else if (isD2DSBLane1 || isD2DSBLane3or4) {
    } else if (isD2DSBLane2) {
      destinationCityError = !formData.destination_city ? 'This field is required' : '';
    } else if (isDoorToDoorRTSecondary) {
    } else if (isDomesticRTSecondary) {
    } else if (isSecondaryRoundTripLane) {
    } else if (isSecondaryCircuitLane) {
      destinationCityError = !formData.destination_city ? 'This field is required' : '';
    } else {
      destinationCityError = !formData.destination_city ? 'This field is required' : '';
      if (isLoop && formData.destination_city && loopOriginIsBorderModal === false) {
        const isValidBorderCity = borderCrossingCities.some(
          c => (c.city_full_name || c.city_name) === formData.destination_city
        );
        if (!isValidBorderCity) {
          destinationCityError = 'Destination City must be a Border Crossing City when Origin City is not a border city';
        }
      }
    }

    let originCityError = '';
    if (isD2DSBCircuit && isD2DSBLane3) {
      originCityError = !formData.origin_city ? 'This field is required' : '';
    } else if (isD2DSBLane2 || isD2DSBLane3or4) {
    } else if (isDoorToDoorRTSecondary) {
    } else if (isDomesticRTSecondary) {
    } else if (isSecondaryRoundTripLane) {
    } else if (isSecondaryCircuitLane) {
      originCityError = !formData.origin_city ? 'This field is required' : '';
    } else {
      originCityError = !formData.origin_city ? 'This field is required' : '';
      if (isDomestic && formData.origin_city && originCountryCode && originCountryCode !== 'US' && originCountryCode !== 'CA') {
        originCityError = 'Origin City must be a US or Canadian city for Domestic service';
      }
    }

    let borderCrossingError = '';
    if ((isD2DSBLane1 || isD2DSBLane2 || isD2DSBLane3or4) && !fieldVis.borderCrossingDisabled) {
      borderCrossingError = borderCrossingValidation;
    } else if (isD2DSBLane1 || isD2DSBLane2 || isD2DSBLane3or4) {
    } else if (isDoorToDoorRTSecondary) {
    } else if (isDomesticRTSecondary) {
    } else if (isSecondaryRoundTripLane) {
    } else {
      borderCrossingError = borderCrossingValidation;
    }

    const sectionErrors = validateSectionFields();

    let borderFeeError = '';
    if (!fieldVis.borderFeeDisabled && !formData.border_crossing_fee) {
      borderFeeError = 'This field is required';
    }

    const fuelProgramOn = accountFuelData.customer_fuel_program;
    const isPercentMethod = fuelProgramOn && (accountFuelData.fuel_program_method === 'percentage' || accountFuelData.fuel_program_type === 'PERCENT');

    let estTotalUSError = '';
    if (isPercentMethod && !fieldVis.usFieldsDisabled && (!formData.estimated_total_us_section || formData.estimated_total_us_section === 0)) {
      estTotalUSError = 'Estimated Total US Section is required for the Customer Fuel Program (Percent)';
    }

    let estTotalMXError = '';
    const effectiveMxDisabled = fieldVis.mxFieldsDisabled || !!formData.border_crossing_only;
    if (isPercentMethod && !effectiveMxDisabled && (!formData.estimated_total_mx_section || formData.estimated_total_mx_section === 0)) {
      estTotalMXError = 'Estimated Total MX Section is required for the Customer Fuel Program (Percent)';
    }

    const newErrors = {
      origin_city: originCityError,
      destination_city: destinationCityError,
      border_crossing: borderCrossingError,
      border_crossing_fee: borderFeeError,
      ...sectionErrors,
      estimated_total_us_section: estTotalUSError,
      estimated_total_mx_section: estTotalMXError,
    };

    setErrors(newErrors);
    const valid = !Object.values(newErrors).some(e => e !== '');

    return valid;
  };

  const buildSavePayload = (
    data: typeof formData,
    fieldVis: ReturnType<typeof getFieldVisibility>,
    countryCode: string | undefined,
    accessorials: SelectedAccessorial[],
    usAcc: SectionAccessorial[],
    mxAcc: SectionAccessorial[],
    stopsBef?: string[],
    stopsAft?: string[],
  ) => {
    const saveData = { ...data };
    if (fieldVis.borderCrossingDisabled) saveData.border_crossing = 'N/A';
    if (fieldVis.borderFeeDisabled) saveData.border_crossing_fee = 0;
    if (lane.service_type === 'Domestic') {
      saveData.border_crossing = 'N/A';
      saveData.border_crossing_fee = 0;
    }
    if (fieldVis.usFieldsDisabled) {
      saveData.us_rate = 0;
      saveData.us_miles = 0;
      saveData.us_fuel_rate = 0;
      saveData.us_rate_per_mile = 0;
    }
    if (fieldVis.mxFieldsDisabled) {
      saveData.mx_rate = 0;
      saveData.mx_miles = 0;
      saveData.mx_fuel_rate = 0;
      saveData.mx_rate_per_mile = 0;
    }
    const totalAcc = accessorials.reduce((sum, a) => {
      if (a.unit_type === 'RPM') return sum + (a.rate * (a.quantity || 1));
      return sum + a.rate;
    }, 0);

    const usAccTotal = fieldVis.usFieldsDisabled ? 0 : calcSectionAccessorialsTotal(usAcc);
    const mxAccTotal = fieldVis.mxFieldsDisabled ? 0 : calcSectionAccessorialsTotal(mxAcc);

    const fuelProgramOn = accountFuelData.customer_fuel_program;
    const todaysFuelVal = quote?.today_fuel_rate || 0;

    let usFuelDiffCalc = 0;
    let mxFuelDiffCalc = 0;

    if (fuelProgramOn && !fieldVis.usFieldsDisabled) {
      const isPercent = accountFuelData.fuel_program_method === 'percentage' || accountFuelData.fuel_program_type === 'PERCENT';
      let effectiveUSFR = saveData.us_fuel_rate || 0;
      if (!isPercent) {
        effectiveUSFR = accountFuelData.fuel_rate_per_mile;
      } else {
        const pct = accountFuelData.fuel_rate_per_mile / 100;
        effectiveUSFR = (saveData.us_miles || 0) > 0 ? ((saveData.estimated_total_us_section || 0) * pct) / (saveData.us_miles || 1) : 0;
      }
      usFuelDiffCalc = effectiveUSFR < todaysFuelVal ? todaysFuelVal - effectiveUSFR : 0;
    }

    if (fuelProgramOn && !fieldVis.mxFieldsDisabled) {
      const isPercent = accountFuelData.fuel_program_method === 'percentage' || accountFuelData.fuel_program_type === 'PERCENT';
      let effectiveMXFR = saveData.mx_fuel_rate || 0;
      if (!isPercent) {
        effectiveMXFR = accountFuelData.fuel_rate_per_mile;
      } else {
        const pct = accountFuelData.fuel_rate_per_mile / 100;
        effectiveMXFR = (saveData.mx_miles || 0) > 0 ? ((saveData.estimated_total_mx_section || 0) * pct) / (saveData.mx_miles || 1) : 0;
      }
      mxFuelDiffCalc = effectiveMXFR < todaysFuelVal ? todaysFuelVal - effectiveMXFR : 0;
    }

    return {
      ...saveData,
      origin_country_code: countryCode,
      ...(isD2DSBLane2 ? { destination_country_code: destinationCountryCode } : {}),
      accessorials_amount: totalAcc,
      accessorials_list: accessorials,
      us_accessorials_list: fieldVis.usFieldsDisabled ? [] : usAcc,
      us_accessorials_amount: usAccTotal,
      mx_accessorials_list: fieldVis.mxFieldsDisabled ? [] : mxAcc,
      mx_accessorials_amount: mxAccTotal,
      us_fuel_difference: usFuelDiffCalc,
      mx_fuel_difference: mxFuelDiffCalc,
      ...(stopsBef !== undefined ? { stops_before: stopsBef } : {}),
      ...(stopsAft !== undefined ? { stops_after: stopsAft } : {}),
    };
  };

  const handleSubmit = async (skipClose = false) => {
    if (!validateForm()) {
      return false;
    }

    if (isDoorToDoor && !isD2DSplitBilling && formData.origin_city && formData.destination_city) {
      const [{ data: origCity }, { data: destCity }] = await Promise.all([
        supabase.from('cities').select('country_code').eq('city_full_name', formData.origin_city).maybeSingle(),
        supabase.from('cities').select('country_code').eq('city_full_name', formData.destination_city).maybeSingle(),
      ]);
      if (origCity && destCity) {
        const origNorm = normalizeCountryCode(origCity.country_code);
        const destNorm = normalizeCountryCode(destCity.country_code);
        if (origNorm === destNorm) {
          setErrors(prev => ({ ...prev, destination_city: 'Destination City must be in a different country than Origin City for Door to Door service' }));
          return false;
        }
      }
    }

    const fieldVis = getFieldVisibility(lane.service_type);
    const isSecondaryLane = isSecondaryRoundTripLane || isSecondaryCircuitLane;
    const effectiveFieldVis = isDomesticRTSecondary
      ? fieldVis
      : isSecondaryLane
        ? { ...fieldVis, usFieldsDisabled: true }
        : fieldVis;
    const lane1Payload = buildSavePayload(formData, effectiveFieldVis, originCountryCode, selectedAccessorials, usAccessorials, mxAccessorials, stopsBefore, stopsAfter);

    let lane2Payload: Partial<QuoteLane> | undefined;
    const isSecondaryLane2 = isSecondaryRoundTripLane || isSecondaryCircuitLane || isDomesticRTSecondary || isDomesticCircuitSecondary || isDoorToDoorRTSecondary || isD2DSBLane2 || isD2DSBLane3or4;
    if (hasPairedLane && pairedLane && !isSecondaryLane2 && !isD2DSplitBilling) {
      lane2Payload = {};
      if (isRoundTrip) {
        lane2Payload.origin_city = formData.destination_city;
        lane2Payload.destination_city = formData.origin_city;
        if (isLoop) {
          lane2Payload.border_crossing = formData.border_crossing;
        }
        if (isDoorToDoor) {
          lane2Payload.border_crossing = formData.border_crossing;
          lane2Payload.border_crossing_only = formData.border_crossing_only;
        }
        if (isDomestic) {
          lane2Payload.border_crossing = 'N/A';
          lane2Payload.border_crossing_fee = 0;
        }
        lane2Payload.origin_country_code = originCountryCode;
      }
      if (isCircuit && isDoorToDoor) {
        lane2Payload.border_crossing_only = formData.border_crossing_only;
      }
      if (isCircuit && isDomestic) {
        lane2Payload.border_crossing = 'N/A';
        lane2Payload.border_crossing_fee = 0;
        lane2Payload.border_crossing_rate = 0;
        lane2Payload.mx_rate = 0;
        lane2Payload.mx_miles = 0;
        lane2Payload.mx_fuel_rate = 0;
        lane2Payload.mx_rate_per_mile = 0;
      }
    }

    if (isDoorToDoor && (isRoundTrip || isCircuit) && hasPairedLane && pairedLane && isSecondaryLane2 && !isD2DSplitBilling) {
      if (!lane2Payload) lane2Payload = {};
      lane2Payload.border_crossing_only = formData.border_crossing_only;
    }

    if (isD2DSBOneWay && isD2DSBLane1) {
      lane2Payload = {
        origin_city: formData.destination_city,
      };
      if (sbOneWayLane1OriginCC === 'MX') {
        lane2Payload.border_crossing = formData.border_crossing;
      }
    } else if (isD2DSplitBilling && (isD2DSBLane1 || isD2DSBLane2)) {
      const bcValue = formData.border_crossing;
      lane2Payload = {
        border_crossing: bcValue,
        ...(isD2DSBLane1 ? { origin_city: bcValue || formData.destination_city } : {}),
        ...(isD2DSBLane2 ? { destination_city: bcValue || formData.origin_city } : {}),
      };
    }

    await onSave(lane1Payload, lane2Payload);
    setIsDirty(false);
    if (!skipClose) {
      onClose();
    }
    return true;
  };

  const getEquipmentSpecificFields = () => {
    const serviceType = formData.type_of_service;

    if (serviceType === 'Dry Van' || serviceType === 'Hazmat') {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              UN #
            </label>
            <input
              type="text"
              value={formData.un_number}
              onChange={(e) => handleChange('un_number', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MSDS
            </label>
            <input
              type="text"
              value={formData.msds}
              onChange={(e) => handleChange('msds', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </>
      );
    }

    if (serviceType === 'Flatbed' || serviceType === 'Step Deck') {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Weight
            </label>
            <input
              type="text"
              value={formData.weight}
              onChange={(e) => handleChange('weight', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Dimensions
            </label>
            <input
              type="text"
              value={formData.dimensions}
              onChange={(e) => handleChange('dimensions', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Invoice Value
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.invoice_value}
              onChange={(e) => handleChange('invoice_value', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tarps
            </label>
            <input
              type="text"
              value={formData.tarps}
              onChange={(e) => handleChange('tarps', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </>
      );
    }

    if (serviceType === 'Refrigerated / Reefer') {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature
            </label>
            <input
              type="text"
              value={formData.temperature}
              onChange={(e) => handleChange('temperature', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Packaging
            </label>
            <input
              type="text"
              value={formData.packaging}
              onChange={(e) => handleChange('packaging', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </>
      );
    }

    if (serviceType === 'AH') {
      return (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              VIN Dimensions
            </label>
            <input
              type="text"
              value={formData.vin_dimensions}
              onChange={(e) => handleChange('vin_dimensions', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of VINs
            </label>
            <input
              type="number"
              value={formData.number_of_vins}
              onChange={(e) => handleChange('number_of_vins', parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </>
      );
    }

    if (serviceType === 'Intermodal') {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Live Load or Drop
          </label>
          <select
            value={formData.live_load_or_drop}
            onChange={(e) => handleChange('live_load_or_drop', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select...</option>
            {LIVE_LOAD_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      );
    }

    return null;
  };


  const renderReadOnlyField = (value: number | string) => {
    return (
      <div className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-900 rounded border-0">
        {typeof value === 'number' ? formatCurrencyOrDash(value, currencyCode) : value}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => handleNavigateWithCheck('close')} />
      <div className="relative bg-white w-full max-w-[900px] max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-gray-200">
        {(() => {
          const serviceType = lane.service_type || 'Door to Door';
          const tripType = lane.trip_type || 'One Way';
          const isSB = !!lane.split_billing_group;
          const isOneWay = tripType === 'One Way';
          const isRT = tripType === 'Round Trip';
          const isCircuitType = tripType === 'Circuit';
          const isPaired = !!(lane.paired_lane_id || pairedLane);
          let bannerText = `${serviceType} — ${tripType}`;
          let laneInfo = '';
          if (isSB) {
            const totalLanes = (isRT || isCircuitType) ? 4 : 2;
            const laneIdx = lane.split_billing_index || 1;
            bannerText += ` | Split Billing`;
            laneInfo = `Lane ${laneIdx} of ${totalLanes}`;
          } else if ((isRT || isCircuitType) && isPaired) {
            const laneIdx = lane.is_primary_lane === false ? 2 : 1;
            laneInfo = `Lane ${laneIdx} of 2`;
          }
          return (
            <div
              className="flex-shrink-0 w-full font-semibold text-white flex items-center gap-2.5"
              style={{ background: 'linear-gradient(90deg, #0a5f5e, #0e7c7b)', fontSize: '13.5px', padding: '11px 22px', letterSpacing: '0.3px' }}
            >
              <span>{bannerText}</span>
              {tripType && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: 'rgba(255,255,255,0.18)' }}>
                  {tripType}
                </span>
              )}
              {laneInfo && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: 'rgba(255,255,255,0.18)' }}>
                  {laneInfo}
                </span>
              )}
            </div>
          );
        })()}
        <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {locked ? 'View' : 'Edit'} QL-{lane.sort_order.toString().padStart(8, '0')}{locked ? ' (Read Only)' : ''}
              </h2>
              <div className="text-xs text-gray-500 mt-1">
                <span className="text-red-500 font-semibold">*</span> = Required Information
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCollapsedSections({ actions: false, us: false, mx: false, additional: false })}
                className="text-[11.5px] font-semibold px-2.5 py-1 rounded-md border transition-colors"
                style={{ color: '#0a5f5e', background: '#e8f3f3', borderColor: '#b8dcdb' }}
              >
                Expand all
              </button>
              <button
                onClick={() => setCollapsedSections({ actions: true, us: true, mx: true, additional: true })}
                className="text-[11.5px] font-semibold px-2.5 py-1 rounded-md border transition-colors"
                style={{ color: '#0a5f5e', background: '#e8f3f3', borderColor: '#b8dcdb' }}
              >
                Collapse all
              </button>
              <button
                onClick={() => handleNavigateWithCheck('close')}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors ml-1"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ background: '#f6f8fa' }}>
          <div className="space-y-4">
            {locked && (
              <div className="bg-[#FEF3C7] border border-amber-300 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-amber-900">
                <span>🔒</span>
                <span>This quote is locked (Stage: {quote?.stage || 'Unknown'}). Move the stage to In Progress to enable editing.</span>
              </div>
            )}
            <div className={locked ? 'pointer-events-none opacity-75' : ''}>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" style={{ borderLeftWidth: '6px', borderLeftColor: '#0e7c7b' }}>
              <button
                type="button"
                onClick={() => setCollapsedSections(s => ({ ...s, actions: !s.actions }))}
                className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                style={{ background: '#e8f3f3' }}
              >
                <span className="text-xs font-bold tracking-wider uppercase" style={{ color: '#0a5f5e' }}>Actions</span>
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded" style={{ background: '#0e7c7b', color: '#fff', letterSpacing: '0.4px' }}>LANE SETUP</span>
                {collapsedSections.actions && (
                  <span className="ml-auto text-xs text-gray-500 font-mono font-medium">{formData.currency_code} / {formData.units_code} / BCO {formData.border_crossing_only ? 'Yes' : 'No'} / {formData.rate_type}</span>
                )}
                <span className={`${collapsedSections.actions ? '' : 'ml-auto'} text-gray-400 transition-transform ${collapsedSections.actions ? '' : 'rotate-180'}`}>
                  <ChevronDown className="w-4 h-4" />
                </span>
              </button>
              {!collapsedSections.actions && (
              <div className="p-5 border-t border-gray-100">
              <div className="grid grid-cols-4 gap-x-6">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Currency</label>
                  <select
                    value={formData.currency_code}
                    onChange={async (e) => {
                      const newCurrency = e.target.value;
                      if (newCurrency === formData.currency_code) return;
                      if (onChangeCurrency) {
                        const exchangeRate = quote?.exchange_rate || 0;
                        const cadRate = quote?.cad_exchange_rate || 0;
                        const fromCurrency = formData.currency_code || 'USD';
                        const needsMXN = fromCurrency === 'MXN' || newCurrency === 'MXN';
                        const needsCAD = fromCurrency === 'CAD' || newCurrency === 'CAD';
                        if (needsMXN && exchangeRate <= 0) {
                          setCurrencyWarning('Please set the Exchange Rate (USD → MXN) in the Quote Header before changing currency');
                          return;
                        }
                        if (needsCAD && cadRate <= 0) {
                          setCurrencyWarning('Please set the USD → CAD Rate in the Quote Header before changing currency');
                          return;
                        }
                        setCurrencyWarning('');
                        await onChangeCurrency(newCurrency);
                        handleChange('currency_code', newCurrency);
                      } else {
                        handleChange('currency_code', newCurrency);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {CURRENCIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {currencyWarning && (
                    <div className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">{currencyWarning}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Units</label>
                  <select
                    value={formData.units_code}
                    onChange={(e) => handleChange('units_code', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {UNITS_OPTIONS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Border Crossing Only</label>
                  {(isLoop || isDomestic) ? (
                    <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>No</div>
                  ) : (
                    <select
                      value={formData.border_crossing_only ? 'Yes' : 'No'}
                      onChange={(e) => {
                        const newVal = e.target.value === 'Yes';
                        handleChange('border_crossing_only', newVal);
                        if (isDoorToDoor && (isRoundTrip || isCircuit) && !isD2DSplitBilling && pairedLane && onUpdatePairedLaneBCO) {
                          onUpdatePairedLaneBCO(pairedLane.id, newVal);
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Rate Type</label>
                  <select
                    value={formData.rate_type}
                    onChange={(e) => {
                      const newVal = e.target.value;
                      handleChange('rate_type', newVal);
                      if (isDomestic) {
                        setFormData(prev => ({ ...prev, rate_type: newVal, us_rate_type: newVal, mx_rate_type: newVal }));
                      } else {
                        setPendingGlobalRateType(newVal);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="FLT">Flat Rate</option>
                    <option value="RPM">RPM</option>
                  </select>
                  {pendingGlobalRateType !== null && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                      <div className="mb-1.5">Apply "{pendingGlobalRateType === 'FLT' ? 'Flat Rate' : 'RPM'}" to both US and MX sections?</div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, us_rate_type: pendingGlobalRateType!, mx_rate_type: pendingGlobalRateType! }));
                            setPendingGlobalRateType(null);
                          }}
                          className="px-2 py-0.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors text-xs"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingGlobalRateType(null)}
                          className="px-2 py-0.5 bg-white border border-amber-400 text-amber-700 rounded hover:bg-amber-50 transition-colors text-xs"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {isDoorToDoor && (isRoundTrip || isCircuit) && !isD2DSplitBilling && hasPairedLane && formData.border_crossing_only && (
                <div className="mt-3 p-2.5 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span>Border Crossing Only has been applied to both lanes in this {isRoundTrip ? 'Round Trip' : 'Circuit'} pair.</span>
                </div>
              )}
              </div>
              )}
            </div>

            {isD2DSplitBilling && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  {isD2DSBCircuit && isD2DSBLane3 ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 3</span> of a <span className="font-semibold">Door to Door Circuit Split Billing</span> group (4 lanes). Origin City is filtered by Lane 2 Destination City market. Destination City and Border Crossing are auto-populated.
                    </p>
                  ) : isD2DSBCircuit && isD2DSBLane4 ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 4</span> of a <span className="font-semibold">Door to Door Circuit Split Billing</span> group (4 lanes). Origin City and Border Crossing are auto-populated. Destination City is filtered by Lane 1 Origin City market.
                    </p>
                  ) : isD2DSBLane3or4 ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane {lane.split_billing_index}</span> of a <span className="font-semibold">Door to Door {isRoundTrip ? 'Round Trip ' : ''}Split Billing</span> group (4 lanes). All city fields are auto-populated from Lanes 1 and 2 and cannot be edited here.
                    </p>
                  ) : (isD2DSBLane1 || isD2DSBLane2) && isD2DSBCircuit ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane {lane.split_billing_index}</span> of a <span className="font-semibold">Door to Door Circuit Split Billing</span> group (4 lanes). Changes to city fields will automatically update Lanes 3 and 4.
                    </p>
                  ) : isD2DSBOneWay && isD2DSBLane1 ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 1</span> of a <span className="font-semibold">Door to Door One Way Split Billing</span> group (2 lanes).
                      {sbOneWayLane1OriginCC === 'MX'
                        ? ' Destination City is auto-populated from Border Crossing City. Lane 2 Origin is auto-populated from this lane\'s Destination.'
                        : ' Destination City is a border crossing city. Lane 2 Origin is auto-populated from this lane\'s Destination.'}
                    </p>
                  ) : isD2DSBOneWay && isD2DSBLane2 ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 2</span> of a <span className="font-semibold">Door to Door One Way Split Billing</span> group (2 lanes). Origin City is auto-populated from Lane 1 Destination.
                    </p>
                  ) : (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane {lane.split_billing_index}</span> of a <span className="font-semibold">Door to Door {isRoundTrip ? 'Round Trip ' : ''}Split Billing</span> group ({isRoundTrip || isCircuit ? '4' : '2'} lanes). {isD2DSBRT ? 'Changes to city fields will automatically update Lanes 3 and 4.' : 'Changes to city fields will automatically update the paired lane.'}
                    </p>
                  )}
                </div>
              </div>
            )}

            {!isD2DSplitBilling && lane.paired_lane_id && (lane.trip_type === 'Round Trip' || lane.trip_type === 'Circuit') && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  {isDoorToDoorRTSecondary ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 2</span> of a <span className="font-semibold">Door to Door Round Trip</span> pair. Origin City, Destination City, and Border Crossing City are auto-populated from Lane 1 and cannot be edited here. Border Fee and all rate fields are independently editable.
                    </p>
                  ) : isDoorToDoorRTPrimary ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 1</span> of a <span className="font-semibold">Door to Door Round Trip</span> pair. Changes to Origin City, Destination City, and Border Crossing City will automatically update Lane 2.
                    </p>
                  ) : isDomesticCircuitSecondary ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 2</span> of a <span className="font-semibold">Domestic Circuit</span> pair. Origin City is filtered to match the market of Lane 1 Destination City. Destination City is filtered to match the market of Lane 1 Origin City.
                    </p>
                  ) : isDomesticCircuitPrimary ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 1</span> of a <span className="font-semibold">Domestic Circuit</span> pair. Changes to Origin City and Destination City will refilter the available city options for Lane 2.
                    </p>
                  ) : isDomesticRTSecondary ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 2</span> of a <span className="font-semibold">Domestic Round Trip</span> pair. Origin City and Destination City are auto-populated from Lane 1 and cannot be edited here.
                    </p>
                  ) : isDomesticRTPrimary ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 1</span> of a <span className="font-semibold">Domestic Round Trip</span> pair. Changes to Origin City and Destination City will automatically update Lane 2.
                    </p>
                  ) : isSecondaryCircuitLane ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 2</span> of a <span className="font-semibold">Loop Circuit</span> pair. Origin City is filtered to match the market of Lane 1 Destination City. Destination City is filtered to match the market of Lane 1 Origin City.
                    </p>
                  ) : isSecondaryRoundTripLane ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 2</span> of a <span className="font-semibold">Loop {lane.trip_type}</span> pair. Origin City, Destination City, and Border Crossing City are synced from Lane 1 and cannot be edited here. You can edit Border Fee, MX Section fields, and other lane details.
                    </p>
                  ) : isCircuit && lane.is_primary_lane !== false ? (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 1</span> of a <span className="font-semibold">Loop Circuit</span> pair. Changes to Origin City and Destination City will refilter the available city options for Lane 2.
                    </p>
                  ) : (
                    <p className="text-sm text-yellow-800">
                      This is <span className="font-semibold">Lane 1</span> of a <span className="font-semibold">Loop {lane.trip_type}</span> pair. Changes to Origin City, Destination City, or Border Crossing City will automatically update the corresponding fields on Lane 2. Use <span className="font-semibold">Next Lane</span> to navigate to Lane 2 and enter its information separately.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" style={{ borderLeftWidth: '6px', borderLeftColor: '#475569' }}>
              <div className="flex items-center gap-3 px-5 py-3 border-b-2 border-gray-400" style={{ background: '#f1f5f9' }}>
                <span className="text-xs font-bold tracking-wider uppercase text-gray-600">General Section</span>
                <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded text-white" style={{ background: '#475569', letterSpacing: '0.4px' }}>ROUTING</span>
              </div>
              <div className="p-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    <span className="text-red-500">*</span> Origin City
                  </label>
                  {isD2DSBCircuit && isD2DSBLane3 ? (
                    <>
                      <MarketFilteredCityLookup
                        value={formData.origin_city}
                        onChange={(value, _mkt, countryCode) => {
                          handleChange('origin_city', value);
                          if (countryCode) setOriginCountryCode(countryCode);
                        }}
                        marketFilter={lane1DestMarket}
                        placeholder={lane1DestMarket ? `Search cities in ${lane1DestMarket}...` : 'Select city...'}
                        hasError={!!errors.origin_city}
                        disabled={!lane1DestMarket}
                        disabledMessage="Please select Destination City on Lane 2"
                      />
                    </>
                  ) : (isD2DSBLane2 || isD2DSBLane3or4) ? (
                    <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                      <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700">{formData.origin_city || '—'}</span>
                    </div>
                  ) : isDoorToDoorRTSecondary ? (
                    <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                      <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700">{formData.origin_city || '—'}</span>
                    </div>
                  ) : isDomesticRTSecondary ? (
                    <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                      <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700">{formData.origin_city || '—'}</span>
                    </div>
                  ) : isDomesticCircuitSecondary ? (
                    <MarketFilteredCityLookup
                      value={formData.origin_city}
                      onChange={(value) => handleChange('origin_city', value)}
                      marketFilter={lane1DestMarket}
                      placeholder={lane1DestMarket ? `Search US cities in ${lane1DestMarket}...` : 'Select city...'}
                      hasError={!!errors.origin_city}
                      disabled={!lane1DestMarket}
                      disabledMessage="Please select Destination City on the first Lane"
                      countryFilter="USA"
                    />
                  ) : isSecondaryRoundTripLane ? (
                    <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                      <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700">{formData.origin_city || '—'}</span>
                    </div>
                  ) : isSecondaryCircuitLane ? (
                    <MarketFilteredCityLookup
                      value={formData.origin_city}
                      onChange={(value) => handleChange('origin_city', value)}
                      marketFilter={lane1DestMarket}
                      placeholder={lane1DestMarket ? `Search cities in ${lane1DestMarket}...` : 'Select city...'}
                      hasError={!!errors.origin_city}
                      disabled={!lane1DestMarket}
                      disabledMessage="Please select Destination City on the first Lane"
                    />
                  ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <CityLookupField
                        value={formData.origin_city}
                        onChange={(value, countryCode, cityInfo) => {
                          handleChange('origin_city', value);
                          setOriginCountryCode(countryCode);
                          if (isLoop && value) {
                            (async () => {
                              const { data } = await supabase
                                .from('cities')
                                .select('is_border_crossing_city')
                                .eq('city_full_name', value)
                                .eq('is_border_crossing_city', true)
                                .limit(1);
                              const isBorder = !!(data && data.length > 0);
                              const prev = loopOriginIsBorderModal;
                              setLoopOriginIsBorderModal(isBorder);
                              if (prev !== null && prev !== isBorder && formData.destination_city) {
                                handleChange('destination_city', '');
                                setErrors(e => ({ ...e, destination_city: 'Please reselect Destination City' }));
                              }
                            })();
                          }
                          if (isD2DSBOneWay && isD2DSBLane1 && countryCode) {
                            const newCC = normalizeCountryCode(countryCode);
                            if (newCC !== sbOneWayLane1OriginCC) {
                              setSbOneWayLane1OriginCC(newCC);
                              setFormData(prev => ({
                                ...prev,
                                destination_city: '',
                                border_crossing: '',
                                border_crossing_fee: 0,
                              }));
                              setErrors(e => ({ ...e, destination_city: '', border_crossing: '' }));
                            }
                          }
                        }}
                        placeholder={isLoop ? "Search MX or border cities..." : isDomestic ? "Search US/CAN cities..." : "Search city..."}
                        countryFilter={isLoop ? 'MEX' : isDomestic ? 'US_CAN' : undefined}
                        includeBorderCrossing={isLoop}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setStopsBeforeDirty(prev => [...prev, ''])}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-teal-700 text-white hover:bg-teal-800 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  )}
                  {errors.origin_city && (
                    <div className="text-xs text-red-500 mt-0.5">{errors.origin_city}</div>
                  )}
                  {stopsBefore.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Stops Before Crossing Border</div>
                      {stopsBefore.map((stop, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="text-xs text-gray-500 w-12 flex-shrink-0">Stop {idx + 1}</div>
                          <div className="flex-1">
                            <CityLookupField
                              value={stop}
                              onChange={(value) => {
                                const updated = [...stopsBefore];
                                updated[idx] = value;
                                setStopsBeforeDirty(updated);
                              }}
                              placeholder="Search city..."
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setStopsBeforeDirty(prev => prev.filter((_, i) => i !== idx))}
                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    <span className="text-red-500">*</span> Destination City
                  </label>
                  {isD2DSBCircuit && isD2DSBLane4 ? (
                    <>
                      <MarketFilteredCityLookup
                        value={formData.destination_city}
                        onChange={(value, _mkt, countryCode) => {
                          handleChange('destination_city', value);
                          if (countryCode) setDestinationCountryCode(normalizeCountryCode(countryCode));
                        }}
                        marketFilter={lane1OriginMarket}
                        placeholder={lane1OriginMarket ? `Search cities in ${lane1OriginMarket}...` : 'Select city...'}
                        hasError={!!errors.destination_city}
                        disabled={!lane1OriginMarket}
                        disabledMessage="Please select Origin City on Lane 1"
                      />
                    </>
                  ) : isD2DSBOneWay && isD2DSBLane1 ? (
                    sbOneWayLane1OriginCC && sbOneWayLane1OriginCC !== 'MX' ? (
                      <>
                        <BorderCrossingLookup
                          value={formData.destination_city}
                          onChange={(value) => handleChange('destination_city', value)}
                          hasError={!!errors.destination_city}
                          placeholder="Select border crossing city..."
                        />
                        {errors.destination_city && (
                          <div className="text-xs text-red-500 mt-0.5">{errors.destination_city}</div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700">{formData.destination_city || 'Auto (= Border Crossing)'}</span>
                      </div>
                    )
                  ) : isD2DSBOneWay && isD2DSBLane2 ? (
                    <>
                      <CityLookupField
                        value={formData.destination_city}
                        onChange={(value, countryCode) => {
                          handleChange('destination_city', value);
                          if (countryCode) setDestinationCountryCode(normalizeCountryCode(countryCode));
                        }}
                        placeholder={sbOneWayLane1OriginCC === 'MX' ? 'Search US/CAN cities...' : 'Search MX cities...'}
                        countryFilter={sbOneWayLane1OriginCC === 'MX' ? 'US_CAN' : 'MEX'}
                      />
                      {errors.destination_city && (
                        <div className="text-xs text-red-500 mt-0.5">{errors.destination_city}</div>
                      )}
                    </>
                  ) : (isD2DSBLane1 || isD2DSBLane3or4) ? (
                    <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                      <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700">{formData.destination_city || '—'}</span>
                    </div>
                  ) : isD2DSBLane2 ? (
                    <>
                      <CityLookupField
                        value={formData.destination_city}
                        onChange={(value, countryCode) => {
                          handleChange('destination_city', value);
                          if (countryCode) setDestinationCountryCode(normalizeCountryCode(countryCode));
                        }}
                        placeholder={originCountryCode === 'MX' ? 'Search US/CAN cities...' : (originCountryCode === 'US' || originCountryCode === 'CA') ? 'Search MX cities...' : 'Search city...'}
                        countryFilter={originCountryCode === 'MX' ? 'US_CAN' : (originCountryCode === 'US' || originCountryCode === 'CA') ? 'MEX' : undefined}
                      />
                    </>
                  ) : isDoorToDoorRTSecondary ? (
                    <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                      <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700">{formData.destination_city || '—'}</span>
                    </div>
                  ) : isDomesticRTSecondary ? (
                    <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                      <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700">{formData.destination_city || '—'}</span>
                    </div>
                  ) : isDomesticCircuitSecondary ? (
                    <MarketFilteredCityLookup
                      value={formData.destination_city}
                      onChange={(value) => handleChange('destination_city', value)}
                      marketFilter={lane1OriginMarket}
                      placeholder={lane1OriginMarket ? `Search US cities in ${lane1OriginMarket}...` : 'Select city...'}
                      hasError={!!errors.destination_city}
                      disabled={!lane1OriginMarket}
                      disabledMessage="Please select Origin City on the first Lane"
                      countryFilter="USA"
                    />
                  ) : isSecondaryRoundTripLane ? (
                    <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                      <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-gray-700">{formData.destination_city || '—'}</span>
                    </div>
                  ) : isSecondaryCircuitLane ? (
                    <MarketFilteredCityLookup
                      value={formData.destination_city}
                      onChange={(value) => handleChange('destination_city', value)}
                      marketFilter={lane1OriginMarket}
                      placeholder={lane1OriginMarket ? `Search cities in ${lane1OriginMarket}...` : 'Select city...'}
                      hasError={!!errors.destination_city}
                      disabled={!lane1OriginMarket}
                      disabledMessage="Please select Origin City on the first Lane"
                    />
                  ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      {isLoop && loopOriginIsBorderModal === true ? (
                        <CityLookupField
                          value={formData.destination_city}
                          onChange={(value) => handleChange('destination_city', value)}
                          placeholder="Search MX cities..."
                          countryFilter="MEX"
                        />
                      ) : isLoop ? (
                        <BorderCrossingLookup
                          value={formData.destination_city}
                          onChange={(value) => {
                            handleChange('destination_city', value);
                          }}
                          placeholder="Select border crossing city..."
                          hasError={!!errors.destination_city}
                        />
                      ) : (
                        <CityLookupField
                          value={formData.destination_city}
                          onChange={(value) => handleChange('destination_city', value)}
                          placeholder={isDomestic ? "Search US/CAN cities..." : isDoorToDoor ? (originCountryCode === 'MX' ? 'Search US/CAN cities...' : (originCountryCode === 'US' || originCountryCode === 'CA') ? 'Search MX cities...' : 'Search city...') : "Search city..."}
                          countryFilter={isDomestic ? 'US_CAN' : isDoorToDoor ? (originCountryCode === 'MX' ? 'US_CAN' : (originCountryCode === 'US' || originCountryCode === 'CA') ? 'MEX' : undefined) : undefined}
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setStopsAfterDirty(prev => [...prev, ''])}
                      className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded bg-teal-700 text-white hover:bg-teal-800 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  )}
                  {errors.destination_city && (
                    <div className="text-xs text-red-500 mt-0.5">{errors.destination_city}</div>
                  )}
                  {stopsAfter.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Stops After Crossing Border</div>
                      {stopsAfter.map((stop, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="text-xs text-gray-500 w-12 flex-shrink-0">Stop {idx + 1}</div>
                          <div className="flex-1">
                            <CityLookupField
                              value={stop}
                              onChange={(value) => {
                                const updated = [...stopsAfter];
                                updated[idx] = value;
                                setStopsAfterDirty(updated);
                              }}
                              placeholder="Search city..."
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setStopsAfterDirty(prev => prev.filter((_, i) => i !== idx))}
                            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {(() => {
                  const fieldVis = getFieldVisibility(lane.service_type);
                  return (
                    <>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          {!fieldVis.borderCrossingDisabled && <span className="text-red-500">*</span>} Border Crossing City
                        </label>
                        {(isD2DSBLane1 || isD2DSBLane2 || isD2DSBLane3or4) && fieldVis.borderCrossingDisabled ? (
                          <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                            <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700">{formData.border_crossing || 'N/A'}</span>
                          </div>
                        ) : (isD2DSBLane1 || isD2DSBLane2 || isD2DSBLane3or4) ? (
                          <>
                            <BorderCrossingLookup
                              value={formData.border_crossing}
                              onChange={(value) => {
                                handleChange('border_crossing', value);
                              }}
                              hasError={!!errors.border_crossing}
                              placeholder="Select border crossing city..."
                            />
                            {errors.border_crossing && (
                              <div className="text-xs text-red-500 mt-0.5">{errors.border_crossing}</div>
                            )}
                          </>
                        ) : isDoorToDoorRTSecondary ? (
                          <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                            <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700">{formData.border_crossing || '—'}</span>
                          </div>
                        ) : isDomesticRTSecondary ? (
                          <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                            <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700">N/A</span>
                          </div>
                        ) : isSecondaryRoundTripLane ? (
                          <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                            <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700">{formData.border_crossing || '—'}</span>
                          </div>
                        ) : fieldVis.borderCrossingDisabled ? (
                          <div className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                            <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700">N/A</span>
                          </div>
                        ) : (
                          <>
                            <BorderCrossingLookup
                              value={formData.border_crossing}
                              onChange={(value) => handleChange('border_crossing', value)}
                              hasError={!!errors.border_crossing}
                              placeholder="Select border crossing city..."
                            />
                            {errors.border_crossing && (
                              <div className="text-xs text-red-500 mt-0.5">{errors.border_crossing}</div>
                            )}
                          </>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          {!fieldVis.borderFeeDisabled && <span className="text-red-500">*</span>} Border Fee
                        </label>
                        {fieldVis.borderFeeDisabled ? (
                          <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>{currencyCode} $0.00</div>
                        ) : (
                          <>
                            <CurrencyInput
                              value={formData.border_crossing_fee}
                              onChange={(value) => handleChange('border_crossing_fee', value)}
                              hasError={!!errors.border_crossing_fee}
                              currencyCode={currencyCode}
                            />
                            {errors.border_crossing_fee && (
                              <div className="text-xs text-red-500 mt-0.5">{errors.border_crossing_fee}</div>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Subtotal Fixed
                  </label>
                  <div className="px-3 py-2 bg-gray-200 border border-0 rounded text-sm text-gray-900">
                    {(() => {
                      const fv = getFieldVisibility(lane.service_type);
                      const usAccTotal = calcSectionAccessorialsTotal(usAccessorials);
                      const mxAccTotal = calcSectionAccessorialsTotal(mxAccessorials);
                      const fp = accountFuelData.customer_fuel_program;
                      const tfr = quote?.today_fuel_rate || 0;
                      const isPercentFuel = accountFuelData.fuel_program_method === 'percentage' || accountFuelData.fuel_program_type === 'PERCENT';
                      const computeLineHaul = (miles: number, rpm: number, fuelRate: number, rateType: string, flatRate: number, isDisabled: boolean, estTotal: number) => {
                        if (isDisabled) return 0;
                        if (!fp) return rateType === 'RPM' ? miles * rpm : flatRate;
                        let effFR = fuelRate;
                        if (!isPercentFuel) effFR = accountFuelData.fuel_rate_per_mile;
                        else effFR = miles > 0 ? (estTotal * (accountFuelData.fuel_rate_per_mile / 100)) / miles : 0;
                        const diff = effFR < tfr ? tfr - effFR : 0;
                        return miles * (rpm + diff);
                      };
                      const usLH = computeLineHaul(formData.us_miles || 0, formData.us_rate_per_mile || 0, formData.us_fuel_rate || 0, formData.us_rate_type, formData.us_rate || 0, fv.usFieldsDisabled, formData.estimated_total_us_section || 0);
                      const mxLH = computeLineHaul(formData.mx_miles || 0, formData.mx_rate_per_mile || 0, formData.mx_fuel_rate || 0, formData.mx_rate_type, formData.mx_rate || 0, fv.mxFieldsDisabled || !!formData.border_crossing_only, formData.estimated_total_mx_section || 0);
                      const usFixed = fv.usFieldsDisabled ? 0 : (usLH + usAccTotal);
                      const mxFixed = (fv.mxFieldsDisabled || !!formData.border_crossing_only) ? 0 : (mxLH + mxAccTotal);
                      const borderFee = isDomestic ? 0 : (formData.border_crossing_fee || 0);
                      return formatCurrencyOrDash(usFixed + mxFixed + borderFee, currencyCode);
                    })()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Lane Total
                  </label>
                  <div className="px-3 py-2 bg-gray-200 border border-0 rounded text-sm text-gray-900 font-semibold">
                    {(() => {
                      const fv = getFieldVisibility(lane.service_type);
                      const usFuelIncluded = formData.us_fuel_included_in_line_haul;
                      const mxFuelIncluded = formData.mx_fuel_included_in_line_haul;
                      const usAccTotal = calcSectionAccessorialsTotal(usAccessorials);
                      const mxAccTotal = calcSectionAccessorialsTotal(mxAccessorials);
                      const fp = accountFuelData.customer_fuel_program;
                      const tfr = quote?.today_fuel_rate || 0;
                      const isPercentFuel2 = accountFuelData.fuel_program_method === 'percentage' || accountFuelData.fuel_program_type === 'PERCENT';
                      const calcEffFR = (fuelRate: number, miles: number, estTotal: number) => {
                        if (!fp) return fuelRate;
                        if (!isPercentFuel2) return accountFuelData.fuel_rate_per_mile;
                        return miles > 0 ? (estTotal * (accountFuelData.fuel_rate_per_mile / 100)) / miles : 0;
                      };
                      const calcDiff = (effFR: number) => fp && effFR < tfr ? tfr - effFR : 0;
                      const usEffFR = calcEffFR(formData.us_fuel_rate || 0, formData.us_miles || 0, formData.estimated_total_us_section || 0);
                      const usDiff = calcDiff(usEffFR);
                      const usAdjRPM = (formData.us_rate_per_mile || 0) + usDiff;
                      const usLH = fp && !fv.usFieldsDisabled ? (formData.us_miles || 0) * usAdjRPM : (formData.us_rate_type === 'RPM' ? (formData.us_miles || 0) * (formData.us_rate_per_mile || 0) : (formData.us_rate || 0));
                      const totalUSFuelCalc = (usFuelIncluded && !fp) ? 0 : (formData.us_miles || 0) * usEffFR;
                      const totalUSFixedCosts = fv.usFieldsDisabled ? 0 : (usLH + usAccTotal);
                      const totalUSVariableCosts = fv.usFieldsDisabled ? 0 : ((usFuelIncluded && !fp) ? 0 : totalUSFuelCalc);
                      const totalUSPortion = fv.usFieldsDisabled ? 0 : totalUSFixedCosts + totalUSVariableCosts;
                      const borderFee = formData.border_crossing_fee || 0;
                      const mxEffFR = calcEffFR(formData.mx_fuel_rate || 0, formData.mx_miles || 0, formData.estimated_total_mx_section || 0);
                      const mxDiff = calcDiff(mxEffFR);
                      const mxAdjRPM = (formData.mx_rate_per_mile || 0) + mxDiff;
                      const effectiveMxDisabled = fv.mxFieldsDisabled || !!formData.border_crossing_only;
                      const mxLH = fp && !effectiveMxDisabled ? (formData.mx_miles || 0) * mxAdjRPM : (formData.mx_rate_type === 'RPM' ? (formData.mx_miles || 0) * (formData.mx_rate_per_mile || 0) : (formData.mx_rate || 0));
                      const totalMXFuelCalc = (mxFuelIncluded && !fp) ? 0 : (formData.mx_miles || 0) * mxEffFR;
                      const totalMXFixedCosts = effectiveMxDisabled ? 0 : (mxLH + mxAccTotal);
                      const totalMXVariableCosts = effectiveMxDisabled ? 0 : ((mxFuelIncluded && !fp) ? 0 : totalMXFuelCalc);
                      const totalMXPortion = effectiveMxDisabled ? 0 : totalMXFixedCosts + totalMXVariableCosts;
                      if (isLoop) {
                        return formatCurrencyOrDash(totalMXPortion + borderFee, currencyCode);
                      }
                      if (isDomestic) {
                        return formatCurrencyOrDash(totalUSPortion, currencyCode);
                      }
                      if (isDoorToDoor && isRoundTrip && lane.is_primary_lane === false && !isD2DSplitBilling) {
                        if (formData.border_crossing_only) {
                          return formatCurrencyOrDash(totalUSPortion + borderFee, currencyCode);
                        }
                        return formatCurrencyOrDash(totalMXPortion + borderFee, currencyCode);
                      }
                      if (isD2DSplitBilling) {
                        if (fv.usFieldsDisabled && !effectiveMxDisabled) return formatCurrencyOrDash(totalMXPortion + borderFee, currencyCode);
                        if (!fv.usFieldsDisabled && effectiveMxDisabled) return formatCurrencyOrDash(totalUSPortion, currencyCode);
                      }
                      return formatCurrencyOrDash(totalUSPortion + totalMXPortion + borderFee, currencyCode);
                    })()}
                  </div>
                </div>
              </div>
              </div>
            </div>


{(() => {
              const isUSDisabled = getFieldVisibility(lane.service_type).usFieldsDisabled;
              const usFuelIncluded = formData.us_fuel_included_in_line_haul;
              const fuelActive = accountFuelData.customer_fuel_program && !isUSDisabled;
              const isMethodB = fuelActive && (accountFuelData.fuel_program_method === 'percentage' || accountFuelData.fuel_program_type === 'PERCENT');
              const isMethodA = fuelActive && !isMethodB;
              const todaysFuel = quote?.today_fuel_rate || 0;
              const unitsLabel = formData.units_code === 'Km' ? 'Km' : 'Miles';
              const usAccTotal = calcSectionAccessorialsTotal(usAccessorials);

              let effectiveUSFuelRate = formData.us_fuel_rate || 0;
              const methodBEstMissing = isMethodB && (!(formData.estimated_total_us_section) || formData.estimated_total_us_section === 0);
              if (isMethodA) {
                effectiveUSFuelRate = accountFuelData.fuel_rate_per_mile;
              } else if (isMethodB) {
                if (methodBEstMissing) {
                  effectiveUSFuelRate = 0;
                } else {
                  const estTotal = formData.estimated_total_us_section || 0;
                  const pct = accountFuelData.fuel_rate_per_mile / 100;
                  effectiveUSFuelRate = (formData.us_miles || 0) > 0 ? (estTotal * pct) / (formData.us_miles || 1) : 0;
                }
              }

              const usFuelDiff = fuelActive && !methodBEstMissing && effectiveUSFuelRate < todaysFuel ? todaysFuel - effectiveUSFuelRate : 0;
              const adjustedUSRPM = usFuelDiff > 0 ? (formData.us_rate_per_mile || 0) + usFuelDiff : (formData.us_rate_per_mile || 0);

              const usLineHaul = fuelActive
                ? (formData.us_miles || 0) * adjustedUSRPM
                : (formData.us_rate_type === 'RPM' ? (formData.us_miles || 0) * (formData.us_rate_per_mile || 0) : (formData.us_rate || 0));

              const totalUSFuel = (usFuelIncluded && !fuelActive) ? 0 : (methodBEstMissing ? 0 : (formData.us_miles || 0) * effectiveUSFuelRate);
              const totalUSFixedCosts = usLineHaul + usAccTotal;
              const totalUSVariableCosts = (usFuelIncluded && !fuelActive) ? 0 : totalUSFuel;
              const totalUSPortion = totalUSFixedCosts + totalUSVariableCosts;

              return (
                <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${isUSDisabled ? 'opacity-50' : ''}`} style={{ borderLeftWidth: '6px', borderLeftColor: '#2563eb' }}>
                  <button
                    type="button"
                    onClick={() => setCollapsedSections(s => ({ ...s, us: !s.us }))}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                    style={{ background: '#eff5ff' }}
                  >
                    <span className="text-xs font-bold tracking-wider uppercase" style={{ color: '#2563eb' }}>US Section</span>
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded text-white" style={{ background: '#2563eb', letterSpacing: '0.4px' }}>{formData.us_rate_type === 'RPM' ? 'RPM' : 'FLAT'}</span>
                    {isUSDisabled && isLoop && !isD2DSplitBilling && (
                      <span className="text-xs text-gray-500 italic">Not applicable for Loop service</span>
                    )}
                    {isUSDisabled && isD2DSplitBilling && (
                      <span className="text-xs text-gray-500 italic">Not applicable for this portion</span>
                    )}
                    {collapsedSections.us && !isUSDisabled && (
                      <span className="ml-auto text-xs text-gray-500 font-mono">Total US <span className="font-semibold text-gray-900">{formatCurrencyOrDash(totalUSPortion, currencyCode)}</span></span>
                    )}
                    <span className={`${collapsedSections.us ? '' : 'ml-auto'} text-gray-400 transition-transform ${collapsedSections.us ? '' : 'rotate-180'}`}>
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </button>
                  {!collapsedSections.us && (
                  <div className="p-5 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                    </div>
                    {!isUSDisabled && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Rate Type</label>
                        {fuelActive ? (
                          <div className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-500">RPM</div>
                        ) : (
                          <select
                            value={formData.us_rate_type}
                            onChange={(e) => handleChange('us_rate_type', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          >
                            <option value="FLT">Flat Rate</option>
                            <option value="RPM">RPM</option>
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                  {fuelActive && todaysFuel <= 0 && (
                    <div className="mb-4 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>Today's Fuel Rate is not set. Please update it in Global Variables before applying fuel program calculations.</span>
                    </div>
                  )}
                  {fuelActive ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Customer Fuel Program</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#D1D5DB' }}>
                        {`Customer Fuel Program: ${accountFuelData.fuel_program_type}`}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Customer Fuel Rate Per Mile</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#D1D5DB' }}>
                        {isMethodB
                          ? `${accountFuelData.fuel_rate_per_mile}%`
                          : `USD$ ${accountFuelData.fuel_rate_per_mile.toFixed(2)}`}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        <span className="text-red-500">*</span> US {unitsLabel}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.us_miles}
                        onChange={(e) => handleChange('us_miles', parseFloat(e.target.value) || 0)}
                        className={`w-full ${getFieldClassName(false, !!errors.us_miles)}`}
                      />
                      {errors.us_miles && (
                        <div className="text-xs text-red-500 mt-0.5">{errors.us_miles}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        <span className="text-red-500">*</span> US Rate Per {formData.units_code === 'Km' ? 'Km' : 'Mile'}
                      </label>
                      <CurrencyInput
                        value={formData.us_rate_per_mile}
                        onChange={(value) => handleChange('us_rate_per_mile', value)}
                        hasError={!!errors.us_rate_per_mile}
                        currencyCode={currencyCode}
                      />
                      {errors.us_rate_per_mile && (
                        <div className="text-xs text-red-500 mt-0.5">{errors.us_rate_per_mile}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">US Line Haul</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {formatCurrencyOrDash(usLineHaul, currencyCode)}
                      </div>
                    </div>
                    {isMethodB ? (
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          <span className="text-red-500">*</span> Estimated Total US Section
                        </label>
                        <CurrencyInput
                          value={formData.estimated_total_us_section}
                          onChange={(value) => handleChange('estimated_total_us_section', value)}
                          hasError={!!errors.estimated_total_us_section}
                          currencyCode={currencyCode}
                        />
                        {errors.estimated_total_us_section && (
                          <div className="text-xs text-red-500 mt-0.5">{errors.estimated_total_us_section}</div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">US Fuel Rate Per {formData.units_code === 'Km' ? 'Km' : 'Mile'}</label>
                        <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                          {formatCurrencyOrDash(effectiveUSFuelRate, currencyCode)}
                        </div>
                      </div>
                    )}
                    {isMethodB && (
                      <>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">US Fuel Rate Per {formData.units_code === 'Km' ? 'Km' : 'Mile'}</label>
                          <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                            {methodBEstMissing ? '—' : formatCurrencyOrDash(effectiveUSFuelRate, currencyCode)}
                          </div>
                        </div>
                        <div />
                      </>
                    )}
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total US Fuel</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {methodBEstMissing ? '—' : formatCurrencyOrDash(totalUSFuel, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total US Fixed Costs</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {formatCurrencyOrDash(totalUSFixedCosts, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Adjusted US Rate Per Mile</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#E5E7EB' }}>
                        {methodBEstMissing ? '—' : formatCurrencyOrDash(usFuelDiff > 0 ? adjustedUSRPM : 0, currencyCode)}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1 italic">Adjusted rate includes fuel variance between customer program and today's fuel rate</div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Fuel Difference</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#E5E7EB' }}>
                        {methodBEstMissing ? '—' : formatCurrencyOrDash(usFuelDiff, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total US Portion</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {methodBEstMissing ? '—' : formatCurrencyOrDash(totalUSPortion, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total US Variable Costs</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {methodBEstMissing ? '—' : formatCurrencyOrDash(totalUSVariableCosts, currencyCode)}
                      </div>
                    </div>
                  </div>
                  ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Customer Fuel Program</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#D1D5DB' }}>
                        {accountFuelData.customer_fuel_program
                          ? `Customer Fuel Program: ${accountFuelData.fuel_program_type}`
                          : 'Swift Standard Fuel Program'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Customer Fuel Rate Per Mile</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#D1D5DB' }}>
                        {accountFuelData.customer_fuel_program
                          ? (accountFuelData.fuel_program_type === 'PERCENT'
                            ? `${accountFuelData.fuel_rate_per_mile}%`
                            : `USD$ ${accountFuelData.fuel_rate_per_mile.toFixed(2)}`)
                          : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        {!isUSDisabled && <span className="text-red-500">*</span>} US {unitsLabel}
                      </label>
                      {isUSDisabled ? (
                        <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>—</div>
                      ) : (
                        <>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.us_miles}
                            onChange={(e) => handleChange('us_miles', parseFloat(e.target.value) || 0)}
                            className={`w-full ${getFieldClassName(false, !!errors.us_miles)}`}
                          />
                          {errors.us_miles && (
                            <div className="text-xs text-red-500 mt-0.5">{errors.us_miles}</div>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        {!isUSDisabled && !usFuelIncluded && <span className="text-red-500">*</span>} US Fuel Rate Per {formData.units_code === 'Km' ? 'Km' : 'Mile'}
                      </label>
                      {isUSDisabled || usFuelIncluded ? (
                        <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>—</div>
                      ) : (
                        <>
                          <CurrencyInput
                            value={formData.us_fuel_rate}
                            onChange={(value) => handleChange('us_fuel_rate', value)}
                            hasError={!!errors.us_fuel_rate}
                            currencyCode={currencyCode}
                          />
                          {errors.us_fuel_rate && (
                            <div className="text-xs text-red-500 mt-0.5">{errors.us_fuel_rate}</div>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        {!isUSDisabled && formData.us_rate_type === 'FLT' && <span className="text-red-500">*</span>} US Line Haul
                      </label>
                      {isUSDisabled ? (
                        <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>—</div>
                      ) : (() => {
                        const isReadOnly = formData.us_rate_type === 'RPM';
                        const calculatedValue = (formData.us_miles || 0) * (formData.us_rate_per_mile || 0);
                        return isReadOnly ? (
                          <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                            {formatCurrencyOrDash(calculatedValue, currencyCode)}
                          </div>
                        ) : (
                          <>
                            <CurrencyInput
                              value={formData.us_rate}
                              onChange={(value) => handleChange('us_rate', value)}
                              hasError={!!errors.us_rate}
                              currencyCode={currencyCode}
                            />
                            {errors.us_rate && (
                              <div className="text-xs text-red-500 mt-0.5">{errors.us_rate}</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        {!isUSDisabled && formData.us_rate_type === 'RPM' && <span className="text-red-500">*</span>} US Rate Per {formData.units_code === 'Km' ? 'Km' : 'Mile'}
                      </label>
                      {isUSDisabled ? (
                        <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>—</div>
                      ) : (() => {
                        const isReadOnly = formData.us_rate_type === 'FLT';
                        const calculatedValue = formData.us_miles ? (formData.us_rate / formData.us_miles) : 0;
                        return isReadOnly ? (
                          <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                            {formatCurrencyOrDash(calculatedValue, currencyCode)}
                          </div>
                        ) : (
                          <>
                            <CurrencyInput
                              value={formData.us_rate_per_mile}
                              onChange={(value) => handleChange('us_rate_per_mile', value)}
                              hasError={!!errors.us_rate_per_mile}
                              currencyCode={currencyCode}
                            />
                            {errors.us_rate_per_mile && (
                              <div className="text-xs text-red-500 mt-0.5">{errors.us_rate_per_mile}</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total US Fixed Costs</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {isUSDisabled ? formatCurrencyOrDash(0, currencyCode) : formatCurrencyOrDash(totalUSFixedCosts, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total US Fuel</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {isUSDisabled || usFuelIncluded ? formatCurrencyOrDash(0, currencyCode) : formatCurrencyOrDash(totalUSFuel, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total US Variable Costs</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {isUSDisabled || usFuelIncluded ? formatCurrencyOrDash(0, currencyCode) : formatCurrencyOrDash(totalUSVariableCosts, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total US Portion</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {isUSDisabled ? '—' : formatCurrencyOrDash(totalUSPortion, currencyCode)}
                      </div>
                    </div>
                    <div />
                    <div className="flex items-center justify-end">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.us_fuel_included_in_line_haul}
                          onChange={(e) => handleChange('us_fuel_included_in_line_haul', e.target.checked)}
                          disabled={isUSDisabled}
                          className="rounded border-gray-300"
                        />
                        Fuel included in Line Haul rate
                      </label>
                    </div>
                  </div>
                  )}
                  <LaneSectionAccessorials
                    section="US"
                    disabled={isUSDisabled}
                    selected={usAccessorials}
                    onChange={setUsAccessorialsDirty}
                    currencyCode={currencyCode}
                  />
                  </div>
                  )}
                </div>
              );
            })()}

{(() => {
              const isMXDisabled = formData.border_crossing_only || getFieldVisibility(lane.service_type).mxFieldsDisabled;
              const mxFuelIncluded = formData.mx_fuel_included_in_line_haul;
              const fuelActive = accountFuelData.customer_fuel_program && !isMXDisabled;
              const isMethodB = fuelActive && (accountFuelData.fuel_program_method === 'percentage' || accountFuelData.fuel_program_type === 'PERCENT');
              const isMethodA = fuelActive && !isMethodB;
              const todaysFuel = quote?.today_fuel_rate || 0;
              const unitsLabel = formData.units_code === 'Km' ? 'Km' : 'Miles';
              const mxAccTotal = calcSectionAccessorialsTotal(mxAccessorials);

              let effectiveMXFuelRate = formData.mx_fuel_rate || 0;
              const methodBMxEstMissing = isMethodB && (!(formData.estimated_total_mx_section) || formData.estimated_total_mx_section === 0);
              if (isMethodA) {
                effectiveMXFuelRate = accountFuelData.fuel_rate_per_mile;
              } else if (isMethodB) {
                if (methodBMxEstMissing) {
                  effectiveMXFuelRate = 0;
                } else {
                  const estTotal = formData.estimated_total_mx_section || 0;
                  const pct = accountFuelData.fuel_rate_per_mile / 100;
                  effectiveMXFuelRate = (formData.mx_miles || 0) > 0 ? (estTotal * pct) / (formData.mx_miles || 1) : 0;
                }
              }

              const mxFuelDiff = fuelActive && !methodBMxEstMissing && effectiveMXFuelRate < todaysFuel ? todaysFuel - effectiveMXFuelRate : 0;
              const adjustedMXRPM = mxFuelDiff > 0 ? (formData.mx_rate_per_mile || 0) + mxFuelDiff : (formData.mx_rate_per_mile || 0);

              const mxLineHaul = fuelActive
                ? (formData.mx_miles || 0) * adjustedMXRPM
                : (formData.mx_rate_type === 'RPM' ? (formData.mx_miles || 0) * (formData.mx_rate_per_mile || 0) : (formData.mx_rate || 0));

              const totalMXFuel = (mxFuelIncluded && !fuelActive) ? 0 : (methodBMxEstMissing ? 0 : (formData.mx_miles || 0) * effectiveMXFuelRate);
              const totalMXFixedCosts = mxLineHaul + mxAccTotal;
              const totalMXVariableCosts = (mxFuelIncluded && !fuelActive) ? 0 : totalMXFuel;
              const totalMXPortion = totalMXFixedCosts + totalMXVariableCosts;

              return (
                <div className={`bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden ${isMXDisabled ? 'opacity-50' : ''}`} style={{ borderLeftWidth: '6px', borderLeftColor: '#15803d' }}>
                  <button
                    type="button"
                    onClick={() => setCollapsedSections(s => ({ ...s, mx: !s.mx }))}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                    style={{ background: '#effaf1' }}
                  >
                    <span className="text-xs font-bold tracking-wider uppercase" style={{ color: '#15803d' }}>MX Section</span>
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded text-white" style={{ background: '#15803d', letterSpacing: '0.4px' }}>{formData.mx_rate_type === 'RPM' ? 'RPM' : 'FLAT'}</span>
                    {isMXDisabled && isDomestic && !isD2DSplitBilling && (
                      <span className="text-xs text-gray-500 italic">Not applicable for Domestic service</span>
                    )}
                    {isMXDisabled && isD2DSplitBilling && (
                      <span className="text-xs text-gray-500 italic">Not applicable for this portion</span>
                    )}
                    {collapsedSections.mx && !isMXDisabled && (
                      <span className="ml-auto text-xs text-gray-500 font-mono">Total MX <span className="font-semibold text-gray-900">{formatCurrencyOrDash(totalMXPortion, currencyCode)}</span></span>
                    )}
                    <span className={`${collapsedSections.mx ? '' : 'ml-auto'} text-gray-400 transition-transform ${collapsedSections.mx ? '' : 'rotate-180'}`}>
                      <ChevronDown className="w-4 h-4" />
                    </span>
                  </button>
                  {!collapsedSections.mx && (
                  <div className="p-5 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                    </div>
                    {!isMXDisabled && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Rate Type</label>
                        {fuelActive ? (
                          <div className="px-2 py-1 rounded text-xs bg-gray-200 text-gray-500">RPM</div>
                        ) : (
                          <select
                            value={formData.mx_rate_type}
                            onChange={(e) => handleChange('mx_rate_type', e.target.value)}
                            className="px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          >
                            <option value="FLT">Flat Rate</option>
                            <option value="RPM">RPM</option>
                          </select>
                        )}
                      </div>
                    )}
                  </div>
                  {fuelActive && todaysFuel <= 0 && (
                    <div className="mb-4 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <span>Today's Fuel Rate is not set. Please update it in Global Variables before applying fuel program calculations.</span>
                    </div>
                  )}
                  {fuelActive ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Customer Fuel Program</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#D1D5DB' }}>
                        {`Customer Fuel Program: ${accountFuelData.fuel_program_type}`}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Customer Fuel Rate Per Mile</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#D1D5DB' }}>
                        {isMethodB
                          ? `${accountFuelData.fuel_rate_per_mile}%`
                          : `USD$ ${accountFuelData.fuel_rate_per_mile.toFixed(2)}`}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        <span className="text-red-500">*</span> MX {unitsLabel}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.mx_miles}
                        onChange={(e) => handleChange('mx_miles', parseFloat(e.target.value) || 0)}
                        className={`w-full ${getFieldClassName(false, !!errors.mx_miles)}`}
                      />
                      {errors.mx_miles && (
                        <div className="text-xs text-red-500 mt-0.5">{errors.mx_miles}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        <span className="text-red-500">*</span> MX Rate Per {formData.units_code === 'Km' ? 'Km' : 'Mile'}
                      </label>
                      <CurrencyInput
                        value={formData.mx_rate_per_mile}
                        onChange={(value) => handleChange('mx_rate_per_mile', value)}
                        hasError={!!errors.mx_rate_per_mile}
                        currencyCode={currencyCode}
                      />
                      {errors.mx_rate_per_mile && (
                        <div className="text-xs text-red-500 mt-0.5">{errors.mx_rate_per_mile}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">MX Line Haul</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {formatCurrencyOrDash(mxLineHaul, currencyCode)}
                      </div>
                    </div>
                    {isMethodB ? (
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">
                          <span className="text-red-500">*</span> Estimated Total MX Section
                        </label>
                        <CurrencyInput
                          value={formData.estimated_total_mx_section}
                          onChange={(value) => handleChange('estimated_total_mx_section', value)}
                          hasError={!!errors.estimated_total_mx_section}
                          currencyCode={currencyCode}
                        />
                        {errors.estimated_total_mx_section && (
                          <div className="text-xs text-red-500 mt-0.5">{errors.estimated_total_mx_section}</div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">MX Fuel Rate Per {formData.units_code === 'Km' ? 'Km' : 'Mile'}</label>
                        <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                          {formatCurrencyOrDash(effectiveMXFuelRate, currencyCode)}
                        </div>
                      </div>
                    )}
                    {isMethodB && (
                      <>
                        <div>
                          <label className="block text-sm text-gray-700 mb-1">MX Fuel Rate Per {formData.units_code === 'Km' ? 'Km' : 'Mile'}</label>
                          <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                            {methodBMxEstMissing ? '—' : formatCurrencyOrDash(effectiveMXFuelRate, currencyCode)}
                          </div>
                        </div>
                        <div />
                      </>
                    )}
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total MX Fuel</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {methodBMxEstMissing ? '—' : formatCurrencyOrDash(totalMXFuel, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total MX Fixed Costs</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {formatCurrencyOrDash(totalMXFixedCosts, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Adjusted MX Rate Per Mile</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#E5E7EB' }}>
                        {methodBMxEstMissing ? '—' : formatCurrencyOrDash(mxFuelDiff > 0 ? adjustedMXRPM : 0, currencyCode)}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1 italic">Adjusted rate includes fuel variance between customer program and today's fuel rate</div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Fuel Difference</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#E5E7EB' }}>
                        {methodBMxEstMissing ? '—' : formatCurrencyOrDash(mxFuelDiff, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total MX Portion</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {methodBMxEstMissing ? '—' : formatCurrencyOrDash(totalMXPortion, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total MX Variable Costs</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {methodBMxEstMissing ? '—' : formatCurrencyOrDash(totalMXVariableCosts, currencyCode)}
                      </div>
                    </div>
                  </div>
                  ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Customer Fuel Program</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#D1D5DB' }}>
                        {accountFuelData.customer_fuel_program
                          ? `Customer Fuel Program: ${accountFuelData.fuel_program_type}`
                          : 'Swift Standard Fuel Program'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Customer Fuel Rate Per Mile</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#D1D5DB' }}>
                        {accountFuelData.customer_fuel_program
                          ? (accountFuelData.fuel_program_type === 'PERCENT'
                            ? `${accountFuelData.fuel_rate_per_mile}%`
                            : `USD$ ${accountFuelData.fuel_rate_per_mile.toFixed(2)}`)
                          : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        {!isMXDisabled && <span className="text-red-500">*</span>} MX {unitsLabel}
                      </label>
                      {isMXDisabled ? (
                        <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>—</div>
                      ) : (
                        <>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.mx_miles}
                            onChange={(e) => handleChange('mx_miles', parseFloat(e.target.value) || 0)}
                            className={`w-full ${getFieldClassName(false, !!errors.mx_miles)}`}
                          />
                          {errors.mx_miles && (
                            <div className="text-xs text-red-500 mt-0.5">{errors.mx_miles}</div>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        {!isMXDisabled && !mxFuelIncluded && <span className="text-red-500">*</span>} MX Fuel Rate Per {formData.units_code === 'Km' ? 'Km' : 'Mile'}
                      </label>
                      {isMXDisabled || mxFuelIncluded ? (
                        <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>—</div>
                      ) : (
                        <>
                          <CurrencyInput
                            value={formData.mx_fuel_rate}
                            onChange={(value) => handleChange('mx_fuel_rate', value)}
                            hasError={!!errors.mx_fuel_rate}
                            currencyCode={currencyCode}
                          />
                          {errors.mx_fuel_rate && (
                            <div className="text-xs text-red-500 mt-0.5">{errors.mx_fuel_rate}</div>
                          )}
                        </>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        {!isMXDisabled && formData.mx_rate_type === 'FLT' && <span className="text-red-500">*</span>} MX Line Haul
                      </label>
                      {isMXDisabled ? (
                        <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>—</div>
                      ) : (() => {
                        const isReadOnly = formData.mx_rate_type === 'RPM';
                        const calculatedValue = (formData.mx_miles || 0) * (formData.mx_rate_per_mile || 0);
                        return isReadOnly ? (
                          <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                            {formatCurrencyOrDash(calculatedValue, currencyCode)}
                          </div>
                        ) : (
                          <>
                            <CurrencyInput
                              value={formData.mx_rate}
                              onChange={(value) => handleChange('mx_rate', value)}
                              hasError={!!errors.mx_rate}
                              currencyCode={currencyCode}
                            />
                            {errors.mx_rate && (
                              <div className="text-xs text-red-500 mt-0.5">{errors.mx_rate}</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">
                        {!isMXDisabled && formData.mx_rate_type === 'RPM' && <span className="text-red-500">*</span>} MX Rate Per {formData.units_code === 'Km' ? 'Km' : 'Mile'}
                      </label>
                      {isMXDisabled ? (
                        <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>—</div>
                      ) : (() => {
                        const isReadOnly = formData.mx_rate_type === 'FLT';
                        const calculatedValue = formData.mx_miles ? (formData.mx_rate / formData.mx_miles) : 0;
                        return isReadOnly ? (
                          <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                            {formatCurrencyOrDash(calculatedValue, currencyCode)}
                          </div>
                        ) : (
                          <>
                            <CurrencyInput
                              value={formData.mx_rate_per_mile}
                              onChange={(value) => handleChange('mx_rate_per_mile', value)}
                              hasError={!!errors.mx_rate_per_mile}
                              currencyCode={currencyCode}
                            />
                            {errors.mx_rate_per_mile && (
                              <div className="text-xs text-red-500 mt-0.5">{errors.mx_rate_per_mile}</div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total MX Fixed Costs</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {isMXDisabled ? formatCurrencyOrDash(0, currencyCode) : formatCurrencyOrDash(totalMXFixedCosts, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total MX Fuel</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {isMXDisabled || mxFuelIncluded ? formatCurrencyOrDash(0, currencyCode) : formatCurrencyOrDash(totalMXFuel, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total MX Variable Costs</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {isMXDisabled || mxFuelIncluded ? formatCurrencyOrDash(0, currencyCode) : formatCurrencyOrDash(totalMXVariableCosts, currencyCode)}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 mb-1">Total MX Portion</label>
                      <div className="w-full px-3 py-2 text-sm rounded" style={{ backgroundColor: '#F3F4F6' }}>
                        {isMXDisabled ? '—' : formatCurrencyOrDash(totalMXPortion, currencyCode)}
                      </div>
                    </div>
                    <div />
                    <div className="flex items-center justify-end">
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.mx_fuel_included_in_line_haul}
                          onChange={(e) => handleChange('mx_fuel_included_in_line_haul', e.target.checked)}
                          disabled={isMXDisabled}
                          className="rounded border-gray-300"
                        />
                        Fuel included in Line Haul rate
                      </label>
                    </div>
                  </div>
                  )}
                  <LaneSectionAccessorials
                    section="MX"
                    disabled={isMXDisabled}
                    selected={mxAccessorials}
                    onChange={setMxAccessorialsDirty}
                    currencyCode={currencyCode}
                  />
                  </div>
                  )}
                </div>
              );
            })()}

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden" style={{ borderLeftWidth: '6px', borderLeftColor: '#94a3b8' }}>
              <button
                type="button"
                onClick={() => setCollapsedSections(s => ({ ...s, additional: !s.additional }))}
                className="w-full flex items-center gap-3 px-5 py-3 text-left transition-colors"
                style={{ background: '#f8fafc' }}
              >
                <span className="text-xs font-bold tracking-wider uppercase text-gray-500">Additional Information</span>
                {collapsedSections.additional && (
                  <span className="ml-auto text-xs text-gray-500 font-mono">{formData.type_of_service || 'optional'}</span>
                )}
                <span className={`${collapsedSections.additional ? '' : 'ml-auto'} text-gray-400 transition-transform ${collapsedSections.additional ? '' : 'rotate-180'}`}>
                  <ChevronDown className="w-4 h-4" />
                </span>
              </button>
              {!collapsedSections.additional && (
              <div className="p-5 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Lane Type
                  </label>
                  <select
                    value={formData.lane_type}
                    onChange={(e) => handleChange('lane_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    {LANE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Load Volume
                  </label>
                  <input
                    type="text"
                    value={formData.load_volume}
                    onChange={(e) => handleChange('load_volume', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Load Frequency
                  </label>
                  <select
                    value={formData.load_frequency}
                    onChange={(e) => handleChange('load_frequency', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    {LOAD_FREQUENCIES.map(freq => (
                      <option key={freq} value={freq}>{freq}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Commitment Type
                  </label>
                  <select
                    value={formData.commitment_type}
                    onChange={(e) => handleChange('commitment_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    {COMMITMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Target
                  </label>
                  <textarea
                    value={formData.target}
                    onChange={(e) => handleChange('target', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Product
                  </label>
                  <textarea
                    value={formData.product}
                    onChange={(e) => handleChange('product', e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Type of Service
                  </label>
                  <select
                    value={formData.type_of_service}
                    onChange={(e) => handleChange('type_of_service', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    {EQUIPMENT_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleChange('priority', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select...</option>
                    {PRIORITIES.map(priority => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>
                {getEquipmentSpecificFields()}
              </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Comments
              </label>
              <textarea
                value={formData.comments}
                onChange={(e) => handleChange('comments', e.target.value)}
                rows={3}
                placeholder="Additional Comments"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
              </div>
              )}
            </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 px-6 py-3.5 bg-white border-t border-gray-200 flex items-center gap-3 flex-wrap">
          <button
            onClick={() => onBenchmark?.(lane)}
            className="flex items-center gap-2 h-9 px-4 text-[13px] font-semibold rounded-lg border transition-colors"
            style={{ color: '#0a5f5e', borderColor: '#cbd5e1', background: '#fff' }}
          >
            <BarChart2 className="w-4 h-4" />
            Benchmark
          </button>
          <button
            onClick={() => handleNavigateWithCheck('close')}
            className="h-9 px-4 text-[13px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {locked ? 'Close' : 'Cancel'}
          </button>
          <div className="flex-1" />
          <button
            onClick={() => handleNavigateWithCheck('previous')}
            disabled={!hasPreviousLane}
            title={!hasPreviousLane ? 'This is the first lane' : ''}
            className={`h-9 px-4 text-[13px] font-semibold rounded-lg border transition-colors ${
              hasPreviousLane
                ? 'text-gray-600 bg-gray-50 border-gray-300 hover:bg-gray-100'
                : 'text-gray-300 bg-gray-50 border-gray-200 cursor-not-allowed'
            }`}
          >
            Previous Lane
          </button>
          <button
            onClick={() => handleNavigateWithCheck('next')}
            disabled={!hasNextLane}
            title={!hasNextLane ? 'This is the last lane' : ''}
            className={`h-9 px-4 text-[13px] font-semibold rounded-lg border transition-colors ${
              hasNextLane
                ? 'text-gray-600 bg-gray-50 border-gray-300 hover:bg-gray-100'
                : 'text-gray-300 bg-gray-50 border-gray-200 cursor-not-allowed'
            }`}
          >
            Next Lane
          </button>
          {!locked && (
            <button
              onClick={() => handleSubmit()}
              className="h-9 px-5 text-[13px] font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 border border-blue-600 transition-colors"
            >
              Save
            </button>
          )}
          {!locked && (
            <button
              onClick={async () => {
                if (hasNextLane) {
                  const saved = await handleSubmit(true);
                  if (saved) {
                    onNextLane?.();
                  }
                } else {
                  handleSubmit();
                }
              }}
              className="h-9 px-5 text-[13px] font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 border border-green-600 transition-colors"
            >
              Save and Next Lane
            </button>
          )}
        </div>

        {unsavedDialog && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Unsaved Changes</h3>
              <p className="text-sm text-gray-600 mb-6">
                You have unsaved changes on this lane. If you navigate away without saving, your changes will be lost. What would you like to do?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleUnsavedSaveAndContinue}
                  className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Save and Continue
                </button>
                <button
                  onClick={handleUnsavedDiscard}
                  className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Discard and Continue
                </button>
                <button
                  onClick={() => setUnsavedDialog(null)}
                  className="w-full px-4 py-2.5 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Stay Here
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
