import { ChevronRight } from 'lucide-react';

interface StageProgressBarProps {
  currentStage: string;
  onStageChange: (stage: string) => void;
}

const STAGES = [
  'New',
  'In Progress',
  'Completed',
  'Branch Manager Approval',
  'Sent to Customer',
  'Published',
];

export function StageProgressBar({ currentStage, onStageChange }: StageProgressBarProps) {
  const currentIndex = STAGES.indexOf(currentStage);

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-[1280px] mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {STAGES.map((stage, index) => {
            const isActive = index === currentIndex;
            const isCompleted = index < currentIndex;
            const isFuture = index > currentIndex;

            return (
              <div key={stage} className="flex items-center flex-1">
                <button
                  onClick={() => onStageChange(stage)}
                  className={`
                    relative flex items-center justify-center px-4 py-2 text-sm font-medium transition-all
                    ${isActive ? 'bg-[#1e3a8a] text-white z-10' : ''}
                    ${isCompleted ? 'bg-gray-200 text-gray-600' : ''}
                    ${isFuture ? 'bg-gray-100 text-gray-400' : ''}
                    ${index === 0 ? 'rounded-l-md' : ''}
                    ${index === STAGES.length - 1 ? 'rounded-r-md' : ''}
                    hover:opacity-80 w-full
                  `}
                  style={{
                    clipPath: index === STAGES.length - 1
                      ? undefined
                      : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)',
                    marginRight: index === STAGES.length - 1 ? 0 : '-12px',
                  }}
                >
                  <span className="relative z-10 whitespace-nowrap text-xs">
                    {stage}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
