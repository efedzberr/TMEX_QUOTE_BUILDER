import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { supabase, Quote } from '../../lib/supabase';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const STAGE_BAR_COLORS: Record<string, string> = {
  'New': '#3B82F6',
  'In Progress': '#F59E0B',
  'Completed': '#10B981',
  'Branch Manager Approval': '#F97316',
  'Sent to Customer': '#14B8A6',
  'Published': '#6B7280',
};

const ALL_STAGES = ['New', 'In Progress', 'Sent to Customer', 'Completed', 'Branch Manager Approval', 'Published'];

interface DashboardsData {
  quotes: Quote[];
}

export function DashboardsView() {
  const [data, setData] = useState<DashboardsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: quotes } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false });
    setData({ quotes: quotes || [] });
    setLoading(false);
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Cargando dashboards...</span>
        </div>
      </div>
    );
  }

  const { quotes } = data;
  const totalQuotes = quotes.length;

  const sentQuotes = quotes.filter(q => q.customer_review_status === 'sent' || q.stage === 'Sent to Customer' || q.customer_review_status === 'responded');
  const acceptedQuotes = quotes.filter(q => q.customer_review_status === 'responded' && q.stage === 'Completed');
  const acceptanceRate = sentQuotes.length > 0 ? Math.round((acceptedQuotes.length / sentQuotes.length) * 100) : 0;

  const stageCounts: Record<string, number> = {};
  ALL_STAGES.forEach(s => { stageCounts[s] = 0; });
  quotes.forEach(q => {
    const stage = q.stage || 'New';
    if (stageCounts[stage] !== undefined) stageCounts[stage]++;
    else stageCounts[stage] = 1;
  });

  const monthlyBuckets = getMonthlyBuckets(quotes);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboards de desempe&ntilde;o</h1>
          <p className="text-sm text-gray-500 mt-1">
            Indicadores de tus cotizaciones: distribuci&oacute;n por etapa, tasa de aceptaci&oacute;n y volumen mensual.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <StageDistributionChart stageCounts={stageCounts} totalQuotes={totalQuotes} />
          <AcceptanceDoughnut accepted={acceptedQuotes.length} sent={sentQuotes.length} rate={acceptanceRate} />
          <MonthlyBarChart buckets={monthlyBuckets} />
        </div>
      </div>
    </div>
  );
}

function StageDistributionChart({ stageCounts, totalQuotes }: { stageCounts: Record<string, number>; totalQuotes: number }) {
  const labels = ALL_STAGES;
  const values = labels.map(s => stageCounts[s] || 0);
  const colors = labels.map(s => STAGE_BAR_COLORS[s] || '#6B7280');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribuci&oacute;n por etapa</h3>
      <div style={{ height: 240 }}>
        <Bar
          data={{
            labels,
            datasets: [{
              data: values,
              backgroundColor: colors,
              borderRadius: 4,
              barThickness: 18,
            }],
          }}
          options={{
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const v = ctx.raw as number;
                    const pct = totalQuotes > 0 ? Math.round((v / totalQuotes) * 100) : 0;
                    return `${v} (${pct}%)`;
                  },
                },
              },
            },
            scales: {
              x: { display: false, grid: { display: false } },
              y: {
                grid: { display: false },
                ticks: { font: { size: 11 }, color: '#6B7280' },
              },
            },
          }}
        />
      </div>
    </div>
  );
}

function AcceptanceDoughnut({ accepted, sent, rate }: { accepted: number; sent: number; rate: number }) {
  const notAccepted = Math.max(0, sent - accepted);
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col items-center">
      <h3 className="text-sm font-semibold text-gray-900 mb-4 self-start">Tasa de aceptaci&oacute;n</h3>
      <div className="relative w-40 h-40">
        <Doughnut
          data={{
            labels: ['Aceptadas', 'Pendientes'],
            datasets: [{
              data: [accepted, notAccepted],
              backgroundColor: ['#10B981', '#E5E7EB'],
              borderWidth: 0,
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            cutout: '70%',
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{rate}%</span>
          <span className="text-[10px] text-gray-500 uppercase">aceptaci&oacute;n</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />{accepted} aceptadas</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />{notAccepted} pendientes</span>
      </div>
    </div>
  );
}

function MonthlyBarChart({ buckets }: { buckets: { label: string; count: number }[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Cotizaciones por mes</h3>
      <div style={{ height: 240 }}>
        <Bar
          data={{
            labels: buckets.map(b => b.label),
            datasets: [{
              data: buckets.map(b => b.count),
              backgroundColor: '#3B82F6',
              borderRadius: 4,
              barThickness: 24,
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#6B7280' } },
              y: { beginAtZero: true, grid: { color: '#F3F4F6' }, ticks: { font: { size: 11 }, stepSize: 1, color: '#6B7280' } },
            },
          }}
        />
      </div>
    </div>
  );
}

function getMonthlyBuckets(quotes: Quote[]): { label: string; count: number }[] {
  const now = new Date();
  const buckets: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString('es-MX', { month: 'short' });
    const year = d.getFullYear();
    const month = d.getMonth();
    const count = quotes.filter(q => {
      const c = new Date(q.created_at);
      return c.getFullYear() === year && c.getMonth() === month;
    }).length;
    buckets.push({ label, count });
  }
  return buckets;
}
