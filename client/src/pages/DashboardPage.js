import { useEffect, useState } from 'react';
import api, { apiError } from '../api';
import DrillDownPanel from '../components/DrillDownPanel';
import PageHeader from '../components/PageHeader';
import {
  ChartCard, RISK_COLORS, RiskDonut, RiskTable, StackedRiskBars,
} from '../components/RiskCharts';
import Timeline from '../components/Timeline';
import { formatDate, formatDateTime, formatShortDate } from '../utils/format';

const RANGES = [7, 30, 90];

const RISK_LABELS = { Low: 'Low risk', Medium: 'Medium risk', High: 'High risk', not_predicted: 'Not predicted' };

// What the drill-down panel lists. risk: Low | Medium | High | not_predicted | null (all).
// row: optional chart row with shift_type, department_id + department, or day.
function incidentSelection(risk, row = {}) {
  const filters = {};
  const parts = [risk ? RISK_LABELS[risk] : 'All incidents'];
  if (risk) filters.risk_level = risk === 'not_predicted' ? 'none' : risk;
  if (row.shift_type) {
    filters.shift_type = row.shift_type;
    parts.push(`${row.shift_type} shift`);
  }
  if (row.department_id) {
    filters.department_id = row.department_id;
    parts.push(row.department);
  }
  if (row.day) {
    filters.day = row.day;
    parts.push(formatDate(row.day));
  }
  return { kind: 'incidents', id: `incidents:${JSON.stringify(filters)}`, filters, label: parts.join(' · ') };
}

const OPEN_TASKS = { kind: 'tasks', id: 'tasks', filters: {}, label: 'Open tasks' };

// A number tile; clicking it lists what was counted. note: optional extra count with its own action.
function StatTile({ label, value, color, onSelect, selected, note, className = '' }) {
  const clickable = onSelect && value > 0;
  return (
    <div className={`tile relative transition ${clickable ? 'hover:ring-accent-300' : ''}
      ${selected ? 'ring-2 ring-slate-900 hover:ring-slate-900' : ''} ${className}`}>
      {clickable && (
        <button type="button" onClick={onSelect} aria-pressed={selected}
          aria-label={`List ${value} ${label.toLowerCase()}`}
          className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400" />
      )}
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} aria-hidden="true" />}
        {label}
      </p>
      <p className="mt-1 text-3xl font-light tabular-nums text-slate-900">{value}</p>
      {note}
    </div>
  );
}

// Incident risk across shifts: totals, charts by day, department and shift type, recent High risk.
// Every count can be clicked to list the incidents (or open tasks) behind it.
export default function DashboardPage() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState(null);

  useEffect(() => {
    // Ignore a slower response for a range that is no longer selected.
    let cancelled = false;
    setError('');
    api
      .get('/dashboard/summary', { params: { days } })
      .then((res) => !cancelled && setSummary(res.data))
      .catch((err) => !cancelled && setError(apiError(err).message));
    return () => { cancelled = true; };
  }, [days]);

  const totals = summary?.totals;
  const selectRow = (row, risk) => setSelection(incidentSelection(risk, row));

  function tileProps(choice) {
    return { onSelect: () => setSelection(choice), selected: selection?.id === choice.id };
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle={summary && `Incidents from ${formatDate(summary.from)} to ${formatDate(summary.to)}, counted by their latest risk prediction.`}
        actions={(
          <div className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-slate-200" role="tablist" aria-label="Time range">
            {RANGES.map((d) => (
              <button key={d} type="button" role="tab" aria-selected={days === d}
                className={days === d ? 'pill-active' : 'pill'} onClick={() => setDays(d)}>
                {d} days
              </button>
            ))}
          </div>
        )}
      />

      {error && <p className="alert-error" role="alert">{error}</p>}

      {!summary ? (
        !error && <p className="py-6 text-center text-sm text-slate-500">Loading dashboard…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="Incidents" value={totals.incidents} className="col-span-2 sm:col-span-1"
              {...tileProps(incidentSelection(null))}
              note={totals.not_predicted > 0 && (
                <button type="button" className="link relative z-10 mt-0.5 text-xs"
                  aria-pressed={selection?.id === incidentSelection('not_predicted').id}
                  onClick={() => setSelection(incidentSelection('not_predicted'))}>
                  {totals.not_predicted} not predicted
                </button>
              )} />
            <StatTile label="High risk" value={totals.High} color={RISK_COLORS.High}
              {...tileProps(incidentSelection('High'))} />
            <StatTile label="Medium risk" value={totals.Medium} color={RISK_COLORS.Medium}
              {...tileProps(incidentSelection('Medium'))} />
            <StatTile label="Low risk" value={totals.Low} color={RISK_COLORS.Low}
              {...tileProps(incidentSelection('Low'))} />
            <StatTile label="Open tasks" value={totals.open_tasks} {...tileProps(OPEN_TASKS)} />
          </div>

          {selection && <DrillDownPanel selection={selection} days={days} onClose={() => setSelection(null)} />}

          {totals.incidents === 0 ? (
            <div className="card">
              <p className="py-6 text-center text-sm text-slate-500">No incidents logged in the last {days} days.</p>
            </div>
          ) : (
            <>
              <ChartCard
                title="Incidents per day"
                table={<RiskTable rows={summary.by_day.filter((d) => d.total > 0)} categoryKey="day"
                  categoryLabel="Day" formatCategory={formatDate} onSelect={selectRow} />}
              >
                <StackedRiskBars rows={summary.by_day} categoryKey="day" formatCategory={formatShortDate}
                  onSelect={selectRow} />
              </ChartCard>

              <div className="grid gap-6 lg:grid-cols-2">
                <ChartCard title="Risk mix">
                  <RiskDonut byRisk={summary.by_risk} onSelect={(risk) => setSelection(incidentSelection(risk))} />
                </ChartCard>
                <ChartCard
                  title="By shift type"
                  table={<RiskTable rows={summary.by_shift_type} categoryKey="shift_type" categoryLabel="Shift"
                    onSelect={selectRow} />}
                >
                  <StackedRiskBars rows={summary.by_shift_type} categoryKey="shift_type" onSelect={selectRow} />
                </ChartCard>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <ChartCard
                  title="By department"
                  className="lg:col-span-2"
                  table={<RiskTable rows={summary.by_department} categoryKey="department" categoryLabel="Department"
                    onSelect={selectRow} />}
                >
                  <StackedRiskBars rows={summary.by_department} categoryKey="department" horizontal
                    onSelect={selectRow} />
                </ChartCard>
                <section className="card min-w-0 self-start" aria-label="Recent High risk incidents">
                  <h2 className="section-title mb-4">Recent High risk</h2>
                  <Timeline
                    empty={`No High risk incidents in the last ${days} days.`}
                    items={summary.recent_high.map((i) => ({
                      id: i.incident_id,
                      when: formatDateTime(i.occurred_at),
                      title: i.incident_type,
                      detail: `${Math.round(Number(i.confidence) * 100)}% · ${i.shift_type} · ${i.department_name}`,
                      tone: 'High',
                      alert: true,
                      to: `/incidents/${i.incident_id}`,
                    }))}
                  />
                </section>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
