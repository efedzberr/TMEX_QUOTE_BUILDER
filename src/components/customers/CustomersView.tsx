import { CustomersTable } from './CustomersTable';

export function CustomersView() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-8 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="mt-1 text-sm text-gray-500">Manage partner accounts and customer information.</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <CustomersTable />
        </div>
      </div>
    </div>
  );
}
