import { AlertTriangle } from 'lucide-react';

interface LinkedLaneEditWarningProps {
  fieldName: string;
  tripType: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LinkedLaneEditWarning({ fieldName, tripType, onConfirm, onCancel }: LinkedLaneEditWarningProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onCancel} />
      <div className="relative bg-white w-full max-w-md rounded-lg shadow-2xl">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Linked Lane Field Change
              </h3>
              <p className="text-sm text-gray-600">
                This lane is part of a <span className="font-semibold">{tripType}</span> pair.
                Changing <span className="font-semibold">{fieldName}</span> will automatically
                update the corresponding field on the paired lane to keep both lanes in sync.
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Do you want to proceed?
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            Yes, Update Both Lanes
          </button>
        </div>
      </div>
    </div>
  );
}
