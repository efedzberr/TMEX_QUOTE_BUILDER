import { X, AlertTriangle, ChevronRight, FileText } from 'lucide-react';
import { CompletedStageValidationResult } from '../lib/completedStageValidation';

interface CompletedValidationModalProps {
  result: CompletedStageValidationResult;
  onClose: () => void;
  onOpenLane: (laneId: string) => void;
}

export function CompletedValidationModal({ result, onClose, onOpenLane }: CompletedValidationModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[600px] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-red-50 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Cannot mark quote as Completed</h2>
              <p className="text-xs text-gray-600 mt-0.5">
                Please fix the following issues before changing the stage to Completed:
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {result.headerErrors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Quote Header
              </h3>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                {result.headerErrors.map((err) => (
                  <div key={err.field} className="flex items-start gap-2 text-sm text-gray-700">
                    <ChevronRight className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <span><span className="font-medium">{err.label}</span> is required</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.laneCountError && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Lanes
              </h3>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start gap-2 text-sm text-gray-700">
                  <ChevronRight className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span>{result.laneCountError}</span>
                </div>
              </div>
            </div>
          )}

          {result.laneErrors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Lane Errors
              </h3>
              <div className="space-y-3">
                {result.laneErrors.map((laneResult) => (
                  <div key={laneResult.laneId} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">
                        Lane {laneResult.laneIndex + 1} — {laneResult.serviceType} {laneResult.tripType}
                      </span>
                      <button
                        onClick={() => onOpenLane(laneResult.laneId)}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        Open Lane Details
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {laneResult.errors.map((err) => (
                        <div key={err.field} className="flex items-start gap-2 text-sm text-gray-700">
                          <ChevronRight className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                          <span><span className="font-medium">{err.label}</span> is required</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-600">
              {result.totalIssues} issue{result.totalIssues !== 1 ? 's' : ''} found
              {result.lanesWithIssues > 0 && (
                <> across {result.lanesWithIssues} lane{result.lanesWithIssues !== 1 ? 's' : ''}</>
              )}
              {result.headerErrors.length > 0 && (
                <>{result.lanesWithIssues > 0 ? ' and' : ' in'} the quote header</>
              )}
              . Please resolve all issues before completing this quote.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
