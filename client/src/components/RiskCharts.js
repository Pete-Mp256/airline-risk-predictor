import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// Same colours as the risk badges. The level is always written next to the colour too.
export const RISK_COLORS = { Low: '#10b981', Medium: '#f59e0b', High: '#dc2626', not_predicted: '#94a3b8' };

const SERIES = [
  { key: 'Low', label: 'Low' },
  { key: 'Medium', label: 'Medium' },
  { key: 'High', label: 'High' },
  { key: 'not_predicted', label: 'Not predicted' },
];

const AXIS_TICK = { fontSize: 12, fill: '#64748b' };
const GRID = '#e2e8f0';

// "Not predicted" is only drawn when some row has it.
function seriesFor(rows) {
  return SERIES.filter((s) => s.key !== 'not_predicted' || rows.some((r) => r.not_predicted > 0));
}

function Swatch({ color }) {
  return <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} aria-hidden="true" />;
}

export function RiskLegend({ series = SERIES }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5"><Swatch color={RISK_COLORS[s.key]} />{s.label}</li>
      ))}
    </ul>
  );
}

function RiskTooltip({ active, payload, label, formatCategory }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[9rem] rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200">
      <p className="mb-1 font-semibold text-slate-800">{formatCategory(label)}</p>
      {payload.filter((p) => p.value > 0).reverse().map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <Swatch color={p.color} />{p.name}
          <span className="ml-auto font-medium tabular-nums text-slate-800">{p.value}</span>
        </p>
      ))}
      <p className="mt-1 flex border-t border-slate-100 pt-1 text-slate-600">
        Total<span className="ml-auto font-medium tabular-nums text-slate-800">{payload[0].payload.total}</span>
      </p>
    </div>
  );
}

// A count that lists its incidents when clicked (plain text when zero or not clickable).
function CountButton({ value, onClick, label, className = '' }) {
  if (!onClick || !value) return <span className={className}>{value}</span>;
  return (
    <button type="button" className={`link tabular-nums ${className}`} onClick={onClick} aria-label={label}>
      {value}
    </button>
  );
}

// Risk counts per category (day, department or shift type), stacked Low -> High.
// horizontal: bars run left to right with the categories down the side (for long names).
// onSelect(row, riskKey) is called when a bar segment is clicked.
export function StackedRiskBars({ rows, categoryKey, formatCategory = (v) => v, horizontal = false, onSelect }) {
  const series = seriesFor(rows);
  const height = horizontal ? Math.max(140, rows.length * 44 + 40) : 260;
  const top = series[series.length - 1].key;
  const category = { dataKey: categoryKey, type: 'category', tick: AXIS_TICK, tickLine: false, axisLine: false,
    tickFormatter: formatCategory };
  const value = { type: 'number', allowDecimals: false, tick: AXIS_TICK, tickLine: false, axisLine: false };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RiskLegend series={series} />
        {onSelect && <p className="text-xs text-slate-400">Click a bar to list its incidents</p>}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis {...value} />
              <YAxis {...category} width={128} />
            </>
          ) : (
            <>
              <XAxis {...category} minTickGap={16} />
              <YAxis {...value} width={28} />
            </>
          )}
          <Tooltip cursor={{ fill: '#f1f5f9' }} content={<RiskTooltip formatCategory={formatCategory} />} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="risk" fill={RISK_COLORS[s.key]}
              stroke="#fff" strokeWidth={1} maxBarSize={28} isAnimationActive={false}
              className={onSelect ? 'cursor-pointer' : undefined}
              onClick={onSelect && ((bar) => onSelect(bar.payload, s.key))}
              radius={s.key === top ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Share of predicted incidents at each risk level, with the counts written beside it.
// onSelect(riskLevel) is called when a slice or a count is clicked.
export function RiskDonut({ byRisk, onSelect }) {
  const total = byRisk.reduce((sum, r) => sum + r.count, 0);
  const slices = byRisk.filter((r) => r.count > 0);

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <div className="relative h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="count" nameKey="risk_level" innerRadius="62%" outerRadius="100%"
              paddingAngle={slices.length > 1 ? 2 : 0} stroke="#fff" strokeWidth={2} isAnimationActive={false}
              className={onSelect ? 'cursor-pointer' : undefined}
              onClick={onSelect && ((slice) => onSelect(slice.payload?.risk_level ?? slice.risk_level))}>
              {slices.map((r) => <Cell key={r.risk_level} fill={RISK_COLORS[r.risk_level]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{total}</span>
          <span className="text-xs text-slate-500">predicted</span>
        </div>
      </div>
      <ul className="space-y-2 text-sm">
        {[...byRisk].reverse().map((r) => (
          <li key={r.risk_level} className="flex items-center gap-2 text-slate-600">
            <Swatch color={RISK_COLORS[r.risk_level]} />
            <span className="w-16">{r.risk_level}</span>
            <CountButton value={r.count} className="w-6 text-right font-semibold text-slate-900"
              onClick={onSelect && (() => onSelect(r.risk_level))} label={`List ${r.count} ${r.risk_level} risk incidents`} />
            <span className="w-10 text-right text-xs tabular-nums text-slate-500">
              {total ? `${Math.round((r.count / total) * 100)}%` : '–'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Table view of the same counts, for reading exact numbers.
// onSelect(row, riskKey) is called when a count is clicked (riskKey null for the total).
export function RiskTable({ rows, categoryKey, categoryLabel, formatCategory = (v) => v, onSelect }) {
  const series = seriesFor(rows);
  return (
    <div className="max-h-72 overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="py-2 pr-3 font-medium">{categoryLabel}</th>
            {series.map((s) => <th key={s.key} scope="col" className="px-2 py-2 text-right font-medium">{s.label}</th>)}
            <th scope="col" className="py-2 pl-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 tabular-nums">
          {rows.map((r) => (
            <tr key={r[categoryKey]}>
              <th scope="row" className="py-1.5 pr-3 font-normal text-slate-700">{formatCategory(r[categoryKey])}</th>
              {series.map((s) => (
                <td key={s.key} className="px-2 py-1.5 text-right">
                  <CountButton value={r[s.key]} onClick={onSelect && (() => onSelect(r, s.key))}
                    label={`List ${r[s.key]} ${s.label} incidents for ${formatCategory(r[categoryKey])}`} />
                </td>
              ))}
              <td className="py-1.5 pl-2 text-right font-semibold">
                <CountButton value={r.total} onClick={onSelect && (() => onSelect(r, null))}
                  label={`List all ${r.total} incidents for ${formatCategory(r[categoryKey])}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Grey card with a title and a chart/table switch.
export function ChartCard({ title, table, className = '', children }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`card min-w-0 ${className}`} aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="section-title">{title}</h2>
        {table && (
          <button type="button" className="link text-xs" aria-pressed={showTable}
            onClick={() => setShowTable((v) => !v)}>
            {showTable ? 'Show chart' : 'Show table'}
          </button>
        )}
      </div>
      <div className="tile">{showTable ? table : children}</div>
    </section>
  );
}
