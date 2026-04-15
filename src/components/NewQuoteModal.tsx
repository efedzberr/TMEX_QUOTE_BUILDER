import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LookupField } from './LookupField';

interface NewQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    partner_account: string;
    bill_to_customer: string;
    shipper: string;
    bco_partner: string;
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
  });
  const [partnerAccountOptions, setPartnerAccountOptions] = useState<string[]>([]);
  const [billToOptions, setBillToOptions] = useState<string[]>([]);
  const [shipperOptions, setShipperOptions] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      loadOptions();
    } else {
      setFormData({
        partner_account: '',
        bill_to_customer: '',
        shipper: '',
        bco_partner: '',
      });
      setErrors({});
    }
  }, [isOpen]);

  async function loadOptions() {
    const [accountsRes, billToRes, shippersRes] = await Promise.all([
      supabase.from('accounts').select('account_name').eq('status', 'Active').order('account_name'),
      supabase.from('bill_to').select('bill_to_name').eq('status', 'Active').order('bill_to_name'),
      supabase.from('shippers').select('shipper_name').eq('status', 'Active').order('shipper_name'),
    ]);

    setPartnerAccountOptions(accountsRes.data ? accountsRes.data.map(a => a.account_name) : []);
    setBillToOptions(billToRes.data ? billToRes.data.map(b => b.bill_to_name) : []);
    setShipperOptions(shippersRes.data ? shippersRes.data.map(s => s.shipper_name) : []);
  }

  async function createAccount(name: string) {
    const { data } = await supabase
      .from('accounts')
      .insert({ account_name: name, account_code: 'XXXXXX', type: 'Direct Customer', status: 'Active' })
      .select('account_name')
      .single();
    if (data) {
      setPartnerAccountOptions(prev => Array.from(new Set([...prev, name])).sort());
    }
  }

  async function createBillTo(name: string) {
    const { data } = await supabase
      .from('bill_to')
      .insert({ bill_to_name: name, account_code: '', type: 'Direct Customer', status: 'Active' })
      .select('bill_to_name')
      .single();
    if (data) {
      setBillToOptions(prev => Array.from(new Set([...prev, name])).sort());
    }
  }

  async function createShipper(name: string) {
    const { data } = await supabase
      .from('shippers')
      .insert({ shipper_name: name, account_code: '', type: 'Direct Customer', status: 'Active' })
      .select('shipper_name')
      .single();
    if (data) {
      setShipperOptions(prev => Array.from(new Set([...prev, name])).sort());
    }
  }

  const handleParentAccountChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      partner_account: value,
      bco_partner: value,
    }));
    if (errors.partner_account) setErrors(prev => ({ ...prev, partner_account: false }));
    if (errors.bco_partner) setErrors(prev => ({ ...prev, bco_partner: false }));
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, boolean> = {};

    if (!formData.partner_account) newErrors.partner_account = true;
    if (!formData.bill_to_customer) newErrors.bill_to_customer = true;
    if (!formData.shipper) newErrors.shipper = true;
    if (!formData.bco_partner) newErrors.bco_partner = true;

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      await onSubmit(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Create New Quote</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              Parent Account <span className="text-red-600">*</span>
            </div>
            <div className={errors.partner_account ? 'border border-red-500 rounded' : ''}>
              <LookupField
                value={formData.partner_account}
                options={partnerAccountOptions}
                onChange={handleParentAccountChange}
                onCreateNew={createAccount}
                placeholder="Select account..."
              />
            </div>
            {errors.partner_account && (
              <div className="text-red-600 text-xs mt-1">Required</div>
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
                options={partnerAccountOptions}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, bco_partner: value }));
                  if (errors.bco_partner) setErrors(prev => ({ ...prev, bco_partner: false }));
                }}
                onCreateNew={createAccount}
                placeholder="Select account..."
              />
            </div>
            {errors.bco_partner && (
              <div className="text-red-600 text-xs mt-1">Required</div>
            )}
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
    </div>
  );
}
