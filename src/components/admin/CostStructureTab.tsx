import { AdminCrudTable, ColumnDef } from './AdminCrudTable';

const COLUMNS: ColumnDef[] = [
  { key: 'Id', label: 'ID', type: 'text', required: true, isPrimary: true },
  { key: 'Name', label: 'Name', type: 'text' },
  { key: 'Equipment Type', label: 'Equipment Type', type: 'text' },
  { key: 'Crossing Border City', label: 'Crossing Border City', type: 'text' },
  { key: 'Driver Wages Mileage Pay', label: 'Driver Wages Mileage Pay', type: 'text' },
  { key: 'Driver Wages Accessorial Other', label: 'Driver Wages Accessorial Other', type: 'text' },
  { key: 'Transmex Driver Benefits', label: 'Transmex Driver Benefits', type: 'text' },
  { key: 'Fuel Expense', label: 'Fuel Expense', type: 'text' },
  { key: 'Fuel Mileage Taxes', label: 'Fuel Mileage Taxes', type: 'text' },
  { key: 'Road Expenses Tolls', label: 'Road Expenses Tolls', type: 'text' },
  { key: 'Total Equipment Maintenance', label: 'Total Equipment Maintenance', type: 'text' },
  { key: 'Trailer Lease Expense', label: 'Trailer Lease Expense', type: 'text' },
  { key: 'Trailer Washout', label: 'Trailer Washout', type: 'text' },
  { key: 'Load Tie Down Protection', label: 'Load Tie Down Protection', type: 'text' },
  { key: 'Insurance', label: 'Insurance', type: 'text' },
  { key: 'Collision Self Ins', label: 'Collision Self Ins', type: 'text' },
  { key: 'Self Insurance Claims', label: 'Self Insurance Claims', type: 'text' },
  { key: 'Insurance Bonds Filings', label: 'Insurance Bonds Filings', type: 'text' },
  { key: 'Purchased Transportation', label: 'Purchased Transportation', type: 'text' },
  { key: 'Transmex Allocation', label: 'Transmex Allocation', type: 'text' },
  { key: 'Gain on Disposal', label: 'Gain on Disposal', type: 'text' },
  { key: 'Total Fixed Operating Expense', label: 'Total Fixed Operating Expense', type: 'text' },
  { key: 'Total Cost No Fuel', label: 'Total Cost No Fuel', type: 'text' },
  { key: 'CV CF No Fuel', label: 'CV CF No Fuel', type: 'text' },
];

interface CostStructureTabProps {
  onToast?: (message: string, type: 'success' | 'error') => void;
}

export function CostStructureTab({ onToast }: CostStructureTabProps) {
  return (
    <AdminCrudTable
      tableName="Cost Structure"
      displayName="Cost Structure"
      columns={COLUMNS}
      primaryKey="Id"
      onToast={onToast}
    />
  );
}
