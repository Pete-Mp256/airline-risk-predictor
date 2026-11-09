// Handover rule layer (Module 2): each flag on and off, Weak/OK, and the rating change.
jest.mock('../config/db', () => ({ query: jest.fn() }));

const pool = require('../config/db');
const { RULES, evaluate, applyRules, checkHandover } = require('../services/handoverRules');

const START = '2026-10-21T06:00:00Z';
const END = '2026-10-21T14:00:00Z';
const at = (minutes) => new Date(Date.parse(START) + minutes * 60000).toISOString();

// A context where no flag fires: mid-shift incident, good previous handover acknowledged on time.
function goodContext() {
  return {
    incident: { task_id: 7, occurred_at: at(240) },
    shift: { start_time: START, end_time: END, staff_count: 4, open_tasks: 2 },
    previous: {
      handover: { summary: 'Engine 2 borescope done, APU fault deferred to next shift.', acknowledged_at: at(10) },
      open_tasks: 1,
      carried_task_ids: [3],
      had_high_incident: false,
    },
  };
}

const codes = (ctx) => evaluate(ctx).flags.map((f) => f.code);

describe('evaluate: no flags', () => {
  test('a good handover and a mid-shift incident fire nothing and are OK', () => {
    expect(evaluate(goodContext())).toEqual({ flags: [], level: 'OK' });
  });

  test('without an earlier shift only the incident-time and workload checks run', () => {
    const ctx = { ...goodContext(), previous: null };
    expect(codes(ctx)).toEqual([]);
  });
});

describe('evaluate: each flag on and off', () => {
  test('carried_over_task', () => {
    const ctx = goodContext();
    expect(codes(ctx)).not.toContain('carried_over_task');
    ctx.incident.task_id = 3;
    expect(codes(ctx)).toEqual(['carried_over_task']);
    ctx.incident.task_id = null;
    expect(codes(ctx)).not.toContain('carried_over_task');
  });

  test('many_open_tasks at the threshold', () => {
    const ctx = goodContext();
    ctx.previous.open_tasks = RULES.OPEN_TASKS - 1;
    expect(codes(ctx)).not.toContain('many_open_tasks');
    ctx.previous.open_tasks = RULES.OPEN_TASKS;
    expect(codes(ctx)).toEqual(['many_open_tasks']);
  });

  test('weak_summary when missing or short', () => {
    const ctx = goodContext();
    ctx.previous.handover.summary = 'x'.repeat(RULES.MIN_SUMMARY_CHARS);
    expect(codes(ctx)).not.toContain('weak_summary');
    ctx.previous.handover.summary = `  ${'x'.repeat(RULES.MIN_SUMMARY_CHARS - 1)}  `;
    expect(codes(ctx)).toEqual(['weak_summary']);
    ctx.previous.handover.summary = null;
    expect(codes(ctx)).toEqual(['weak_summary']);
  });

  test('late_acknowledgement when late or missing', () => {
    const ctx = goodContext();
    ctx.previous.handover.acknowledged_at = at(RULES.LATE_ACK_MINUTES - 1);
    expect(codes(ctx)).not.toContain('late_acknowledgement');
    ctx.previous.handover.acknowledged_at = at(RULES.LATE_ACK_MINUTES);
    expect(codes(ctx)).toEqual(['late_acknowledgement']);
    ctx.previous.handover.acknowledged_at = null;
    expect(codes(ctx)).toEqual(['late_acknowledgement']);
  });

  test('previous_high_incident', () => {
    const ctx = goodContext();
    ctx.previous.had_high_incident = true;
    expect(codes(ctx)).toEqual(['previous_high_incident']);
  });

  test('edge_of_shift near the start and near the end', () => {
    const ctx = goodContext();
    ctx.incident.occurred_at = at(RULES.EDGE_OF_SHIFT_MINUTES + 1);
    expect(codes(ctx)).not.toContain('edge_of_shift');
    ctx.incident.occurred_at = at(RULES.EDGE_OF_SHIFT_MINUTES);
    expect(codes(ctx)).toEqual(['edge_of_shift']);
    ctx.incident.occurred_at = at(8 * 60 - 30); // 30 min before the end
    expect(codes(ctx)).toEqual(['edge_of_shift']);
  });

  test('high_workload above the per-staff limit, skipped when staff_count is 0', () => {
    const ctx = goodContext();
    ctx.shift.open_tasks = RULES.OPEN_TASKS_PER_STAFF * 4; // exactly 2 per staff
    expect(codes(ctx)).not.toContain('high_workload');
    ctx.shift.open_tasks += 1;
    expect(codes(ctx)).toEqual(['high_workload']);
    ctx.shift.staff_count = 0;
    expect(codes(ctx)).not.toContain('high_workload');
  });

  test('no submitted previous handover fires weak_summary and late_acknowledgement', () => {
    const ctx = goodContext();
    ctx.previous.handover = null;
    expect(evaluate(ctx)).toEqual({
      flags: [
        { code: 'weak_summary', label: expect.any(String) },
        { code: 'late_acknowledgement', label: expect.any(String) },
      ],
      level: 'Weak',
    });
  });
});

describe('evaluate: level', () => {
  test('one flag is OK, two flags are Weak', () => {
    const ctx = goodContext();
    ctx.previous.had_high_incident = true;
    expect(evaluate(ctx).level).toBe('OK');
    ctx.previous.open_tasks = RULES.OPEN_TASKS;
    expect(evaluate(ctx).level).toBe('Weak');
  });
});

describe('applyRules', () => {
  test('Weak raises Medium to High', () => {
    expect(applyRules('Medium', 'Weak')).toBe('High');
  });

  test('Weak leaves Low and High unchanged', () => {
    expect(applyRules('Low', 'Weak')).toBe('Low');
    expect(applyRules('High', 'Weak')).toBe('High');
  });

  test('OK changes nothing', () => {
    for (const level of ['Low', 'Medium', 'High']) expect(applyRules(level, 'OK')).toBe(level);
  });
});

describe('checkHandover', () => {
  beforeEach(() => pool.query.mockReset());

  test('loads the context and raises Medium to High on a Weak handover', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ start_time: START, end_time: END, staff_count: 4, open_tasks: 2 }] })
      .mockResolvedValueOnce({ rows: [{ previous_shift_id: 1, handover_id: null }] })
      .mockResolvedValueOnce({ rows: [{ carried_task_ids: [], open_tasks: 0, had_high_incident: false }] });

    const result = await checkHandover({ shift_id: 2, task_id: null, occurred_at: at(240) }, 'Medium');

    expect(result.handover_level).toBe('Weak');
    expect(result.final_risk_level).toBe('High');
    expect(result.handover_flags.map((f) => f.code)).toEqual(['weak_summary', 'late_acknowledgement']);
    expect(pool.query.mock.calls[2][1]).toEqual([1, null]);
  });

  test('with no earlier shift the rating stays as the model gave it', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ start_time: START, end_time: END, staff_count: 4, open_tasks: 2 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await checkHandover({ shift_id: 2, task_id: null, occurred_at: at(240) }, 'Medium');

    expect(result).toEqual({ handover_flags: [], handover_level: 'OK', final_risk_level: 'Medium' });
    expect(pool.query).toHaveBeenCalledTimes(2);
  });
});
