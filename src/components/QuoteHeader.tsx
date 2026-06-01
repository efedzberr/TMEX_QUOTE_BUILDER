import { User, CheckCircle, X, Copy, Trash2, Calculator, Sigma, Globe as GlobeIcon, Calendar, Eye, GitBranch, ExternalLink } from 'lucide-react';
import { Quote, QuoteLane } from '../lib/supabase';
import { useState, useEffect, useMemo } from 'react';
import { LookupField } from './LookupField';
import { OWNERS, MX_SALES_REPRESENTATIVES, US_SALES_REPRESENTATIVES, EQUIPMENT_TYPES, formatCurrency, CurrencyCode, buildQuoteName } from '../lib/constants';
import { supabase } from '../lib/supabase';

interface QuoteHeaderProps {
  quote: Quote;
  lanes: QuoteLane[];
  locked?: boolean;
  onToggleUnits: () => void;
  onToggleCurrency: () => void;
  onToggleLanguage: () => void;
  onUpdateQuote: (updates: Partial<Quote>) => void;
  onCloneQuote: () => void;
  onDeleteQuote: () => void;
  onToggleRateType: () => void;
  onShowToast?: (message: string, type: 'error' | 'success' | 'info') => void;
  onCustomerView?: () => void;
  onNavigateToOriginalQuote?: () => void;
}

export function QuoteHeader({
  quote,
  lanes,
  locked = false,
  onToggleUnits,
  onToggleCurrency,
  onToggleLanguage,
  onUpdateQuote,
  onCloneQuote,
  onDeleteQuote,
  onToggleRateType,
  onShowToast,
  onCustomerView,
  onNavigateToOriginalQuote,
}: QuoteHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [opportunities, setOpportunities] = useState<string[]>([]);
  const [parentAccounts, setParentAccounts] = useState<string[]>([]);
  const [shippers, setShippers] = useState<string[]>([]);
  const [billToCustomers, setBillToCustomers] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [accountCodeMap, setAccountCodeMap] = useState<Record<string, string>>({});

  const [editedData, setEditedData] = useState({
    quote_number: quote.quote_number,
    opportunity: quote.opportunity,
    opportunity_type: quote.opportunity_type || '',
    owner_name: quote.owner_name,
    mx_sales_rep: quote.mx_sales_rep,
    us_sales_rep: quote.us_sales_rep,
    total_amount: quote.total_amount,
    border_crossing_fee: quote.border_crossing_fee,
    us_portion: quote.us_portion,
    mx_rate: quote.mx_rate,
    type_of_service: quote.type_of_service,
    partner_account: quote.partner_account,
    bill_to_customer: quote.bill_to_customer,
    shipper: quote.shipper,
    bco_partner: quote.bco_partner,
    units: quote.units,
    exchange_rate: quote.exchange_rate || 0,
    cad_exchange_rate: quote.cad_exchange_rate || 0,
  });

  const calculatedSummary = useMemo(() => {
    const totalAmount = lanes.reduce((sum, lane) => sum + (lane.us_rate + lane.mx_rate + lane.border_crossing_fee + (lane.toll_rate || 0)), 0);
    const borderCrossingFee = lanes.reduce((sum, lane) => sum + lane.border_crossing_fee, 0);
    const usPortion = lanes.reduce((sum, lane) => sum + lane.us_rate, 0);
    const mxRate = lanes.reduce((sum, lane) => sum + lane.mx_rate, 0);

    return { totalAmount, borderCrossingFee, usPortion, mxRate };
  }, [lanes]);

  const generatedQuoteName = useMemo(() => {
    const activePartnerAccount = isEditing ? editedData.partner_account : quote.partner_account;
    const activeMxRep = isEditing ? editedData.mx_sales_rep : quote.mx_sales_rep;
    const activeOwner = isEditing ? editedData.owner_name : quote.owner_name;
    const accountCode = accountCodeMap[activePartnerAccount] || 'XXXXXX';
    return buildQuoteName({
      mxSalesRep: activeMxRep || '',
      ownerName: activeOwner || '',
      accountCode,
      createdAt: quote.created_at,
      sequence: quote.quote_name_sequence || 1,
      version: quote.quote_name_version || 1,
    });
  }, [
    isEditing,
    editedData.partner_account,
    editedData.mx_sales_rep,
    editedData.owner_name,
    quote.partner_account,
    quote.mx_sales_rep,
    quote.owner_name,
    quote.created_at,
    quote.quote_name_sequence,
    quote.quote_name_version,
    accountCodeMap,
  ]);

  useEffect(() => {
    loadLookupData();
  }, []);

  useEffect(() => {
    setEditedData({
      quote_number: quote.quote_number,
      opportunity: quote.opportunity,
      opportunity_type: quote.opportunity_type || '',
      owner_name: quote.owner_name,
      mx_sales_rep: quote.mx_sales_rep,
      us_sales_rep: quote.us_sales_rep,
      total_amount: quote.total_amount,
      border_crossing_fee: quote.border_crossing_fee,
      us_portion: quote.us_portion,
      mx_rate: quote.mx_rate,
      type_of_service: quote.type_of_service,
      partner_account: quote.partner_account,
      bill_to_customer: quote.bill_to_customer,
      shipper: quote.shipper,
      bco_partner: quote.bco_partner,
      units: quote.units,
      exchange_rate: quote.exchange_rate || 0,
      cad_exchange_rate: quote.cad_exchange_rate || 0,
    });
  }, [quote]);

  async function loadLookupData() {
    const { data: oppData } = await supabase.from('opportunities').select('name').order('name');
    if (oppData) setOpportunities(oppData.map(o => o.name));

    const [accountsRes, billToRes, shippersRes] = await Promise.all([
      supabase.from('accounts').select('account_name, account_code').eq('status', 'Active').order('account_name'),
      supabase.from('bill_to').select('bill_to_name').eq('status', 'Active').order('bill_to_name'),
      supabase.from('shippers').select('shipper_name').eq('status', 'Active').order('shipper_name'),
    ]);

    const accountNames = accountsRes.data ? accountsRes.data.map(a => a.account_name) : [];

    const codeMap: Record<string, string> = {};
    if (accountsRes.data) {
      accountsRes.data.forEach(a => {
        if (a.account_name && a.account_code) {
          codeMap[a.account_name] = a.account_code;
        }
      });
    }
    setAccountCodeMap(codeMap);

    setParentAccounts(accountNames);
    setBillToCustomers(billToRes.data ? billToRes.data.map(b => b.bill_to_name) : []);
    setShippers(shippersRes.data ? shippersRes.data.map(s => s.shipper_name) : []);
  }

  async function createAccount(name: string) {
    const { data } = await supabase
      .from('accounts')
      .insert({ account_name: name, account_code: 'XXXXXX', type: 'Direct Customer', status: 'Active' })
      .select('account_name')
      .single();
    if (data) {
      setParentAccounts(prev => Array.from(new Set([...prev, name])).sort());
    }
  }

  async function createBillTo(name: string) {
    const { data } = await supabase
      .from('bill_to')
      .insert({ bill_to_name: name, account_code: '', type: 'Direct Customer', status: 'Active' })
      .select('bill_to_name')
      .single();
    if (data) {
      setBillToCustomers(prev => Array.from(new Set([...prev, name])).sort());
    }
  }

  async function createShipper(name: string) {
    const { data } = await supabase
      .from('shippers')
      .insert({ shipper_name: name, account_code: '', type: 'Direct Customer', status: 'Active' })
      .select('shipper_name')
      .single();
    if (data) {
      setShippers(prev => Array.from(new Set([...prev, name])).sort());
    }
  }

  const handleEdit = () => {
    if (locked) {
      onShowToast?.('This quote is locked. Move the stage back to In Progress to enable editing.', 'info');
      return;
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    const requiredFields = {
      partner_account: 'Parent Account',
      shipper: 'Shipper',
      bill_to_customer: 'Bill To Customer',
      bco_partner: 'BCO',
    };

    const errors: Record<string, boolean> = {};
    const missingFields: string[] = [];

    Object.entries(requiredFields).forEach(([field, label]) => {
      if (!editedData[field as keyof typeof editedData] || editedData[field as keyof typeof editedData] === '') {
        errors[field] = true;
        missingFields.push(label);
      }
    });

    if (missingFields.length > 0) {
      setValidationErrors(errors);
      if (onShowToast) {
        onShowToast(`Please complete all required fields before saving: ${missingFields.join(', ')}`, 'error');
      }
      return;
    }

    setValidationErrors({});
    const updates: Partial<typeof editedData & { generated_quote_name: string }> = {
      partner_account: editedData.partner_account,
      bill_to_customer: editedData.bill_to_customer,
      shipper: editedData.shipper,
      bco_partner: editedData.bco_partner,
      owner_name: editedData.owner_name,
      mx_sales_rep: editedData.mx_sales_rep,
      us_sales_rep: editedData.us_sales_rep,
      type_of_service: editedData.type_of_service,
      units: editedData.units,
      opportunity: editedData.opportunity,
      opportunity_type: editedData.opportunity_type,
      exchange_rate: editedData.exchange_rate,
      cad_exchange_rate: editedData.cad_exchange_rate,
      generated_quote_name: generatedQuoteName,
    };
    onUpdateQuote(updates);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedData({
      quote_number: quote.quote_number,
      opportunity: quote.opportunity,
      opportunity_type: quote.opportunity_type || '',
      owner_name: quote.owner_name,
      mx_sales_rep: quote.mx_sales_rep,
      us_sales_rep: quote.us_sales_rep,
      total_amount: quote.total_amount,
      border_crossing_fee: quote.border_crossing_fee,
      us_portion: quote.us_portion,
      mx_rate: quote.mx_rate,
      type_of_service: quote.type_of_service,
      partner_account: quote.partner_account,
      bill_to_customer: quote.bill_to_customer,
      shipper: quote.shipper,
      bco_partner: quote.bco_partner,
      units: quote.units,
      exchange_rate: quote.exchange_rate || 0,
      cad_exchange_rate: quote.cad_exchange_rate || 0,
    });
    setIsEditing(false);
  };

  const handleChange = (field: string, value: string | number) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field] && value) {
      setValidationErrors(prev => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const formatDateDisplay = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month} / ${day} / ${year}`;
  };

  const isRevisionQuote = quote.quote_number?.endsWith('-NEG') || false;

  return (
    <div className="bg-white">
      {isRevisionQuote && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <GitBranch className="w-4 h-4" />
            <span>
              This is a <strong>revision quote</strong> created from customer response on the original quote.
            </span>
          </div>
          {onNavigateToOriginalQuote && (
            <button
              onClick={onNavigateToOriginalQuote}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Original Quote
            </button>
          )}
        </div>
      )}
      <div className="px-6 py-6 border-b border-gray-200 flex gap-6">
        <div className="flex-1 flex">
          <div className="flex-1 border-r border-gray-300 pr-6 text-center">
            <div className="text-2xl mb-2">📋</div>
            <div className="text-[11px] text-gray-600 uppercase tracking-wide font-semibold mb-2">Quote Name</div>
            <div className="text-sm font-bold text-gray-900 break-words">{generatedQuoteName}</div>
          </div>

          <div className="flex-1 border-r border-gray-300 px-6 text-center">
            <div className="text-2xl mb-2">🏢</div>
            <div className="text-[11px] text-gray-600 uppercase tracking-wide font-semibold mb-2">Parent Account</div>
            <div className="text-sm font-bold text-gray-900">{quote.partner_account || '—'}</div>
          </div>

          <div className="flex-1 border-r border-gray-300 px-6 text-center">
            <div className="text-2xl mb-2">🚚</div>
            <div className="text-[11px] text-gray-600 uppercase tracking-wide font-semibold mb-2">Shipper</div>
            <div className="text-sm font-bold text-gray-900">{quote.shipper || '—'}</div>
          </div>

          <div className="flex-1 border-r border-gray-300 px-6 text-center">
            <div className="text-2xl mb-2">💳</div>
            <div className="text-[11px] text-gray-600 uppercase tracking-wide font-semibold mb-2">Bill To</div>
            <div className="text-sm font-bold text-gray-900">{quote.bill_to_customer || '—'}</div>
          </div>

          <div className="flex-1 px-6 text-center">
            <div className="text-2xl mb-2">🌐</div>
            <div className="text-[11px] text-gray-600 uppercase tracking-wide font-semibold mb-2">BCO</div>
            <div className="text-sm font-bold text-gray-900">{quote.bco_partner || '—'}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {!isEditing ? (
            <button
              onClick={handleEdit}
              disabled={locked}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                locked
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              ✏️ Edit Quote
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                <CheckCircle className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg transition-colors text-sm font-medium"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          {onCustomerView && (
            <button
              onClick={onCustomerView}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
              title={
                quote.review_token && quote.token_expires_at && new Date(quote.token_expires_at) > new Date()
                  ? 'Preview the live customer portal'
                  : 'Preview how the customer will see this quote (internal preview only)'
              }
            >
              <Eye className="w-4 h-4" />
              Quote Review Portal
            </button>
          )}
          <button
            onClick={onCloneQuote}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors text-sm font-medium"
          >
            <Copy className="w-4 h-4" />
            Clone Quote
          </button>
          <button
            onClick={locked ? undefined : onDeleteQuote}
            disabled={locked}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
              locked
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-red-100 hover:bg-red-200 text-red-700'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            Delete Quote
          </button>
        </div>
      </div>

      <div className="px-6 py-4 grid grid-cols-5 gap-6">
        <div className="space-y-3">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">People</div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Quote Number</div>
            <div className="text-sm text-gray-900">{quote.quote_number}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Owner</div>
            {!isEditing ? (
              <div className="text-sm text-gray-900 flex items-center gap-1">
                <User className="w-3 h-3 text-blue-600" />
                {quote.owner_name}
              </div>
            ) : (
              <select
                value={editedData.owner_name}
                onChange={(e) => handleChange('owner_name', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {OWNERS.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">MX Sales Representative</div>
            {!isEditing ? (
              <div className="text-sm text-gray-900">{quote.mx_sales_rep}</div>
            ) : (
              <select
                value={editedData.mx_sales_rep}
                onChange={(e) => handleChange('mx_sales_rep', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {MX_SALES_REPRESENTATIVES.map((rep) => (
                  <option key={rep} value={rep}>
                    {rep}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">US Sales Representative</div>
            {!isEditing ? (
              <div className="text-sm text-gray-900">{quote.us_sales_rep}</div>
            ) : (
              <select
                value={editedData.us_sales_rep}
                onChange={(e) => handleChange('us_sales_rep', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {US_SALES_REPRESENTATIVES.map((rep) => (
                  <option key={rep} value={rep}>
                    {rep}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Accounts</div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
              Parent Account <span className="text-red-600">*</span>
            </div>
            {!isEditing ? (
              <div className="text-sm text-blue-600">{quote.partner_account || '—'}</div>
            ) : (
              <div>
                <div className={validationErrors.partner_account ? 'border border-red-500 rounded' : ''}>
                  <LookupField
                    value={editedData.partner_account}
                    options={parentAccounts}
                    onChange={(value) => {
                      setEditedData(prev => ({ ...prev, partner_account: value, bco_partner: value }));
                      if (validationErrors.partner_account || validationErrors.bco_partner) {
                        setValidationErrors(prev => {
                          const u = { ...prev };
                          delete u.partner_account;
                          delete u.bco_partner;
                          return u;
                        });
                      }
                    }}
                    onCreateNew={createAccount}
                    placeholder="Select account..."
                  />
                </div>
                {validationErrors.partner_account && (
                  <div className="text-red-600 text-[10px] mt-0.5">Required</div>
                )}
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
              Bill To Customer <span className="text-red-600">*</span>
            </div>
            {!isEditing ? (
              <div className="text-sm text-blue-600">{quote.bill_to_customer || '—'}</div>
            ) : (
              <div>
                <div className={validationErrors.bill_to_customer ? 'border border-red-500 rounded' : ''}>
                  <LookupField
                    value={editedData.bill_to_customer}
                    options={billToCustomers}
                    onChange={(value) => handleChange('bill_to_customer', value)}
                    onCreateNew={createBillTo}
                    placeholder="Select customer..."
                  />
                </div>
                {validationErrors.bill_to_customer && (
                  <div className="text-red-600 text-[10px] mt-0.5">Required</div>
                )}
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
              Shipper <span className="text-red-600">*</span>
            </div>
            {!isEditing ? (
              <div className="text-sm text-blue-600">{quote.shipper || '—'}</div>
            ) : (
              <div>
                <div className={validationErrors.shipper ? 'border border-red-500 rounded' : ''}>
                  <LookupField
                    value={editedData.shipper}
                    options={shippers}
                    onChange={(value) => handleChange('shipper', value)}
                    onCreateNew={createShipper}
                    placeholder="Select shipper..."
                  />
                </div>
                {validationErrors.shipper && (
                  <div className="text-red-600 text-[10px] mt-0.5">Required</div>
                )}
              </div>
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
              BCO <span className="text-red-600">*</span>
            </div>
            {!isEditing ? (
              <div className="text-sm text-blue-600">{quote.bco_partner || '—'}</div>
            ) : (
              <div>
                <div className={validationErrors.bco_partner ? 'border border-red-500 rounded' : ''}>
                  <LookupField
                    value={editedData.bco_partner}
                    options={parentAccounts}
                    onChange={(value) => handleChange('bco_partner', value)}
                    onCreateNew={createAccount}
                    placeholder="Select account..."
                  />
                </div>
                {validationErrors.bco_partner && (
                  <div className="text-red-600 text-[10px] mt-0.5">Required</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Dates</div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Effective Date</div>
            {!isEditing ? (
              <div className="text-sm text-gray-900">{formatDateDisplay(quote.created_at)}</div>
            ) : (
              <input
                type="date"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Expiration Date</div>
            {!isEditing ? (
              <div className="text-sm text-gray-900">DEC / 22 / 2027</div>
            ) : (
              <input
                type="date"
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Equipment Type</div>
            {!isEditing ? (
              <div className="text-sm text-gray-900">{quote.type_of_service}</div>
            ) : (
              <select
                value={editedData.type_of_service}
                onChange={(e) => handleChange('type_of_service', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                {EQUIPMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Settings</div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Opportunity Type</div>
            {!isEditing ? (
              <div className="text-sm text-gray-900">{quote.opportunity_type || '—'}</div>
            ) : (
              <select
                value={editedData.opportunity_type}
                onChange={(e) => handleChange('opportunity_type', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Opportunity Type</option>
                <option value="BID">BID</option>
                <option value="CONTRACT">CONTRACT</option>
                <option value="STANDARD PUBLISH">STANDARD PUBLISH</option>
              </select>
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Currency</div>
            {!isEditing ? (
              <div className="text-sm text-gray-900">{quote.currency}</div>
            ) : (
              <div className="text-sm font-medium text-gray-900">{quote.currency}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Units</div>
            {!isEditing ? (
              <div className="text-sm text-gray-900">{quote.units}</div>
            ) : (
              <div className="text-sm text-gray-900">{editedData.units}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Language</div>
            {!isEditing ? (
              <div className="text-sm text-gray-900">English</div>
            ) : (
              <div className="text-sm font-medium text-gray-900">English</div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Rates & Fuel</div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">USD → MXN Rate</div>
            {!isEditing ? (
              <div className="text-sm font-medium text-gray-900">
                {(quote.exchange_rate && quote.exchange_rate > 0) ? `USD $1.00 = MXN $${quote.exchange_rate.toFixed(4)}` : <span className="text-amber-600 italic">Not set</span>}
              </div>
            ) : (
              <input
                type="number"
                step="0.0001"
                min="0"
                placeholder="e.g. 17.5543"
                value={editedData.exchange_rate || ''}
                onChange={(e) => handleChange('exchange_rate', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">USD → CAD Rate</div>
            {!isEditing ? (
              <div className="text-sm font-medium text-gray-900">
                {(quote.cad_exchange_rate && quote.cad_exchange_rate > 0) ? `USD $1.00 = CAD $${quote.cad_exchange_rate.toFixed(4)}` : <span className="text-amber-600 italic">Not set</span>}
              </div>
            ) : (
              <input
                type="number"
                step="0.0001"
                min="0"
                placeholder="e.g. 1.3600"
                value={editedData.cad_exchange_rate || ''}
                onChange={(e) => handleChange('cad_exchange_rate', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            )}
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Today's Fuel (RPM)</div>
            {(quote.today_fuel_rate && quote.today_fuel_rate > 0)
              ? <div className="text-sm font-medium text-gray-900">{formatCurrency(quote.today_fuel_rate, quote.currency as CurrencyCode)}</div>
              : <div className="text-sm text-amber-600 italic text-[11px]">Set in Administration → Global Variables</div>
            }
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Rate Per Mile</div>
            {(quote.rate_per_mile && quote.rate_per_mile > 0)
              ? <div className="text-sm font-medium text-gray-900">{formatCurrency(quote.rate_per_mile, quote.currency as CurrencyCode)}</div>
              : <div className="text-sm text-amber-600 italic text-[11px]">Set in Administration → Global Variables</div>
            }
          </div>
        </div>
      </div>
    </div>
  );
}
