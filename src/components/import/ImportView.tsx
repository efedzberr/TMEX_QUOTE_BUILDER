import { Upload } from 'lucide-react';

export function ImportView() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1200px] mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Import</h1>
          <p className="mt-1 text-sm text-gray-500">Upload market, cost structure, and quote files.</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm px-6 py-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Upload className="w-6 h-6 text-gray-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-700 mb-1">Import tool coming soon</h2>
          <p className="text-sm text-gray-500 max-w-sm">
            You will be able to upload Excel and CSV files to bulk-update market data, cost structures, and quotes.
          </p>
        </div>
      </div>
    </div>
  );
}
