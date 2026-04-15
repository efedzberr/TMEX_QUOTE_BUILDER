import { useState } from 'react';
import { ArrowRight, ArrowLeftRight, Route } from 'lucide-react';

interface TripTypeModalProps {
  onSelect: (tripType: 'One Way' | 'Round Trip' | 'Circuit', splitBilling?: boolean) => void;
  onClose: () => void;
  onBack: () => void;
  serviceType?: 'Loop' | 'Door to Door' | 'Domestic' | null;
}

export function TripTypeModal({ onSelect, onClose, onBack, serviceType }: TripTypeModalProps) {
  const [splitBilling, setSplitBilling] = useState(false);

  const getColorScheme = (serviceType?: string | null) => {
    if (serviceType === 'Loop') return 'blue';
    if (serviceType === 'Door to Door') return 'green';
    if (serviceType === 'Domestic') return 'violet';
    return 'blue';
  };

  const colorScheme = getColorScheme(serviceType);
  const showSplitBilling = serviceType === 'Door to Door';

  const tripTypes = [
    {
      type: 'One Way' as const,
      title: 'One Way',
      description: 'Single lane from origin to destination',
      icon: ArrowRight,
    },
    {
      type: 'Round Trip' as const,
      title: 'Round Trip',
      description: 'Two linked lanes with automatic return route',
      icon: ArrowLeftRight,
    },
    {
      type: 'Circuit' as const,
      title: 'Circuit',
      description: 'Two linked lanes with market-based routing',
      icon: Route,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl rounded-lg shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Select Trip Type</h2>
          <p className="text-sm text-gray-500 mt-1">Choose the type of lane you want to create</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-4">
            {tripTypes.map(({ type, title, description, icon: Icon }) => (
              <button
                key={type}
                onClick={() => onSelect(type, splitBilling)}
                className={`
                  w-full p-5 rounded-lg border-2 transition-all text-left
                  hover:shadow-md hover:scale-[1.02]
                  ${colorScheme === 'blue' ? 'border-blue-400 hover:border-blue-500 hover:bg-blue-50' : ''}
                  ${colorScheme === 'green' ? 'border-green-400 hover:border-green-500 hover:bg-green-50' : ''}
                  ${colorScheme === 'violet' ? 'border-violet-400 hover:border-violet-500 hover:bg-violet-50' : ''}
                `}
              >
                <div className="flex items-start gap-4">
                  <div className={`
                    p-3 rounded-lg
                    ${colorScheme === 'blue' ? 'bg-blue-100 text-blue-600' : ''}
                    ${colorScheme === 'green' ? 'bg-green-100 text-green-600' : ''}
                    ${colorScheme === 'violet' ? 'bg-violet-100 text-violet-600' : ''}
                  `}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
                    <p className="text-sm text-gray-600">{description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          {showSplitBilling && (
            <div className="mb-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={splitBilling}
                  onChange={(e) => setSplitBilling(e.target.checked)}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">Split Billing — separate MX and US portions</span>
              </label>
            </div>
          )}
          <div className="flex justify-between">
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              &#8592; Back
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
