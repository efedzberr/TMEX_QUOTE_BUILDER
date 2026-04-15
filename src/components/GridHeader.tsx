interface GridHeaderProps {
  showStopsBefore?: boolean;
  showStopsAfter?: boolean;
}

const GENERAL_HEADER = { bg: '#F3F4F6', text: '#374151' };
const US_HEADER = { bg: '#DBEAFE', text: '#1E40AF' };
const MX_HEADER = { bg: '#DCFCE7', text: '#166534' };

export function GridHeader({ showStopsBefore, showStopsAfter }: GridHeaderProps) {
  const thBase = 'px-3 py-2 text-left text-[10px] font-semibold uppercase whitespace-nowrap';
  const generalTh = `${thBase}`;
  const usTh = `${thBase}`;
  const mxTh = `${thBase}`;
  const separatorStyle = { borderRight: '2px solid #D1D5DB' };

  return (
    <tr>
      <th style={{ minWidth: '48px', backgroundColor: GENERAL_HEADER.bg, color: GENERAL_HEADER.text }} className={generalTh}>#</th>
      <th style={{ minWidth: '128px', backgroundColor: GENERAL_HEADER.bg, color: GENERAL_HEADER.text }} className={generalTh}>Origin City</th>
      {showStopsBefore && (
        <th style={{ minWidth: '64px', backgroundColor: GENERAL_HEADER.bg, color: GENERAL_HEADER.text }} className={generalTh}>Stops Before</th>
      )}
      {showStopsAfter && (
        <th style={{ minWidth: '64px', backgroundColor: GENERAL_HEADER.bg, color: GENERAL_HEADER.text }} className={generalTh}>Stops After</th>
      )}
      <th style={{ minWidth: '128px', backgroundColor: GENERAL_HEADER.bg, color: GENERAL_HEADER.text }} className={generalTh}>Destination City</th>
      <th style={{ minWidth: '128px', backgroundColor: GENERAL_HEADER.bg, color: GENERAL_HEADER.text }} className={generalTh}>Border Crossing City</th>
      <th style={{ minWidth: '100px', backgroundColor: GENERAL_HEADER.bg, color: GENERAL_HEADER.text }} className={generalTh}>Border Crossing Fee</th>
      <th style={{ minWidth: '120px', backgroundColor: GENERAL_HEADER.bg, color: GENERAL_HEADER.text, ...separatorStyle }} className={generalTh}>Lane Total</th>

      <th style={{ minWidth: '80px', backgroundColor: US_HEADER.bg, color: US_HEADER.text }} className={usTh}>US Miles</th>
      <th style={{ minWidth: '100px', backgroundColor: US_HEADER.bg, color: US_HEADER.text }} className={usTh}>US Fuel Rate Per Mile</th>
      <th style={{ minWidth: '100px', backgroundColor: US_HEADER.bg, color: US_HEADER.text }} className={usTh}>US Line Haul</th>
      <th style={{ minWidth: '100px', backgroundColor: US_HEADER.bg, color: US_HEADER.text }} className={usTh}>US Rate Per Mile</th>
      <th style={{ minWidth: '80px', backgroundColor: US_HEADER.bg, color: US_HEADER.text }} className={usTh}>US Rate Type</th>
      <th style={{ minWidth: '100px', backgroundColor: US_HEADER.bg, color: US_HEADER.text }} className={usTh}>Total US Fuel</th>
      <th style={{ minWidth: '100px', backgroundColor: US_HEADER.bg, color: US_HEADER.text }} className={usTh}>Total US Fixed Costs</th>
      <th style={{ minWidth: '100px', backgroundColor: US_HEADER.bg, color: US_HEADER.text }} className={usTh}>Total US Variable Costs</th>
      <th style={{ minWidth: '100px', backgroundColor: US_HEADER.bg, color: US_HEADER.text, ...separatorStyle }} className={usTh}>Total US Portion</th>

      <th style={{ minWidth: '80px', backgroundColor: MX_HEADER.bg, color: MX_HEADER.text }} className={mxTh}>MX Miles</th>
      <th style={{ minWidth: '100px', backgroundColor: MX_HEADER.bg, color: MX_HEADER.text }} className={mxTh}>MX Fuel Rate Per Mile</th>
      <th style={{ minWidth: '100px', backgroundColor: MX_HEADER.bg, color: MX_HEADER.text }} className={mxTh}>MX Line Haul</th>
      <th style={{ minWidth: '100px', backgroundColor: MX_HEADER.bg, color: MX_HEADER.text }} className={mxTh}>MX Rate Per Mile</th>
      <th style={{ minWidth: '80px', backgroundColor: MX_HEADER.bg, color: MX_HEADER.text }} className={mxTh}>MX Rate Type</th>
      <th style={{ minWidth: '100px', backgroundColor: MX_HEADER.bg, color: MX_HEADER.text }} className={mxTh}>Total MX Fuel</th>
      <th style={{ minWidth: '100px', backgroundColor: MX_HEADER.bg, color: MX_HEADER.text }} className={mxTh}>Total MX Fixed Costs</th>
      <th style={{ minWidth: '100px', backgroundColor: MX_HEADER.bg, color: MX_HEADER.text }} className={mxTh}>Total MX Variable Costs</th>
      <th style={{ minWidth: '100px', backgroundColor: MX_HEADER.bg, color: MX_HEADER.text, ...separatorStyle }} className={mxTh}>Total MX Portion</th>

      <th style={{ minWidth: '120px', backgroundColor: GENERAL_HEADER.bg, color: GENERAL_HEADER.text }} className={generalTh}>Lane Total</th>
      <th style={{ minWidth: '100px', backgroundColor: GENERAL_HEADER.bg, color: GENERAL_HEADER.text }} className={generalTh}>Actions</th>
    </tr>
  );
}
