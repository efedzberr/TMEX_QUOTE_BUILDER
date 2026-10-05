import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LookupField } from './LookupField';
import { NewAccountModal, CreatedAccount } from './NewAccountModal';
import { OPPORTUNITY_TYPES, QUOTE_PRIORITIES, EQUIPMENT_TYPES } from '../lib/constants';

const DIRECT_CUSTOMER = 'Direct Customer';

interface AccountOption {
  id: string;
  account_name: string;
  type: string;
}

interface ChildOption {
  name: string;
  account_id: string | null;
}

interface NewQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    partner_account: string;
    bill_to_customer: string;
    shipper: string;
    bco_partner: string;
    priority: string;
    opportunity_type: string;
    equipment_type: string;
  }) => Promise<void>;
  isLoading: boolean;
}

export function NewQuoteModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: NewQuoteModalProps) {
  const [formData, setFormData] = useState({
    partner_account: '',
    bill_to_customer: '',
    shipper: '',
    bco_partner: '',
    priority: 'Standard',
    opportunity_type: '',
    equipment_type: '',
  });
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [billTos, setBillTos] = useState<ChildOption[]>([]);
  const [shipperList, setShipperList] = useState<ChildOption[]>([]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [newAccount, setNewAccount] = useState<{ name: string; target: 'parent' | 'bco' } | null>(null);

  const partnerAccountOptions = accounts.map(a => a.account_name);
  const bcoOptions = accounts.filter(a => a.type === DIRECT_CUSTOMER).map(a => a.account_name);
  const billToOptions = billTos.map(b => b.name);
  const shipperOptions = shipperList.map(s => s.name);
  const selectedParent = accounts.find(a => a.account_name === formData.partner_account);
  const parentIsTransportation = !!selectedParent && selectedParent.type !== DIRECT_CUSTOMER;

  useEffect(() => {
    if (isOpen) {
      loadOptions();
    } else {
      setFormData({
        partner_account: '',
        bill_to_customer: '',
        shipper: '',
        bco_partner: '',
        priority: 'Standard',
        opportunity_type: '',
        equipment_type: '',
      });
      setErrors({});
      setNewAccount(null);
    }
  }, [isOpen]);

  async function loadOptions() {
    const [accountsRes, billToRes, shippersRes] = await Promise.all([
      supabase.from('accounts').select('id, account_name, type').eq('status', 'Active').order('account_name'),
      supabase.from('bill_to').select('bill_to_name, account_id').eq('status', 'Active').order('bill_to_name'),
      supabase.from('shippers').select('shipper_name, account_id').eq('status', 'Active').order('shipper_name'),
    ]);

    setAccounts(accountsRes.data ? (accountsRes.data as AccountOption[]) : []);
    setBillTos(billToRes.data ? billToRes.data.map(b => ({ name: b.bill_to_name, account_id: b.account_id })) : []);
    setShipperList(shippersRes.data ? shippersRes.data.map(s => ({ name: s.shipper_name, account_id: s.account_id })) : []);
  }

  const sortByName = <T,>(items: T[], getName: (item: T) => string) =>
    [...items].sort((a, b) => getName(a).localeCompare(getName(b), undefined, { sensitivity: 'base' }));

  /** Applies the Parent Account rules: BCO by account type, Bill To and Shipper from the account's own records */
  function applyParentAccount(
    account: AccountOption | undefined,
    value: string,
    billToList: ChildOption[],
    shippers: ChildOption[],
  ) {
    const ownBillTo = account ? billToList.find(b => b.account_id === account.id) : undefined;
    const ownShipper = account ? shippers.find(s => s.account_id === account.id) : undefined;
    setFormData(prev => ({
      ...prev,
      partner_account: value,
      bco_partner: account && account.type === DIRECT_CUSTOMER ? value : '',
      bill_to_customer: ownBillTo ? ownBillTo.name : '',
      shipper: ownShipper ? ownShipper.name : '',
    }));
    setErrors(prev => ({ ...prev, partner_account: false, bco_partner: false, bill_to_customer: false, shipper: false }));
  }

  function handleAccountCreated(created: CreatedAccount) {
    const target = newAccount?.target;
    const account: AccountOption = { id: created.id, account_name: created.account_name, type: created.type };
    const nextBillTos = created.bill_to_name && !billTos.some(b => b.name === created.bill_to_name)
      ? sortByName([...billTos, { name: created.bill_to_name, account_id: created.id }], b => b.name)
      : billTos;
    const nextShippers = created.shipper_name && !shipperList.some(s => s.name === created.shipper_name)
      ? sortByName([...shipperList, { name: created.shipper_name, account_id: created.id }], s => s.name)
      : shipperList;
    setAccounts(prev => sortByName([...prev, account], a => a.account_name));
    setBillTos(nextBillTos);
    setShipperList(nextShippers);
    if (target === 'bco') {
      setFormData(prev => ({ ...prev, bco_partner: created.account_name }));
      setErrors(prev => ({ ...prev, bco_partner: false }));
    } else {
      applyParentAccount(account, created.account_name, nextBillTos, nextShippers);
    }
    setNewAccount(null);
  }

  async function createBillTo(name: string) {
    const { data } = await supabase
      .from('bill_to')
      .insert({ bill_to_name: name, account_code: '', type: 'Direct Customer', status: 'Active' })
      .select('bill_to_name')
      .single();
    if (data) {
      setBillTos(prev => sortByName([...prev, { name, account_id: null }], b => b.name));
    }
  }

  async function createShipper(name: string) {
    const { data } = await supabase
      .from('shippers')
      .insert({ shipper_name: name, account_code: '', type: 'Direct Customer', status: 'Active' })
      .select('shipper_name')
      .single();
    if (data) {
      setShipperList(prev => sortByName([...prev, { name, account_id: null }], s => s.name));
    }
  }

  const handleParentAccountChange = (value: string) => {
    applyParentAccount(accounts.find(a => a.account_name === value), value, billTos, shipperList);
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, boolean> = {};

    if (!formData.partner_account) newErrors.partner_account = true;
    if (!formData.bill_to_customer) newErrors.bill_to_customer = true;
    if (!formData.shipper) newErrors.shipper = true;
    if (!formData.bco_partner || !bcoOptions.includes(formData.bco_partner)) newErrors.bco_partner = true;
    if (!formData.priority) newErrors.priority = true;
    if (!formData.opportunity_type) newErrors.opportunity_type = true;
    if (!formData.equipment_type) newErrors.equipment_type = true;

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      await onSubmit(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create New Quote</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Parent Account <span className="text-red-600">*</span>
            </div>
            <div className={errors.partner_account ? 'border border-red-500 rounded' : ''}>
              <LookupField
                value={formData.partner_account}
                options={partnerAccountOptions}
                onChange={handleParentAccountChange}
                onRequestCreate={(name) => setNewAccount({ name, target: 'parent' })}
                placeholder="Select account..."
              />
            </div>
            {errors.partner_account && (
              <div className="text-red-600 text-xs mt-1">Required</div>
            )}
            {selectedParent && (
              <div className="text-gray-500 text-xs mt-1">{selectedParent.type}</div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Bill To Customer <span className="text-red-600">*</span>
            </div>
            <div className={errors.bill_to_customer ? 'border border-red-500 rounded' : ''}>
              <LookupField
                value={formData.bill_to_customer}
                options={billToOptions}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, bill_to_customer: value }));
                  if (errors.bill_to_customer) setErrors(prev => ({ ...prev, bill_to_customer: false }));
                }}
                onCreateNew={createBillTo}
                placeholder="Select customer..."
              />
            </div>
            {errors.bill_to_customer && (
              <div className="text-red-600 text-xs mt-1">Required</div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Shipper <span className="text-red-600">*</span>
            </div>
            <div className={errors.shipper ? 'border border-red-500 rounded' : ''}>
              <LookupField
                value={formData.shipper}
                options={shipperOptions}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, shipper: value }));
                  if (errors.shipper) setErrors(prev => ({ ...prev, shipper: false }));
                }}
                onCreateNew={createShipper}
                placeholder="Select shipper..."
              />
            </div>
            {errors.shipper && (
              <div className="text-red-600 text-xs mt-1">Required</div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              BCO <span className="text-red-600">*</span>
            </div>
            <div className={errors.bco_partner ? 'border border-red-500 rounded' : ''}>
              <LookupField
                value={formData.bco_partner}
                options={bcoOptions}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, bco_partner: value }));
                  if (errors.bco_partner) setErrors(prev => ({ ...prev, bco_partner: false }));
                }}
                onRequestCreate={(name) => setNewAccount({ name, target: 'bco' })}
                placeholder="Select direct customer..."
              />
            </div>
            {errors.bco_partner && (
              <div className="text-red-600 text-xs mt-1">Required — select a Direct Customer</div>
            )}
            {parentIsTransportation && !errors.bco_partner && (
              <div className="text-gray-500 text-xs mt-1">
                The Parent Account is a Transportation Company. Select the Direct Customer (BCO) for this quote.
              </div>
            )}
          </div>

          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Equipment Type <span className="text-red-600">*</span>
            </div>
            <select
              value={formData.equipment_type}
              onChange={(e) => {
                setFormData(prev => ({ ...prev, equipment_type: e.target.value }));
                if (errors.equipment_type) setErrors(prev => ({ ...prev, equipment_type: false }));
              }}
              className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.equipment_type ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select...</option>
              {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.equipment_type && (
              <div className="text-red-600 text-xs mt-1">Required</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                Opportunity Type <span className="text-red-600">*</span>
              </div>
              <select
                value={formData.opportunity_type}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, opportunity_type: e.target.value }));
                  if (errors.opportunity_type) setErrors(prev => ({ ...prev, opportunity_type: false }));
                }}
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.opportunity_type ? 'border-red-500' : 'border-gray-300'}`}
              >
                <option value="">Select...</option>
                {OPPORTUNITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {errors.opportunity_type && (
                <div className="text-red-600 text-xs mt-1">Required</div>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                Priority <span className="text-red-600">*</span>
              </div>
              <select
                value={formData.priority}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, priority: e.target.value }));
                  if (errors.priority) setErrors(prev => ({ ...prev, priority: false }));
                }}
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.priority ? 'border-red-500' : 'border-gray-300'}`}
              >
                {QUOTE_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.priority && (
                <div className="text-red-600 text-xs mt-1">Required</div>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Quote'}
          </button>
        </div>
      </div>

      <NewAccountModal
        isOpen={!!newAccount}
        initialName={newAccount?.name || ''}
        lockedType={newAccount?.target === 'bco' ? DIRECT_CUSTOMER : undefined}
        onClose={() => setNewAccount(null)}
        onCreated={handleAccountCreated}
      />
    </div>
  );
}
