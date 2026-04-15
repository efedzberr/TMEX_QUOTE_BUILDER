import { AdminCrudTable, ColumnDef } from './AdminCrudTable';

const COLUMNS: ColumnDef[] = [
  { key: 'Id', label: 'ID', type: 'text', required: true, isPrimary: true },
  { key: 'Name', label: 'Name', type: 'text' },
  { key: 'Origin City', label: 'Origin City', type: 'text' },
  { key: 'Origin State', label: 'Origin State', type: 'text' },
  { key: 'Origin Zip Code', label: 'Origin Zip Code', type: 'text' },
  { key: 'Destination City', label: 'Destination City', type: 'text' },
  { key: 'Destination State', label: 'Destination State', type: 'text' },
  { key: 'Destination Zip Code', label: 'Destination Zip Code', type: 'text' },
  { key: 'Equipment Type', label: 'Equipment Type', type: 'text' },
  { key: 'Cross Border', label: 'Cross Border', type: 'text' },
  { key: 'SB NB', label: 'SB/NB', type: 'text' },
  { key: 'Currency', label: 'Currency', type: 'text' },
  { key: 'Miles', label: 'Miles', type: 'text' },
  { key: 'KM', label: 'KM', type: 'text' },
  { key: 'All In Rate', label: 'All In Rate', type: 'number' },
  { key: 'USD Rate', label: 'USD Rate', type: 'number' },
  { key: 'Fuel', label: 'Fuel', type: 'text' },
  { key: 'FSC', label: 'FSC', type: 'text' },
  { key: 'Crossing Fee', label: 'Crossing Fee', type: 'text' },
  { key: 'Exchange Rate', label: 'Exchange Rate', type: 'text' },
  { key: 'Date Rate', label: 'Date Rate', type: 'text' },
  { key: 'Valid Rate', label: 'Valid Rate', type: 'text' },
  { key: 'Carrier Name', label: 'Carrier Name', type: 'number' },
];

interface MarketInformationTabProps {
  onToast?: (message: string, type: 'success' | 'error') => void;
}

export function MarketInformationTab({ onToast }: MarketInformationTabProps) {
  return (
    <AdminCrudTable
      tableName="Market Information"
      displayName="Market Information"
      columns={COLUMNS}
      primaryKey="Id"
      onToast={onToast}
    />
  );
}
