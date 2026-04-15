import { GitBranch, MapPin, Truck } from 'lucide-react';

interface ServiceTypeModalProps {
  onSelect: (serviceType: 'Loop' | 'Door to Door' | 'Domestic') => void;
  onClose: () => void;
}

export function ServiceTypeModal({ onSelect, onClose }: ServiceTypeModalProps) {
  const serviceTypes = [
    {
      type: 'Loop' as const,
      title: 'Loop',
      description: 'Origin/destination involves only up to the border (US city ↔ Border, or Border ↔ MX city)',
      icon: GitBranch,
      color: 'blue',
    },
    {
      type: 'Door to Door' as const,
      title: 'Door to Door',
      description: 'Full cross-border route, US city ↔ MX city crossing the border, in either direction',
      icon: MapPin,
      color: 'green',
    },
    {
      type: 'Domestic' as const,
      title: 'Domestic',
      description: 'US only, US city ↔ US city, no border crossing',
      icon: Truck,
      color: 'purple',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl rounded-lg shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Select Service Type</h2>
          <p className="text-sm text-gray-500 mt-1">Choose the type of service for this lane</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 gap-4">
            {serviceTypes.map(({ type, title, description, icon: Icon, color }) => (
              <button
                key={type}
                onClick={() => onSelect(type)}
                className={`
                  w-full p-5 rounded-lg border-2 transition-all text-left
                  hover:shadow-md hover:scale-[1.02]
                  ${color === 'blue' ? 'border-blue-200 hover:border-blue-400 hover:bg-blue-50' : ''}
                  ${color === 'green' ? 'border-green-200 hover:border-green-400 hover:bg-green-50' : ''}
                  ${color === 'purple' ? 'border-purple-200 hover:border-purple-400 hover:bg-purple-50' : ''}
                `}
              >
                <div className="flex items-start gap-4">
                  <div className={`
                    p-3 rounded-lg
                    ${color === 'blue' ? 'bg-blue-100 text-blue-600' : ''}
                    ${color === 'green' ? 'bg-green-100 text-green-600' : ''}
                    ${color === 'purple' ? 'bg-purple-100 text-purple-600' : ''}
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

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
