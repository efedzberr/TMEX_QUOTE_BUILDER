interface SplitBillingModalProps {
  tripType: 'One Way' | 'Round Trip' | 'Circuit';
  onYes: () => void;
  onNo: () => void;
  onClose: () => void;
}

export function SplitBillingModal({ tripType, onYes, onNo, onClose }: SplitBillingModalProps) {
  const getTripTypeDescription = () => {
    if (tripType === 'One Way') return 'This will create 2 linked lanes (one for Mexico, one for the US)';
    if (tripType === 'Round Trip') return 'This will create 4 linked lanes (Mexico outbound, US outbound, US return, Mexico return)';
    if (tripType === 'Circuit') return 'This will create 4 linked lanes with market-based routing';
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-lg shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Is this a Split Billing quote?</h2>
          <p className="text-sm text-gray-500 mt-1">Split Billing separates the Mexican and US portions of your shipment</p>
        </div>

        <div className="p-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-900">{getTripTypeDescription()}</p>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
          <button
            onClick={onNo}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            No
          </button>
          <button
            onClick={onYes}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
