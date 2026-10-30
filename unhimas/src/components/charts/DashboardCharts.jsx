import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts';

const COLORS = {
  primary: '#112f42',
  secondary: '#b70032',
  blue: '#0284c7',
  green: '#059669',
  amber: '#d97706',
  purple: '#7c3aed',
  slate: '#64748b',
  teal: '#0d9488',
};

const PIE_PALETTE = [
  COLORS.blue,
  COLORS.green,
  COLORS.amber,
  COLORS.secondary,
  COLORS.purple,
  COLORS.teal,
  COLORS.slate,
];

const tooltipStyle = {
  background: 'var(--color-surface, #fff)',
  border: '1px solid var(--color-border, #e2e8f0)',
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
};

function ChartCard({ title, subtitle, children, height = 260 }) {
  return (
    <div className="card chart-card">
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          {subtitle ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 4, paddingBottom: 8 }}>
        <div style={{ width: '100%', height }} role="img" aria-label={title}>
          {children}
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ label }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-text-muted)',
        fontSize: '0.875rem',
      }}
    >
      {label}
    </div>
  );
}

/** Horizontal-ish department enrollment bars */
export function EnrollmentBarChart({ data = [], emptyLabel = 'No enrollment data' }) {
  const rows = (data || []).filter((d) => d.students > 0 || data.length <= 8);
  if (!rows.length) return <EmptyChart label={emptyLabel} />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(17,47,66,0.04)' }} />
        <Bar dataKey="students" name="Students" fill={COLORS.primary} radius={[6, 6, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Marks / workflow status distribution */
export function StatusPieChart({
  data = [],
  nameKey = 'label',
  valueKey = 'count',
  emptyLabel = 'No data yet',
}) {
  const rows = (data || []).filter((d) => Number(d[valueKey]) > 0);
  if (!rows.length) return <EmptyChart label={emptyLabel} />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={rows}
          dataKey={valueKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={80}
          paddingAngle={2}
          stroke="none"
        >
          {rows.map((_, i) => (
            <Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          formatter={(value) => <span style={{ fontSize: 12, color: 'var(--color-text)' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Simple stacked or dual bar for finance snapshot */
export function FinanceBarChart({ data = [], emptyLabel = 'No fee data' }) {
  if (!data?.length) return <EmptyChart label={emptyLabel} />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(v) =>
            v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : v
          }
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) =>
            new Intl.NumberFormat('fr-CM', {
              style: 'currency',
              currency: 'XAF',
              maximumFractionDigits: 0,
            }).format(Number(value) || 0)
          }
        />
        <Bar dataKey="invoiced" name="Invoiced" fill={COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="paid" name="Paid" fill={COLORS.green} radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="outstanding" name="Outstanding" fill={COLORS.secondary} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Teaching hours trend */
export function HoursAreaChart({ data = [], emptyLabel = 'No hours recorded' }) {
  if (!data?.length) return <EmptyChart label={emptyLabel} />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="hoursFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS.teal} stopOpacity={0.35} />
            <stop offset="100%" stopColor={COLORS.teal} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
        <YAxis
          allowDecimals
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          axisLine={false}
          tickLine={false}
          width={36}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="hours"
          name="Hours"
          stroke={COLORS.teal}
          fill="url(#hoursFill)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export { ChartCard, COLORS };
