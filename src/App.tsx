import { useEffect, useState } from 'react';
import { QuoteListView } from './components/QuoteListView';
import { QuoteHeader } from './components/QuoteHeader';
import { QuoteHistory } from './components/QuoteHistory';
import { QuoteTabs } from './components/QuoteTabs';
import { StageProgressBar } from './components/StageProgressBar';
import { LaneDetailsPanel } from './components/LaneDetailsPanel';
import { ConfirmModal } from './components/ConfirmModal';
import { NewQuoteModal } from './components/NewQuoteModal';
import { Toast } from './components/Toast';
import { AdministrationView } from './components/AdministrationView';
import { MassUpdateView } from './components/MassUpdateView';
import { MassUpdateLogView } from './components/MassUpdateLogView';
import { CompletedValidationModal } from './components/CompletedValidationModal';
import { BenchmarkDashboard } from './components/benchmark/BenchmarkDashboard';
import { SendToCustomerModal } from './components/SendToCustomerModal';
import { CustomerReviewBanner } from './components/CustomerReviewBanner';
import { ViewResponseModal } from './components/ViewResponseModal';
import { ViewSignatureModal } from './components/ViewSignatureModal';
import { Sidebar, ViewMode } from './components/Sidebar';
import { DashboardView } from './components/home/DashboardView';
import { CustomersView } from './components/customers/CustomersView';
import { ImportView } from './components/import/ImportView';
import { supabase, Quote, QuoteHistory as QuoteHistoryType, QuoteLane } from './lib/supabase';
import { CurrencyCode, convertLaneValues, buildQuoteName, isQuoteLocked } from './lib/constants';
import { validateCompletedStage, CompletedStageValidationResult } from './lib/completedStageValidation';
import { getPortalUrl, getPreviewUrl } from './lib/customerPortalHelpers';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [history, setHistory] = useState<QuoteHistoryType[]>([]);
  const [lanes, setLanes] = useState<QuoteLane[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState<QuoteLane | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeleteQuoteConfirm, setShowDeleteQuoteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [showNewQuoteForm, setShowNewQuoteForm] = useState(false);
  const [completedValidationResult, setCompletedValidationResult] = useState<CompletedStageValidationResult | null>(null);
  const [benchmarkLane, setBenchmarkLane] = useState<QuoteLane | null>(null);
  const [showSendToCustomer, setShowSendToCustomer] = useState(false);
  const [showViewResponse, setShowViewResponse] = useState(false);
  const [showViewSignature, setShowViewSignature] = useState(false);

  useEffect(() => {
    if (viewMode === 'builder' && currentQuoteId) {
      loadQuote(currentQuoteId);
    }
  }, [viewMode, currentQuoteId]);

  async function loadQuote(quoteId: string) {
    setLoading(true);
    try {
      const { data: quoteData, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .maybeSingle();

      if (quoteError) throw quoteError;
      if (!quoteData) {
        setToastMessage('Quote not found');
        setViewMode('list');
        return;
      }

      if (
        quoteData.customer_review_status === 'pending' &&
        quoteData.review_token &&
        quoteData.token_expires_at &&
        new Date(quoteData.token_expires_at) < new Date()
      ) {
        quoteData.customer_review_status = 'expired';
        setQuote({ ...quoteData, customer_review_status: 'expired' });
        supabase.from('quotes').update({ customer_review_status: 'expired' }).eq('id', quoteId).then(() => {});
      } else {
        setQuote(quoteData);
      }

      const { data: historyData } = await supabase
        .from('quote_history')
        .select('*')
        .eq('quote_id', quoteId)
        .order('date', { ascending: true });

      const { data: lanesData } = await supabase
        .from('quote_lanes')
        .select('*')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true });

      if (historyData) setHistory(historyData);
      if (lanesData) setLanes(lanesData);
    } catch (error) {
      console.error('Error loading quote:', error);
      setToastMessage('Error loading quote');
    } finally {
      setLoading(false);
    }
  }

  const handleCreateNewQuote = async (quoteData: {
    partner_account: string;
    bill_to_customer: string;
    shipper: string;
    bco_partner: string;
  }) => {
    setLoading(true);
    try {
      const { data: existingQuotes, error: fetchError } = await supabase
        .from('quotes')
        .select('quote_number')
        .order('quote_number', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('Error fetching quotes:', fetchError);
        setToastMessage(`Error fetching quotes: ${fetchError.message}`);
        setToastType('error');
        return;
      }

      let nextNumber = 1;
      if (existingQuotes && existingQuotes.length > 0) {
        const lastQuoteNumber = existingQuotes[0].quote_number;
        const lastNumber = parseInt(lastQuoteNumber.replace('TMQ-', ''));
        nextNumber = lastNumber + 1;
      }

      const quoteNumber = `TMQ-${String(nextNumber).padStart(8, '0')}`;

      const { data: sequenceData, error: sequenceError } = await supabase
        .from('quotes')
        .select('quote_name_sequence')
        .order('quote_name_sequence', { ascending: false })
        .limit(1);

      if (sequenceError) {
        console.error('Error fetching sequences:', sequenceError);
        setToastMessage(`Error fetching sequences: ${sequenceError.message}`);
        setToastType('error');
        return;
      }

      let nextSequence = 1;
      if (sequenceData && sequenceData.length > 0) {
        nextSequence = (sequenceData[0].quote_name_sequence || 0) + 1;
      }

      const [globalVarsResult, accountCodeResult] = await Promise.all([
        supabase
          .from('global_variables')
          .select('mxn_exchange_rate, cad_exchange_rate, fuel_rate_usd, us_fuel_difference, rate_per_mile')
          .limit(1)
          .maybeSingle(),
        supabase
          .from('accounts')
          .select('account_code')
          .eq('account_name', quoteData.partner_account)
          .limit(1)
          .maybeSingle(),
      ]);

      const globalVarsData = globalVarsResult.data;
      const defaultExchangeRate = globalVarsData?.mxn_exchange_rate || 0;
      const defaultCadRate = globalVarsData?.cad_exchange_rate || 0;
      const defaultFuelRate = globalVarsData?.fuel_rate_usd || 0;
      const defaultUsFuelDiff = globalVarsData?.us_fuel_difference || 0;
      const defaultRatePerMile = globalVarsData?.rate_per_mile || 0;

      const accountCode = accountCodeResult.data?.account_code || 'XXXXXX';
      const defaultOwner = 'Susana Guajardo';
      const defaultMxRep = 'Alberto Paz';
      const now = new Date().toISOString();
      const generatedQuoteName = buildQuoteName({
        mxSalesRep: defaultMxRep,
        ownerName: defaultOwner,
        accountCode,
        createdAt: now,
        sequence: nextSequence,
        version: 1,
      });

      const { data: newQuote, error } = await supabase
        .from('quotes')
        .insert({
          quote_number: quoteNumber,
          quote_name_sequence: nextSequence,
          quote_name_version: 1,
          owner_name: defaultOwner,
          status: 'New',
          stage: 'New',
          rate_type: 'Flat Rate',
          total_amount: 0,
          us_portion: 0,
          mx_rate: 0,
          border_crossing_fee: 0,
          units: 'Miles',
          type_of_service: 'Dry Van',
          partner_account: quoteData.partner_account,
          us_sales_rep: 'Connie Hills',
          mx_sales_rep: defaultMxRep,
          currency: 'USD',
          bill_to_customer: quoteData.bill_to_customer,
          shipper: quoteData.shipper,
          bco_partner: quoteData.bco_partner,
          opportunity: '',
          exchange_rate: defaultExchangeRate,
          cad_exchange_rate: defaultCadRate,
          today_fuel_rate: defaultFuelRate,
          rate_per_mile: defaultRatePerMile,
          us_fuel_difference: defaultUsFuelDiff,
          generated_quote_name: generatedQuoteName,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating quote:', error);
        setToastMessage(`Error creating quote: ${error.message}`);
        setToastType('error');
        return;
      }

      if (!newQuote) {
        setToastMessage('Error creating quote: No data returned');
        setToastType('error');
        return;
      }

      const { error: historyError } = await supabase.from('quote_history').insert({
        quote_id: newQuote.id,
        date: new Date().toISOString(),
        user_name: newQuote.owner_name,
        action: 'Quote Created',
        notes: 'New quote created',
      });

      if (historyError) {
        console.error('Error creating quote history:', historyError);
      }

      setQuote(newQuote as Quote);
      setCurrentQuoteId(newQuote.id);
      setViewMode('builder');
      setShowNewQuoteForm(false);
      setToastMessage('New quote created successfully');
      setToastType('success');
    } catch (error) {
      console.error('Error creating quote:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setToastMessage(`Error creating quote: ${errorMessage}`);
      setToastType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuote = (quoteId: string) => {
    setCurrentQuoteId(quoteId);
    setViewMode('builder');
  };

  const handleNavigate = (target: ViewMode) => {
    if (target === 'list' || target === 'home') {
      setCurrentQuoteId(null);
      setQuote(null);
      setHistory([]);
      setLanes([]);
    }
    setViewMode(target);
  };

  const handleBackToList = () => {
    handleNavigate('list');
  };

  const handleCloneQuote = async () => {
    if (!quote) return;

    try {
      const { data: existingQuotes } = await supabase
        .from('quotes')
        .select('quote_number')
        .order('quote_number', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (existingQuotes && existingQuotes.length > 0) {
        const lastQuoteNumber = existingQuotes[0].quote_number;
        const lastNumber = parseInt(lastQuoteNumber.replace('TMQ-', ''));
        nextNumber = lastNumber + 1;
      }

      const quoteNumber = `TMQ-${String(nextNumber).padStart(8, '0')}`;

      const nextVersion = (quote.quote_name_version || 1) + 1;

      const { data: clonedQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          quote_number: quoteNumber,
          quote_name_sequence: quote.quote_name_sequence,
          quote_name_version: nextVersion,
          owner_name: quote.owner_name,
          status: 'New',
          stage: 'New',
          rate_type: quote.rate_type || 'Flat Rate',
          total_amount: quote.total_amount,
          us_portion: quote.us_portion,
          mx_rate: quote.mx_rate,
          border_crossing_fee: quote.border_crossing_fee,
          units: quote.units,
          type_of_service: quote.type_of_service,
          partner_account: quote.partner_account,
          us_sales_rep: quote.us_sales_rep,
          mx_sales_rep: quote.mx_sales_rep,
          currency: quote.currency,
          bill_to_customer: quote.bill_to_customer,
          shipper: quote.shipper,
          bco_partner: quote.bco_partner,
          opportunity: quote.opportunity,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      if (lanes.length > 0) {
        const { data: insertedLanes, error: lanesError } = await supabase
          .from('quote_lanes')
          .insert(
            lanes.map((lane) => ({
              quote_id: clonedQuote.id,
              origin_city: lane.origin_city,
              destination_city: lane.destination_city,
              border_crossing: lane.border_crossing,
              border_crossing_fee: lane.border_crossing_fee,
              border_crossing_rate: lane.border_crossing_rate,
              us_rate: lane.us_rate,
              mx_rate: lane.mx_rate,
              equipment_type: lane.equipment_type,
              sort_order: lane.sort_order,
              effective_from_date: lane.effective_from_date,
              effective_to_date: lane.effective_to_date,
              units_type: lane.units_type,
              currency_type: lane.currency_type,
              trip_type: lane.trip_type,
              toll_rate: lane.toll_rate,
              us_miles: lane.us_miles,
              mx_miles: lane.mx_miles,
              us_rate_per_mile: lane.us_rate_per_mile,
              mx_rate_per_mile: lane.mx_rate_per_mile,
              us_fuel_rate: lane.us_fuel_rate,
              mx_fuel_rate: lane.mx_fuel_rate,
              additional_accessories: lane.additional_accessories,
              comments: lane.comments,
              commitment_type: lane.commitment_type,
              frequency: lane.frequency,
              fuel_rate_type: lane.fuel_rate_type,
              load_frequency: lane.load_frequency,
              load_volume: lane.load_volume,
              requested_discount_percent: lane.requested_discount_percent,
              requested_price: lane.requested_price,
              un_number: lane.un_number,
              volume: lane.volume,
              msds: lane.msds,
              weight: lane.weight,
              dimensions: lane.dimensions,
              invoice_value: lane.invoice_value,
              temperature: lane.temperature,
              temperature_unit: lane.temperature_unit,
              packaging: lane.packaging,
              rate_type: lane.rate_type,
              lane_type: lane.lane_type,
              priority: lane.priority,
              type_of_service: lane.type_of_service,
              target: lane.target,
              product: lane.product,
              tarps: lane.tarps,
              vin_dimensions: lane.vin_dimensions,
              number_of_vins: lane.number_of_vins,
              live_load_or_drop: lane.live_load_or_drop,
              display_mode: lane.display_mode,
              is_primary_lane: lane.is_primary_lane,
            }))
          )
          .select();

        if (lanesError) throw lanesError;

        const oldIdToNewIdMap: Record<string, string> = {};
        lanes.forEach((originalLane, index) => {
          if (insertedLanes && insertedLanes[index]) {
            oldIdToNewIdMap[originalLane.id] = insertedLanes[index].id;
          }
        });

        const pairedLaneUpdates: { id: string; paired_lane_id: string }[] = [];
        lanes.forEach((originalLane, index) => {
          if (originalLane.paired_lane_id && insertedLanes && insertedLanes[index]) {
            const newPairedLaneId = oldIdToNewIdMap[originalLane.paired_lane_id];
            if (newPairedLaneId) {
              pairedLaneUpdates.push({
                id: insertedLanes[index].id,
                paired_lane_id: newPairedLaneId,
              });
            }
          }
        });

        for (const update of pairedLaneUpdates) {
          await supabase
            .from('quote_lanes')
            .update({ paired_lane_id: update.paired_lane_id })
            .eq('id', update.id);
        }
      }

      await supabase.from('quote_history').insert({
        quote_id: clonedQuote.id,
        date: new Date().toISOString(),
        user_name: clonedQuote.owner_name,
        action: 'Quote Cloned',
        notes: `Cloned from ${quote.quote_number}`,
      });

      setCurrentQuoteId(clonedQuote.id);
      setViewMode('builder');
      setToastMessage(`Quote cloned successfully as ${quoteNumber}`);
    } catch (error) {
      console.error('Error cloning quote:', error);
      setToastMessage('Error cloning quote');
    }
  };

  const handleDeleteQuote = async () => {
    if (!quote) return;

    try {
      await supabase.from('quote_lanes').delete().eq('quote_id', quote.id);
      await supabase.from('quote_history').delete().eq('quote_id', quote.id);
      await supabase.from('quotes').delete().eq('id', quote.id);

      setShowDeleteQuoteConfirm(false);
      setToastMessage('Quote deleted successfully');
      handleBackToList();
    } catch (error) {
      console.error('Error deleting quote:', error);
      setToastMessage('Error deleting quote');
    }
  };

  const handleDeleteQuoteFromList = async (quoteId: string) => {
    try {
      await supabase.from('quote_lanes').delete().eq('quote_id', quoteId);
      await supabase.from('quote_history').delete().eq('quote_id', quoteId);
      await supabase.from('quotes').delete().eq('id', quoteId);
    } catch (error) {
      console.error('Error deleting quote:', error);
    }
  };

  const handleCloneQuoteFromList = async (sourceQuote: Quote) => {
    try {
      const { data: existingQuotes } = await supabase
        .from('quotes')
        .select('quote_number')
        .order('quote_number', { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (existingQuotes && existingQuotes.length > 0) {
        const lastNumber = parseInt(existingQuotes[0].quote_number.replace('TMQ-', ''));
        nextNumber = lastNumber + 1;
      }
      const quoteNumber = `TMQ-${String(nextNumber).padStart(8, '0')}`;
      const nextVersion = (sourceQuote.quote_name_version || 1) + 1;

      const { data: clonedQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          quote_number: quoteNumber,
          quote_name_sequence: sourceQuote.quote_name_sequence,
          quote_name_version: nextVersion,
          owner_name: sourceQuote.owner_name,
          status: 'New',
          stage: 'New',
          rate_type: sourceQuote.rate_type || 'Flat Rate',
          total_amount: sourceQuote.total_amount,
          us_portion: sourceQuote.us_portion,
          mx_rate: sourceQuote.mx_rate,
          border_crossing_fee: sourceQuote.border_crossing_fee,
          units: sourceQuote.units,
          type_of_service: sourceQuote.type_of_service,
          partner_account: sourceQuote.partner_account,
          us_sales_rep: sourceQuote.us_sales_rep,
          mx_sales_rep: sourceQuote.mx_sales_rep,
          currency: sourceQuote.currency,
          bill_to_customer: sourceQuote.bill_to_customer,
          shipper: sourceQuote.shipper,
          bco_partner: sourceQuote.bco_partner,
          opportunity: sourceQuote.opportunity,
        })
        .select()
        .single();

      if (quoteError) throw quoteError;

      const { data: sourceLanes } = await supabase
        .from('quote_lanes')
        .select('*')
        .eq('quote_id', sourceQuote.id)
        .order('sort_order', { ascending: true });

      if (sourceLanes && sourceLanes.length > 0) {
        await supabase.from('quote_lanes').insert(
          sourceLanes.map((lane) => ({
            quote_id: clonedQuote.id,
            origin_city: lane.origin_city,
            destination_city: lane.destination_city,
            border_crossing: lane.border_crossing,
            border_crossing_fee: lane.border_crossing_fee,
            border_crossing_rate: lane.border_crossing_rate,
            us_rate: lane.us_rate,
            mx_rate: lane.mx_rate,
            equipment_type: lane.equipment_type,
            sort_order: lane.sort_order,
            us_miles: lane.us_miles,
            mx_miles: lane.mx_miles,
            us_rate_per_mile: lane.us_rate_per_mile,
            mx_rate_per_mile: lane.mx_rate_per_mile,
            us_fuel_rate: lane.us_fuel_rate,
            mx_fuel_rate: lane.mx_fuel_rate,
            rate_type: lane.rate_type,
            lane_type: lane.lane_type,
            currency_code: lane.currency_code,
            units_code: lane.units_code,
            border_crossing_only: lane.border_crossing_only,
            accessorials_amount: lane.accessorials_amount,
            accessorials_list: lane.accessorials_list,
            stops_before: lane.stops_before,
            stops_after: lane.stops_after,
          }))
        );
      }

      await supabase.from('quote_history').insert({
        quote_id: clonedQuote.id,
        date: new Date().toISOString(),
        user_name: clonedQuote.owner_name,
        action: 'Quote Cloned',
        notes: `Cloned from ${sourceQuote.quote_number}`,
      });

      setToastMessage(`Quote cloned successfully as ${quoteNumber}`);
      setToastType('success');

      setCurrentQuoteId(clonedQuote.id);
      setViewMode('builder');
    } catch (error) {
      console.error('Error cloning quote:', error);
      setToastMessage('Error cloning quote');
      setToastType('error');
    }
  };

  const handleUpdateQuote = async (updates: Partial<Quote>) => {
    if (!quote) return;

    const { error } = await supabase
      .from('quotes')
      .update(updates)
      .eq('id', quote.id);

    if (error) {
      console.error('Error updating quote:', error);
      setToastMessage(`Error updating quote: ${error.message}`);
      setToastType('error');
      return;
    }

    setQuote({ ...quote, ...updates });
    setToastMessage('Quote updated successfully');
    setToastType('success');
  };

  const handleStageChange = async (newStage: string) => {
    if (!quote) return;

    if (newStage === 'Sent to Customer') {
      if (lanes.length === 0) {
        setToastMessage('Add at least one lane before sending to customer');
        setToastType('error');
        return;
      }
      if (!quote.partner_account) {
        setToastMessage('Partner Account is required before sending to customer');
        setToastType('error');
        return;
      }
      if (quote.customer_review_status === 'accepted') {
        setToastMessage('Cannot resend an already accepted quote');
        setToastType('error');
        return;
      }
      setShowSendToCustomer(true);
      return;
    }

    if (newStage === 'Completed') {
      let accountFuel = { customer_fuel_program: false, fuel_program_method: 'per_mile' };
      if (quote.partner_account) {
        const { data } = await supabase
          .from('accounts')
          .select('customer_fuel_program, fuel_program_method')
          .eq('account_name', quote.partner_account)
          .maybeSingle();
        if (data) {
          accountFuel = {
            customer_fuel_program: data.customer_fuel_program || false,
            fuel_program_method: data.fuel_program_method || 'per_mile',
          };
        }
      }

      const result = validateCompletedStage(quote, lanes, accountFuel);
      if (!result.valid) {
        setCompletedValidationResult(result);
        return;
      }
    }

    const { error } = await supabase
      .from('quotes')
      .update({ stage: newStage })
      .eq('id', quote.id);

    if (!error) {
      const wasLocked = isQuoteLocked(quote.stage);
      const nowLocked = isQuoteLocked(newStage);
      setQuote({ ...quote, stage: newStage });

      await supabase.from('quote_history').insert({
        quote_id: quote.id,
        date: new Date().toISOString(),
        user_name: quote.owner_name,
        action: 'Stage Changed',
        notes: `Stage changed to ${newStage}`,
      });

      if (wasLocked && !nowLocked) {
        setToastMessage('Quote unlocked. You can now edit this quote.');
        setToastType('success');
      } else {
        setToastMessage(`Stage updated to ${newStage}`);
        if (newStage === 'Completed') {
          setToastType('success');
        }
      }
    }
  };

  const handleToggleRateType = async () => {
    if (!quote) return;

    const newRateType = quote.rate_type === 'RPM' ? 'Flat Rate' : 'RPM';

    const { error } = await supabase
      .from('quotes')
      .update({ rate_type: newRateType })
      .eq('id', quote.id);

    if (!error) {
      setQuote({ ...quote, rate_type: newRateType });
      setToastMessage(`Rate type changed to ${newRateType}`);
    }
  };

  const handleUpdateLane = async (id: string, updates: Partial<QuoteLane>): Promise<boolean> => {
    const { id: _id, quote_id: _qid, created_at: _ca, updated_at: _ua, ...safeUpdates } = updates as any;

    const { error } = await supabase
      .from('quote_lanes')
      .update(safeUpdates)
      .eq('id', id);

    if (error) {
      setToastMessage(`Error saving lane: ${error.message}`);
      return false;
    }

    setLanes(prev => prev.map(lane => lane.id === id ? { ...lane, ...safeUpdates } : lane));
    setToastMessage('Lane updated successfully');
    return true;
  };

  const getNextSortOrder = async (quoteId: string): Promise<number> => {
    const { data } = await supabase
      .from('quote_lanes')
      .select('sort_order')
      .eq('quote_id', quoteId)
      .order('sort_order', { ascending: false })
      .limit(1);
    return (data && data.length > 0 ? data[0].sort_order : 0) + 1;
  };

  const handleAddSplitBillingGroup = async (sbLanes: Partial<QuoteLane>[]) => {
    if (!quote || sbLanes.length === 0) return;
    const nextSort = await getNextSortOrder(quote.id);
    const groupId = `split-${Date.now()}`;
    const insertedLanes: QuoteLane[] = [];
    for (let i = 0; i < sbLanes.length; i++) {
      const lane = sbLanes[i];
      const { id: _stripId, ...laneData } = lane as any;
      const { data, error } = await supabase
        .from('quote_lanes')
        .insert({
          ...laneData,
          quote_id: quote.id,
          sort_order: nextSort + i,
          is_primary_lane: lane.split_billing_index === 1,
          split_billing_group: groupId,
        })
        .select()
        .single();
      if (error || !data) {
        console.error('Error inserting SB lane', i + 1, error);
        if (insertedLanes.length > 0) {
          setLanes((prev) => [...prev, ...insertedLanes]);
        }
        setToastMessage(`Failed to save lanes: ${error?.message || 'Unknown error'}`);
        setToastType('error');
        return;
      }
      insertedLanes.push(data as QuoteLane);
    }
    setLanes((prev) => [...prev, ...insertedLanes]);
    setToastMessage(`${insertedLanes.length} split billing lanes added successfully`);
    setToastType('success');
  };

  const handleAddLane = async (newLane: Partial<QuoteLane>, newLane2?: Partial<QuoteLane>) => {
    if (!quote) return;

    if (!newLane.origin_city && !newLane.destination_city) {
      setToastMessage('Origin City and Destination City are required');
      return;
    }

    const isSplitBilling = !!newLane.split_billing_group;
    const tripType = newLane.trip_type || 'One Way';

    const nextSort = await getNextSortOrder(quote.id);

    const sortOffset = newLane.split_billing_index ? (newLane.split_billing_index - 1) : 0;

    const { data, error } = await supabase
      .from('quote_lanes')
      .insert({
        ...newLane,
        quote_id: quote.id,
        sort_order: nextSort + sortOffset,
        is_primary_lane: !isSplitBilling || newLane.split_billing_index === 1,
      })
      .select()
      .single();

    if (error || !data) {
      setToastMessage(`Failed to save lanes: ${error?.message || 'Unknown error'}`);
      setToastType('error');
      return;
    }

    if (isSplitBilling && newLane2) {
      const { data: lane2Data, error: lane2Error } = await supabase
        .from('quote_lanes')
        .insert({
          ...newLane2,
          quote_id: quote.id,
          sort_order: nextSort + 1 + sortOffset,
          is_primary_lane: false,
        })
        .select()
        .single();

      if (!lane2Error && lane2Data) {
        setLanes((prev) => [...prev, data, lane2Data]);
        setToastMessage('Lanes added successfully');
      } else {
        setLanes((prev) => [...prev, data]);
        setToastMessage(`Failed to save lanes: ${lane2Error?.message || 'Unknown error'}`);
        setToastType('error');
      }
    } else if (tripType === 'Round Trip' && !isSplitBilling) {
      const isDomesticService = newLane.service_type === 'Domestic';
      const returnLane = {
        quote_id: quote.id,
        origin_city: newLane2?.origin_city || newLane.destination_city,
        destination_city: newLane2?.destination_city || newLane.origin_city,
        border_crossing: isDomesticService ? 'N/A' : (newLane2?.border_crossing || newLane.border_crossing),
        border_crossing_fee: isDomesticService ? 0 : (newLane2?.border_crossing_fee || newLane.border_crossing_fee || 0),
        border_crossing_rate: isDomesticService ? 0 : (newLane2?.border_crossing_rate || newLane.border_crossing_rate || 0),
        us_rate: newLane2?.us_rate || 0,
        mx_rate: isDomesticService ? 0 : (newLane2?.mx_rate || newLane.mx_rate || 0),
        equipment_type: newLane2?.equipment_type || newLane.equipment_type || 'Dry Van',
        sort_order: nextSort + 1,
        effective_from_date: newLane2?.effective_from_date || newLane.effective_from_date || '2026-02-01',
        effective_to_date: newLane2?.effective_to_date || newLane.effective_to_date || '2026-12-31',
        units_type: newLane2?.units_type || newLane.units_type || 'Miles',
        currency_type: newLane2?.currency_type || newLane.currency_type || 'USD',
        trip_type: 'Round Trip',
        service_type: newLane.service_type || 'Door to Door',
        paired_lane_id: data.id,
        is_primary_lane: false,
        toll_rate: newLane2?.toll_rate || newLane.toll_rate || 0,
        us_miles: newLane2?.us_miles || 0,
        mx_miles: isDomesticService ? 0 : (newLane2?.mx_miles || newLane.mx_miles || 0),
        us_rate_per_mile: newLane2?.us_rate_per_mile || 0,
        mx_rate_per_mile: isDomesticService ? 0 : (newLane2?.mx_rate_per_mile || newLane.mx_rate_per_mile || 0),
        us_fuel_rate: newLane2?.us_fuel_rate || 0,
        mx_fuel_rate: isDomesticService ? 0 : (newLane2?.mx_fuel_rate || newLane.mx_fuel_rate || 0),
        load_frequency: newLane2?.load_frequency || newLane.load_frequency || '',
        load_volume: newLane2?.load_volume || newLane.load_volume || '',
        lane_type: newLane2?.lane_type || newLane.lane_type || '',
        rate_type: newLane2?.rate_type || newLane.rate_type || 'FLT',
      };

      const { data: returnData, error: returnError } = await supabase
        .from('quote_lanes')
        .insert(returnLane)
        .select()
        .single();

      if (!returnError && returnData) {
        await supabase
          .from('quote_lanes')
          .update({ paired_lane_id: returnData.id })
          .eq('id', data.id);

        setLanes([...lanes, { ...data, paired_lane_id: returnData.id }, returnData]);
        setToastMessage('Round trip lanes added successfully');
      }
    } else if (tripType === 'Circuit' && !isSplitBilling) {
      const isDomesticCircuit = newLane.service_type === 'Domestic';
      const circuitLane = {
        quote_id: quote.id,
        origin_city: newLane2?.origin_city || '',
        destination_city: newLane2?.destination_city || '',
        border_crossing: isDomesticCircuit ? 'N/A' : (newLane2?.border_crossing || newLane.border_crossing || ''),
        border_crossing_fee: isDomesticCircuit ? 0 : (newLane2?.border_crossing_fee || newLane.border_crossing_fee || 0),
        border_crossing_rate: isDomesticCircuit ? 0 : (newLane2?.border_crossing_rate || newLane.border_crossing_rate || 0),
        us_rate: newLane2?.us_rate || 0,
        mx_rate: isDomesticCircuit ? 0 : (newLane2?.mx_rate || 0),
        equipment_type: newLane2?.equipment_type || newLane.equipment_type || 'Dry Van',
        sort_order: nextSort + 1,
        effective_from_date: newLane2?.effective_from_date || newLane.effective_from_date || '2026-02-01',
        effective_to_date: newLane2?.effective_to_date || newLane.effective_to_date || '2026-12-31',
        units_type: newLane2?.units_type || newLane.units_type || 'Miles',
        currency_type: newLane2?.currency_type || newLane.currency_type || 'USD',
        trip_type: 'Circuit',
        service_type: newLane.service_type || 'Door to Door',
        paired_lane_id: data.id,
        is_primary_lane: false,
        toll_rate: newLane2?.toll_rate || 0,
        us_miles: newLane2?.us_miles || 0,
        mx_miles: isDomesticCircuit ? 0 : (newLane2?.mx_miles || 0),
        us_rate_per_mile: newLane2?.us_rate_per_mile || 0,
        mx_rate_per_mile: isDomesticCircuit ? 0 : (newLane2?.mx_rate_per_mile || 0),
        us_fuel_rate: newLane2?.us_fuel_rate || 0,
        mx_fuel_rate: isDomesticCircuit ? 0 : (newLane2?.mx_fuel_rate || 0),
        load_frequency: newLane2?.load_frequency || '',
        load_volume: newLane2?.load_volume || '',
        lane_type: newLane2?.lane_type || '',
        rate_type: newLane2?.rate_type || 'FLT',
      };

      const { data: circuitData, error: circuitError } = await supabase
        .from('quote_lanes')
        .insert(circuitLane)
        .select()
        .single();

      if (!circuitError && circuitData) {
        await supabase
          .from('quote_lanes')
          .update({ paired_lane_id: circuitData.id })
          .eq('id', data.id);

        setLanes([...lanes, { ...data, paired_lane_id: circuitData.id }, circuitData]);
        setToastMessage('Circuit lanes added successfully');
      }
    } else {
      setLanes([...lanes, data]);
      setToastMessage('Lane added successfully');
    }
  };

  const handleDeleteLane = async (id: string) => {
    const { error } = await supabase
      .from('quote_lanes')
      .delete()
      .eq('id', id);

    if (!error) {
      setLanes(lanes.filter(lane => lane.id !== id));
      setShowDeleteConfirm(null);
      setToastMessage('Lane deleted successfully');
    }
  };

  const handleDeleteLinkedLanes = async (laneId: string, linkedLaneId: string) => {
    const { error: error1 } = await supabase
      .from('quote_lanes')
      .delete()
      .eq('id', laneId);

    const { error: error2 } = await supabase
      .from('quote_lanes')
      .delete()
      .eq('id', linkedLaneId);

    if (!error1 && !error2) {
      setLanes(lanes.filter(lane => lane.id !== laneId && lane.id !== linkedLaneId));
      setToastMessage('Both lanes deleted successfully');
    } else {
      setToastMessage('Error deleting lanes');
    }
  };

  const handleDeleteMultipleLanes = async (laneIds: string[]) => {
    const errors: string[] = [];
    for (const id of laneIds) {
      const { error } = await supabase
        .from('quote_lanes')
        .delete()
        .eq('id', id);
      if (error) errors.push(id);
    }
    if (errors.length === 0) {
      const idSet = new Set(laneIds);
      setLanes(lanes.filter(lane => !idSet.has(lane.id)));
      setToastMessage(`${laneIds.length} lanes deleted successfully`);
    } else {
      setToastMessage('Error deleting some lanes');
    }
  };

  const handleUpdateLinkedLanes = async (
    laneId: string,
    updates: Partial<QuoteLane>,
    pairedLaneId: string,
    pairedUpdates: Partial<QuoteLane>
  ) => {
    const { error: error1 } = await supabase
      .from('quote_lanes')
      .update(updates)
      .eq('id', laneId);

    const { error: error2 } = await supabase
      .from('quote_lanes')
      .update(pairedUpdates)
      .eq('id', pairedLaneId);

    if (!error1 && !error2) {
      setLanes(lanes.map(lane => {
        if (lane.id === laneId) {
          return { ...lane, ...updates };
        }
        if (lane.id === pairedLaneId) {
          return { ...lane, ...pairedUpdates };
        }
        return lane;
      }));
      setToastMessage('Both linked lanes updated successfully');
    } else {
      setToastMessage('Error updating linked lanes');
    }
  };

  const handleDuplicateLane = async (lane: QuoteLane) => {
    if (!quote) return;

    const tripType = lane.trip_type || 'One Way';
    const isLinked = (tripType === 'Round Trip' || tripType === 'Circuit') && lane.paired_lane_id;
    const isSplitBilling = !!lane.split_billing_group;

    const dupNextSort = await getNextSortOrder(quote.id);

    const buildLanePayload = (src: QuoteLane, sortOffset: number) => ({
      quote_id: quote.id,
      origin_city: src.origin_city,
      destination_city: src.destination_city,
      border_crossing: src.border_crossing,
      border_crossing_fee: src.border_crossing_fee,
      border_crossing_rate: src.border_crossing_rate || 0,
      us_rate: src.us_rate,
      mx_rate: src.mx_rate,
      equipment_type: src.equipment_type,
      sort_order: dupNextSort + sortOffset,
      effective_from_date: src.effective_from_date,
      effective_to_date: src.effective_to_date,
      units_type: src.units_type,
      currency_type: src.currency_type,
      trip_type: src.trip_type,
      service_type: src.service_type,
      toll_rate: src.toll_rate,
      us_miles: src.us_miles,
      mx_miles: src.mx_miles,
      us_rate_per_mile: src.us_rate_per_mile,
      mx_rate_per_mile: src.mx_rate_per_mile,
      us_fuel_rate: src.us_fuel_rate,
      mx_fuel_rate: src.mx_fuel_rate,
      rate_type: src.rate_type,
      lane_type: src.lane_type,
      load_volume: src.load_volume,
      load_frequency: src.load_frequency,
      commitment_type: src.commitment_type,
      target: src.target,
      product: src.product,
      type_of_service: src.type_of_service,
      priority: src.priority,
      additional_accessories: src.additional_accessories,
      comments: src.comments,
      un_number: src.un_number,
      msds: src.msds,
      weight: src.weight,
      dimensions: src.dimensions,
      invoice_value: src.invoice_value,
      tarps: src.tarps,
      temperature: src.temperature,
      temperature_unit: src.temperature_unit,
      packaging: src.packaging,
      vin_dimensions: src.vin_dimensions,
      number_of_vins: src.number_of_vins,
      live_load_or_drop: src.live_load_or_drop,
      display_mode: src.display_mode,
      currency_code: src.currency_code,
      units_code: src.units_code,
      accessorials_list: src.accessorials_list,
      accessorials_amount: src.accessorials_amount,
      border_crossing_only: src.border_crossing_only,
      us_fuel_included_in_line_haul: src.us_fuel_included_in_line_haul,
      mx_fuel_included_in_line_haul: src.mx_fuel_included_in_line_haul,
      stops_before: src.stops_before,
      stops_after: src.stops_after,
    });

    if (isLinked || isSplitBilling) {
      const pairedLane = lanes.find(l => l.id === lane.paired_lane_id);
      const primaryLane = lane.is_primary_lane ? lane : (pairedLane || lane);
      const secondaryLane = lane.is_primary_lane ? pairedLane : lane;

      if (primaryLane && secondaryLane) {
        const newSplitGroup = isSplitBilling ? `split-${Date.now()}` : undefined;

        const primaryPayload = {
          ...buildLanePayload(primaryLane, 0),
          is_primary_lane: true,
          split_billing_group: isSplitBilling ? newSplitGroup : undefined,
          split_billing_index: isSplitBilling ? primaryLane.split_billing_index : undefined,
        };

        const { data: newPrimary, error: err1 } = await supabase
          .from('quote_lanes')
          .insert(primaryPayload)
          .select()
          .single();

        if (err1 || !newPrimary) {
          setToastMessage('Error cloning lane group');
          return;
        }

        const secondaryPayload = {
          ...buildLanePayload(secondaryLane, 1),
          is_primary_lane: false,
          paired_lane_id: newPrimary.id,
          split_billing_group: isSplitBilling ? newSplitGroup : undefined,
          split_billing_index: isSplitBilling ? secondaryLane.split_billing_index : undefined,
        };

        const { data: newSecondary, error: err2 } = await supabase
          .from('quote_lanes')
          .insert(secondaryPayload)
          .select()
          .single();

        if (err2 || !newSecondary) {
          setToastMessage('Error cloning paired lane');
          return;
        }

        await supabase
          .from('quote_lanes')
          .update({ paired_lane_id: newSecondary.id })
          .eq('id', newPrimary.id);

        setLanes([...lanes, { ...newPrimary, paired_lane_id: newSecondary.id }, newSecondary]);
        setToastMessage('Lane group cloned successfully');
        return;
      }
    }

    const { data, error } = await supabase
      .from('quote_lanes')
      .insert({ ...buildLanePayload(lane, 0), is_primary_lane: true, paired_lane_id: undefined })
      .select()
      .single();

    if (!error && data) {
      setLanes([...lanes, data]);
      setToastMessage('Lane cloned successfully');
    } else {
      setToastMessage('Error cloning lane');
    }
  };

  const handleShowDetails = (lane: QuoteLane) => {
    setShowDetails(lane);
  };

  const handleOpenBenchmark = (lane: QuoteLane) => {
    setShowDetails(null);
    setBenchmarkLane(lane);
  };

  const handleSaveDetails = async (updatedLane: Partial<QuoteLane>, pairedLaneUpdates?: Partial<QuoteLane>) => {
    if (!showDetails) return;

    const laneId = showDetails.id;

    const toBoolean = (val: unknown): boolean | null => {
      if (val === true || val === 'true' || val === '1' || val === 1) return true;
      if (val === false || val === 'false' || val === '0' || val === 0) return false;
      return null;
    };

    const sanitizeLane = (data: Partial<QuoteLane>): Partial<QuoteLane> => ({
      ...data,
      msds: toBoolean(data.msds) ?? false,
      border_crossing_only: toBoolean(data.border_crossing_only) ?? false,
      us_fuel_included_in_line_haul: toBoolean(data.us_fuel_included_in_line_haul) ?? false,
      mx_fuel_included_in_line_haul: toBoolean(data.mx_fuel_included_in_line_haul) ?? false,
    });

    const sanitized = sanitizeLane(updatedLane);

    const { data: savedData, error } = await supabase
      .from('quote_lanes')
      .update(sanitized)
      .eq('id', laneId)
      .select()
      .single();

    if (error) {
      console.error('Error saving lane details:', error);
      setToastMessage('Error saving lane details');
      setToastType('error');
      return;
    }

    const updatedLaneData = savedData as QuoteLane;
    let updatedLanes = lanes.map(lane => lane.id === laneId ? updatedLaneData : lane);

    if (pairedLaneUpdates && showDetails.split_billing_group) {
      const allSiblings = lanes.filter(
        l => l.split_billing_group === showDetails.split_billing_group && l.id !== laneId
      );
      const bcValue = pairedLaneUpdates.border_crossing;
      const savingIdx = showDetails.split_billing_index;
      const pairedIdx = savingIdx === 1 ? 4 : savingIdx === 4 ? 1 : savingIdx === 2 ? 3 : 2;
      for (const sibling of allSiblings) {
        if (bcValue === undefined || sibling.split_billing_index !== pairedIdx) continue;
        const sibUpdate: Partial<QuoteLane> = { border_crossing: bcValue };
        if (sibling.split_billing_index === 1) {
          sibUpdate.destination_city = bcValue;
        } else if (sibling.split_billing_index === 2) {
          sibUpdate.origin_city = bcValue;
        } else if (sibling.split_billing_index === 3) {
          sibUpdate.destination_city = bcValue;
        } else if (sibling.split_billing_index === 4) {
          sibUpdate.origin_city = bcValue;
        }
        const sibSanitized = sanitizeLane(sibUpdate);
        const { data: sibSaved, error: sibError } = await supabase
          .from('quote_lanes')
          .update(sibSanitized)
          .eq('id', sibling.id)
          .select()
          .single();
        if (sibError) {
          console.error('Error saving SB sibling lane:', sibError);
        } else {
          const sibData = sibSaved as QuoteLane;
          updatedLanes = updatedLanes.map(lane => lane.id === sibling.id ? sibData : lane);
        }
      }
    } else if (pairedLaneUpdates && showDetails.paired_lane_id) {
      const pairedSanitized = sanitizeLane(pairedLaneUpdates);
      const { data: pairedSaved, error: pairedError } = await supabase
        .from('quote_lanes')
        .update(pairedSanitized)
        .eq('id', showDetails.paired_lane_id)
        .select()
        .single();

      if (pairedError) {
        console.error('Error saving paired lane:', pairedError);
        setToastMessage('Lane saved but error saving paired lane');
        setToastType('error');
      } else {
        const pairedData = pairedSaved as QuoteLane;
        updatedLanes = updatedLanes.map(lane => lane.id === showDetails.paired_lane_id ? pairedData : lane);
      }
    }

    setLanes(updatedLanes);
    setToastMessage('Lane details updated successfully');
    setToastType('success');
  };

  const handleUpdatePairedLaneBCO = async (pairedLaneId: string, borderCrossingOnly: boolean) => {
    const { data, error } = await supabase
      .from('quote_lanes')
      .update({ border_crossing_only: borderCrossingOnly })
      .eq('id', pairedLaneId)
      .select()
      .single();
    if (error) {
      console.error('Error syncing BCO to paired lane:', error);
      return;
    }
    if (data) {
      setLanes(prev => prev.map(l => l.id === pairedLaneId ? (data as QuoteLane) : l));
    }
  };

  const handleChangeLaneCurrency = async (lane: QuoteLane, nextCurrency: string) => {
    if (!quote) return;

    const fromCurrency = (lane.currency_code || 'USD') as CurrencyCode;
    const toCurrency = nextCurrency as CurrencyCode;

    if (fromCurrency === toCurrency) return;

    const exchangeRate = quote.exchange_rate || 0;
    const cadRate = quote.cad_exchange_rate || 0;

    const needsMXN = (fromCurrency === 'MXN' || toCurrency === 'MXN');
    const needsCAD = (fromCurrency === 'CAD' || toCurrency === 'CAD');

    if (needsMXN && exchangeRate <= 0) {
      setToastMessage('Please set the Exchange Rate (USD → MXN) in the Quote Header before changing currency');
      setToastType('error');
      return;
    }
    if (needsCAD && cadRate <= 0) {
      setToastMessage('Please set the USD → CAD Rate in the Quote Header before changing currency');
      setToastType('error');
      return;
    }

    const convertedFields = convertLaneValues(lane as Record<string, number>, fromCurrency, toCurrency, exchangeRate, cadRate);

    const convertedAccessorialsList = Array.isArray(lane.accessorials_list)
      ? lane.accessorials_list.map((a: { rate?: number; default_rate?: number; [key: string]: unknown }) => {
          const toUSD = (v: number) => fromCurrency === 'MXN' ? v / exchangeRate : fromCurrency === 'CAD' ? v / cadRate : v;
          const fromUSD = (v: number) => toCurrency === 'MXN' ? v * exchangeRate : toCurrency === 'CAD' ? v * cadRate : v;
          return {
            ...a,
            rate: typeof a.rate === 'number' ? fromUSD(toUSD(a.rate)) : a.rate,
            default_rate: typeof a.default_rate === 'number' ? fromUSD(toUSD(a.default_rate)) : a.default_rate,
          };
        })
      : lane.accessorials_list;

    const updatePayload = {
      ...convertedFields,
      currency_code: nextCurrency,
      accessorials_list: convertedAccessorialsList,
    };

    const { error } = await supabase
      .from('quote_lanes')
      .update(updatePayload)
      .eq('id', lane.id);

    if (error) {
      console.error('Error converting currency:', error);
      setToastMessage('Error converting currency');
      setToastType('error');
    } else {
      setLanes(lanes.map(l => l.id === lane.id ? { ...l, ...updatePayload } : l));
      setToastMessage(`Lane values converted to ${nextCurrency}`);
      setToastType('success');
    }
  };

  const handleToggleLaneCurrency = async (lane: QuoteLane) => {
    const currencies = ['USD', 'MXN', 'CAD'];
    const currentCurrency = lane.currency_code || 'USD';
    const currentIndex = currencies.indexOf(currentCurrency);
    const nextCurrency = currencies[(currentIndex + 1) % currencies.length];
    await handleChangeLaneCurrency(lane, nextCurrency);
  };

  const handleGlobalToggleUnits = async () => {
    if (!quote || lanes.length === 0) return;

    const currentUnit = quote.units;
    const isKilometers = currentUnit === 'Kilometers' || currentUnit === 'KM';
    const conversionFactor = isKilometers ? 1 / 1.60934 : 1.60934;
    const newUnits = isKilometers ? 'Miles' : 'Kilometers';

    for (const lane of lanes) {
      await supabase
        .from('quote_lanes')
        .update({
          units_type: newUnits,
          us_miles: lane.us_miles * conversionFactor,
          mx_miles: lane.mx_miles * conversionFactor,
        })
        .eq('id', lane.id);
    }

    await supabase
      .from('quotes')
      .update({ units: newUnits })
      .eq('id', quote.id);

    setLanes(lanes.map(lane => ({
      ...lane,
      units_type: newUnits,
      us_miles: lane.us_miles * conversionFactor,
      mx_miles: lane.mx_miles * conversionFactor,
    })));

    setQuote({ ...quote, units: newUnits });
    setToastMessage(`All lanes converted to ${newUnits}`);
  };

  const handleGlobalToggleLanguage = () => {
    setToastMessage('Language changed to Spanish');
  };

  const handleGlobalToggleCurrency = async () => {
    if (!quote || lanes.length === 0) return;

    const currentCurrency = quote.currency;
    const isMXN = currentCurrency === 'MXN';
    const conversionRate = isMXN ? 1 / 17.15 : 17.15;
    const newCurrency = isMXN ? 'USD' : 'MXN';

    for (const lane of lanes) {
      await supabase
        .from('quote_lanes')
        .update({
          currency_type: newCurrency,
          us_rate: lane.us_rate * conversionRate,
          mx_rate: lane.mx_rate * conversionRate,
          border_crossing_fee: lane.border_crossing_fee * conversionRate,
          toll_rate: (lane.toll_rate || 0) * conversionRate,
        })
        .eq('id', lane.id);
    }

    const newTotalAmount = quote.total_amount * conversionRate;
    const newUSPortion = quote.us_portion * conversionRate;
    const newMXRate = quote.mx_rate * conversionRate;
    const newBorderFee = quote.border_crossing_fee * conversionRate;

    await supabase
      .from('quotes')
      .update({
        currency: newCurrency,
        total_amount: newTotalAmount,
        us_portion: newUSPortion,
        mx_rate: newMXRate,
        border_crossing_fee: newBorderFee,
      })
      .eq('id', quote.id);

    setLanes(lanes.map(lane => ({
      ...lane,
      currency_type: newCurrency,
      us_rate: lane.us_rate * conversionRate,
      mx_rate: lane.mx_rate * conversionRate,
      border_crossing_fee: lane.border_crossing_fee * conversionRate,
      toll_rate: (lane.toll_rate || 0) * conversionRate,
    })));

    setQuote({
      ...quote,
      currency: newCurrency,
      total_amount: newTotalAmount,
      us_portion: newUSPortion,
      mx_rate: newMXRate,
      border_crossing_fee: newBorderFee,
    });

    setToastMessage(`All rates converted to ${newCurrency}`);
  };

  const handleGlobalEquipmentTypeChange = async (equipmentType: string) => {
    if (!quote || lanes.length === 0) return;

    for (const lane of lanes) {
      await supabase
        .from('quote_lanes')
        .update({ equipment_type: equipmentType })
        .eq('id', lane.id);
    }

    await supabase
      .from('quotes')
      .update({ type_of_service: equipmentType })
      .eq('id', quote.id);

    setLanes(lanes.map(lane => ({ ...lane, equipment_type: equipmentType })));
    setQuote({ ...quote, type_of_service: equipmentType });
    setToastMessage(`Equipment Type set to ${equipmentType} for all lanes`);
  };

  if (viewMode === 'admin') {
    return (
      <div className="flex min-h-screen">
        <Sidebar current={viewMode} onNavigate={handleNavigate} />
        <div className="flex-1 min-w-0"><AdministrationView /></div>
      </div>
    );
  }

  if (viewMode === 'mass-update') {
    return (
      <div className="flex min-h-screen">
        <Sidebar current={viewMode} onNavigate={handleNavigate} />
        <div className="flex-1 min-w-0"><MassUpdateView onViewLog={() => setViewMode('mass-update-log')} /></div>
      </div>
    );
  }

  if (viewMode === 'mass-update-log') {
    return (
      <div className="flex min-h-screen">
        <Sidebar current={viewMode} onNavigate={handleNavigate} />
        <div className="flex-1 min-w-0"><MassUpdateLogView /></div>
      </div>
    );
  }

  if (viewMode === 'home') {
    return (
      <div className="flex min-h-screen">
        <Sidebar current={viewMode} onNavigate={handleNavigate} />
        <div className="flex-1 min-w-0">
          <DashboardView onNavigate={handleNavigate} />
          <NewQuoteModal
            isOpen={showNewQuoteForm}
            onClose={() => setShowNewQuoteForm(false)}
            onSubmit={handleCreateNewQuote}
            isLoading={loading}
          />
        </div>
      </div>
    );
  }

  if (viewMode === 'customers') {
    return (
      <div className="flex min-h-screen">
        <Sidebar current={viewMode} onNavigate={handleNavigate} />
        <div className="flex-1 min-w-0"><CustomersView /></div>
      </div>
    );
  }

  if (viewMode === 'import') {
    return (
      <div className="flex min-h-screen">
        <Sidebar current={viewMode} onNavigate={handleNavigate} />
        <div className="flex-1 min-w-0"><ImportView /></div>
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="flex min-h-screen">
        <Sidebar current={viewMode} onNavigate={handleNavigate} />
        <div className="flex-1 min-w-0">
          <QuoteListView
            onCreateNew={() => setShowNewQuoteForm(true)}
            onSelectQuote={handleSelectQuote}
            onDeleteQuote={handleDeleteQuoteFromList}
            onCloneQuote={handleCloneQuoteFromList}
          />
          <NewQuoteModal
            isOpen={showNewQuoteForm}
            onClose={() => setShowNewQuoteForm(false)}
            onSubmit={handleCreateNewQuote}
            isLoading={loading}
          />
          {toastMessage && (
            <Toast message={toastMessage} type={toastType} onClose={() => setToastMessage(null)} />
          )}
        </div>
      </div>
    );
  }

  if (loading || !quote) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const locked = isQuoteLocked(quote.stage);

  if (benchmarkLane) {
    const bmIndex = lanes.findIndex(l => l.id === benchmarkLane.id);
    return (
      <div className="flex min-h-screen">
        <Sidebar current={viewMode} onNavigate={handleNavigate} />
        <div className="flex-1 min-w-0">
          <BenchmarkDashboard
            lane={benchmarkLane}
            laneIndex={bmIndex !== -1 ? bmIndex + 1 : 1}
            allLanes={lanes}
            partnerAccount={quote.partner_account || ''}
            onBack={() => setBenchmarkLane(null)}
            onLaneChange={(l) => setBenchmarkLane(l)}
          />
          {toastMessage && (
            <Toast
              message={toastMessage}
              type={toastType}
              onClose={() => { setToastMessage(null); setToastType('success'); }}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar current={viewMode} onNavigate={handleNavigate} />
      <div className="flex-1 min-w-0">
        <div className="min-h-screen bg-gray-50">

      <StageProgressBar
        currentStage={quote.stage || 'New'}
        onStageChange={handleStageChange}
      />

      {locked && (
        <div className="bg-[#FEF3C7] border-b border-amber-300">
          <div className="max-w-[1280px] mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-amber-900">
              <span className="text-base">🔒</span>
              <span>This quote is locked — Stage: <strong>{quote.stage}</strong>. To resume editing, move the stage back to New or In Progress.</span>
            </div>
            <button
              onClick={() => handleStageChange('In Progress')}
              className="px-4 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Move to In Progress
            </button>
          </div>
        </div>
      )}

      <CustomerReviewBanner
        quote={quote}
        lanes={lanes}
        onResend={() => setShowSendToCustomer(true)}
        onViewResponse={() => setShowViewResponse(true)}
        onViewSignature={() => setShowViewSignature(true)}
        onViewRevisionQuote={quote.negotiation_quote_id ? () => {
          setCurrentQuoteId(quote.negotiation_quote_id!);
          setViewMode('builder');
        } : undefined}
      />

      <main className="max-w-[1280px] mx-auto px-6 py-6">
        <div className="space-y-6">
          <QuoteHeader
            quote={quote}
            lanes={lanes}
            locked={locked}
            onToggleUnits={handleGlobalToggleUnits}
            onToggleCurrency={handleGlobalToggleCurrency}
            onToggleLanguage={handleGlobalToggleLanguage}
            onUpdateQuote={handleUpdateQuote}
            onCloneQuote={handleCloneQuote}
            onDeleteQuote={() => setShowDeleteQuoteConfirm(true)}
            onToggleRateType={handleToggleRateType}
            onShowToast={(message, type) => {
              setToastMessage(message);
              setToastType(type);
            }}
            onNavigateToOriginalQuote={quote.quote_number?.endsWith('-NEG') ? async () => {
              const baseNumber = quote.quote_number.replace(/-NEG$/, '');
              const { data: original } = await supabase
                .from('quotes')
                .select('id')
                .eq('quote_number', baseNumber)
                .maybeSingle();
              if (original) {
                setCurrentQuoteId(original.id);
                setViewMode('builder');
              } else {
                setToastMessage('Original quote not found');
                setToastType('error');
              }
            } : undefined}
            onCustomerView={() => {
              if (lanes.length === 0) {
                setToastMessage('Add at least one lane before previewing the customer view');
                setToastType('info');
                return;
              }
              const hasActiveToken = quote.review_token && quote.token_expires_at && new Date(quote.token_expires_at) > new Date();
              if (hasActiveToken) {
                window.open(getPortalUrl(quote.review_token!), '_blank');
                setToastMessage('Opening customer view in new tab');
                setToastType('info');
              } else {
                window.open(getPreviewUrl(quote.id), '_blank');
                setToastMessage('Opening internal preview in new tab');
                setToastType('info');
              }
            }}
          />

          <QuoteHistory history={history} />

          <QuoteTabs
            lanes={lanes}
            quote={quote}
            locked={locked}
            currency={quote.currency}
            onUpdateLane={handleUpdateLane}
            onAddLane={handleAddLane}
            onAddSplitBillingGroup={handleAddSplitBillingGroup}
            onDeleteLane={(id) => setShowDeleteConfirm(id)}
            onShowDetails={handleShowDetails}
            onGlobalEquipmentTypeChange={handleGlobalEquipmentTypeChange}
            onUpdateQuote={handleUpdateQuote}
            onDeleteLinkedLanes={handleDeleteLinkedLanes}
            onDeleteMultipleLanes={handleDeleteMultipleLanes}
            onDuplicateLane={handleDuplicateLane}
            onUpdateLinkedLanes={handleUpdateLinkedLanes}
            onToggleLaneCurrency={handleToggleLaneCurrency}
            onBenchmarkLane={handleOpenBenchmark}
            onToast={(message, type) => { setToastMessage(message); setToastType(type); }}
            onViewResponse={() => setShowViewResponse(true)}
          />
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-[1280px] mx-auto px-6 py-4">
          <p className="text-sm text-gray-500 text-center">
            Smart Pricing Hub - Cross-Border Freight Quote System
          </p>
        </div>
      </footer>

      {showDetails && (() => {
        const currentIndex = lanes.findIndex(l => l.id === showDetails.id);
        const currentLane = currentIndex !== -1 ? lanes[currentIndex] : showDetails;
        const hasNextLane = currentIndex !== -1 && currentIndex < lanes.length - 1;
        const hasPreviousLane = currentIndex !== -1 && currentIndex > 0;
        const nextLaneIndex = currentIndex + 1;
        const previousLaneIndex = currentIndex - 1;
        const paired = currentLane.paired_lane_id ? lanes.find(l => l.id === currentLane.paired_lane_id) : null;

        return (
          <LaneDetailsPanel
            lane={currentLane}
            pairedLane={paired}
            currency={quote.currency}
            quote={quote}
            locked={locked}
            onClose={() => setShowDetails(null)}
            onSave={handleSaveDetails}
            onChangeCurrency={(nextCurrency) => handleChangeLaneCurrency(currentLane, nextCurrency)}
            hasNextLane={hasNextLane}
            onNextLane={() => {
              if (hasNextLane) {
                setShowDetails(lanes[nextLaneIndex]);
              }
            }}
            hasPreviousLane={hasPreviousLane}
            onPreviousLane={() => {
              if (hasPreviousLane) {
                setShowDetails(lanes[previousLaneIndex]);
              }
            }}
            onUpdatePairedLaneBCO={handleUpdatePairedLaneBCO}
            onBenchmark={handleOpenBenchmark}
          />
        );
      })()}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Delete Lane"
          message="Are you sure you want to delete this lane? This action cannot be undone."
          onConfirm={() => handleDeleteLane(showDeleteConfirm)}
          onCancel={() => setShowDeleteConfirm(null)}
        />
      )}

      {showDeleteQuoteConfirm && (
        <ConfirmModal
          title="Delete Quote"
          message="Are you sure you want to permanently delete this quote? This action cannot be undone."
          onConfirm={handleDeleteQuote}
          onCancel={() => setShowDeleteQuoteConfirm(false)}
        />
      )}

      {completedValidationResult && (
        <CompletedValidationModal
          result={completedValidationResult}
          onClose={() => setCompletedValidationResult(null)}
          onOpenLane={(laneId) => {
            const lane = lanes.find(l => l.id === laneId);
            if (lane) {
              setCompletedValidationResult(null);
              setShowDetails(lane);
            }
          }}
        />
      )}

      {showSendToCustomer && (
        <SendToCustomerModal
          quote={quote}
          lanes={lanes}
          onClose={() => setShowSendToCustomer(false)}
          onSuccess={(updates, portalUrl) => {
            setQuote({ ...quote, ...updates });
            setShowSendToCustomer(false);
            setToastMessage(`Quote sent successfully. Link copied to clipboard: ${portalUrl}`);
            setToastType('success');
          }}
        />
      )}

      {showViewResponse && (
        <ViewResponseModal
          quote={quote}
          lanes={lanes}
          onClose={() => setShowViewResponse(false)}
          onNavigateToRevision={quote.negotiation_quote_id ? () => {
            setShowViewResponse(false);
            setCurrentQuoteId(quote.negotiation_quote_id!);
            setViewMode('builder');
          } : undefined}
        />
      )}

      {showViewSignature && (
        <ViewSignatureModal
          quote={quote}
          onClose={() => setShowViewSignature(false)}
        />
      )}

      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          onClose={() => {
            setToastMessage(null);
            setToastType('success');
          }}
        />
      )}
    </div>
      </div>
    </div>
  );
}

export default App;
