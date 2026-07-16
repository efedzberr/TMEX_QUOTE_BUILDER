import { useState, useEffect } from 'react';
import { FileText, DollarSign, Package, CheckCircle, Plus, ArrowRight } from 'lucide-react';
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
import type { ViewMode } from '../Sidebar';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// TODO: replace with logged-in user when auth exists
const CURRENT_USER_NAME = 'Susana Guajardo';

const STAGE_COLORS: Record<string, string> = {
  'New': 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800',
  'Branch Manager Approval': 'bg-orange-100 text-orange-800',
  'Sent to Customer': 'bg-teal-100 text-teal-800',
  'Published': 'bg-gray-100 text-gray-800',
};

const STAGE_BAR_COLORS: Record<string, string> = {
  'New': '#3B82F6',
  'In Progress': '#F59E0B',
  'Completed': '#10B981',
  'Branch Manager Approval': '#F97316',
  'Sent to Customer': '#14B8A6',
  'Published': '#6B7280',
};

const ALL_STAGES = ['New', 'In Progress', 'Sent to Customer', 'Completed', 'Branch Manager Approval', 'Published'];

interface DashboardViewProps {
  onNavigate: (v: ViewMode) => void;
  onCreateQuote: () => void;
  onOpenQuote: (quoteId: string) => void;
}

interface DashboardData {
  quotes: Quote[];
  totalLanes: number;
  recentLaneCounts: Record<string, number>;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DashboardView({ onNavigate, onCreateQuote, onOpenQuote }: DashboardViewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
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

    const { count: laneCount } = await supabase
      .from('quote_lanes')
      .select('*', { count: 'exact', head: true });

    const recentIds = (quotes || []).slice(0, 10).map(q => q.id);
    let recentLaneCounts: Record<string, number> = {};
    if (recentIds.length > 0) {
      const { data: recentLanes } = await supabase
        .from('quote_lanes')
        .select('quote_id')
        .in('quote_id', recentIds);
      if (recentLanes) {
        recentLanes.forEach(l => {
          recentLaneCounts[l.quote_id] = (recentLaneCounts[l.quote_id] || 0) + 1;
        });
      }
    }

    setData({
      quotes: quotes || [],
      totalLanes: laneCount || 0,
      recentLaneCounts,
    });
    setLoading(false);
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Cargando dashboard...</span>
        </div>
      </div>
    );
  }

  const { quotes, totalLanes, recentLaneCounts } = data;
  const totalQuotes = quotes.length;
  // TODO: multi-currency — currently sums total_amount across all currencies as a simplification
  const totalValue = quotes.reduce((s, q) => s + (q.total_amount || 0), 0);
  const avgTicket = totalQuotes > 0 ? totalValue / totalQuotes : 0;
  const lanesPerQuote = totalQuotes > 0 ? totalLanes / totalQuotes : 0;
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
  const recentQuotes = quotes.slice(0, 10);

  const now = new Date();
  const greeting = getGreeting(now);
  const longDate = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-6">

        {/* HERO BAND */}
        <div
          className="rounded-2xl px-8 py-8 text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0F2A5C 0%, #1D4ED8 100%)' }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-sm text-blue-200 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              {greeting} &middot; {longDate} &middot; {timeStr}
            </div>
            <h1 className="text-2xl font-bold mb-1">
              Hola, {CURRENT_USER_NAME}. &iquest;Qu&eacute; cotizamos hoy?
            </h1>
            <p className="text-sm text-blue-200 mb-5">
              Aqu&iacute; tienes el resumen de tu actividad reciente y tus cotizaciones en curso.
            </p>
            <button
              onClick={onCreateQuote}
              className="inline-flex items-center gap-2 bg-white text-blue-700 font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-blue-50 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nueva cotizaci&oacute;n
            </button>
          </div>
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-1/2 w-48 h-48 bg-white/5 rounded-full translate-y-1/2" />
        </div>

        {/* KPI ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <KpiCard
            icon={<FileText className="w-5 h-5 text-blue-600" />}
            chipColor="bg-blue-50"
            value={totalQuotes.toString()}
            label="COTIZACIONES"
            sub="cotizaciones en total"
          />
          <KpiCard
            icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
            chipColor="bg-emerald-50"
            value={formatCurrency(totalValue)}
            label="VALOR TOTAL"
            sub={`ticket prom. ${formatCurrency(avgTicket)}`}
          />
          <KpiCard
            icon={<Package className="w-5 h-5 text-amber-600" />}
            chipColor="bg-amber-50"
            value={lanesPerQuote.toFixed(1)}
            label="LANES / COTIZACIÓN"
            sub={`${totalLanes} lanes totales`}
          />
          <KpiCard
            icon={<CheckCircle className="w-5 h-5 text-teal-600" />}
            chipColor="bg-teal-50"
            value={`${acceptanceRate}%`}
            label="TASA DE ACEPTACIÓN"
            sub={`${acceptedQuotes.length} de ${sentQuotes.length}`}
          />
        </div>

        {/* CHARTS ROW */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <StageDistributionChart stageCounts={stageCounts} totalQuotes={totalQuotes} />
          <AcceptanceDoughnut accepted={acceptedQuotes.length} sent={sentQuotes.length} rate={acceptanceRate} />
          <MonthlyBarChart buckets={monthlyBuckets} />
        </div>

        {/* RECENT QUOTES TABLE */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Propuestas recientes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cliente / Propuesta</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Lanes</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Estatus</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentQuotes.map(q => (
                  <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-gray-900">{q.partner_account || 'Sin cliente'}</div>
                      <div className="text-xs text-gray-500">{q.quote_number}</div>
                    </td>
                    <td className="px-5 py-3 text-center text-sm text-gray-700">{recentLaneCounts[q.id] || 0}</td>
                    <td className="px-5 py-3 text-right text-sm font-medium text-gray-900">{formatFullCurrency(q.total_amount || 0)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[q.stage || 'New'] || STAGE_COLORS['New']}`}>
                        {q.stage || 'New'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{formatDate(q.created_at)}</td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => onOpenQuote(q.id)}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
                {recentQuotes.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">No hay cotizaciones a&uacute;n.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-gray-100">
            <button
              onClick={() => onNavigate('list')}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
              Ver todas las cotizaciones
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* === Sub-components === */

function KpiCard({ icon, chipColor, value, label, sub }: { icon: React.ReactNode; chipColor: string; value: string; label: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-5">
      <div className={`w-9 h-9 rounded-lg ${chipColor} flex items-center justify-center mb-3`}>{icon}</div>
      <div className="text-2xl font-bold text-gray-900 mb-0.5">{value}</div>
      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
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
        height={200}
      />
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
        height={200}
      />
    </div>
  );
}

/* === Helpers === */

function getGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Buenos d\u00edas';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
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
