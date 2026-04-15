import { useEffect } from 'react';
import { CheckCircle, X, AlertCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, type === 'error' ? 5000 : 3000);

    return () => clearTimeout(timer);
  }, [onClose, type]);

  const iconMap = {
    success: <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />,
  };

  const bgColorMap = {
    success: 'bg-white border-gray-200',
    error: 'bg-red-50 border-red-300',
    info: 'bg-blue-50 border-blue-300',
  };

  const positionClass = type === 'error' ? 'top-6' : 'bottom-6';

  return (
    <div className={`fixed ${positionClass} right-6 z-50 animate-slide-up`}>
      <div className={`${bgColorMap[type]} rounded-lg shadow-lg border px-4 py-3 flex items-center gap-3 min-w-[300px] max-w-[500px]`}>
        {iconMap[type]}
        <p className="text-sm text-gray-900 flex-1">{message}</p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
