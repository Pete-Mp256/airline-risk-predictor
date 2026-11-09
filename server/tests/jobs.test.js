// Background job tests. The database and the mailer are mocked.
jest.mock('../config/db', () => ({ query: jest.fn() }));
jest.mock('../services/mailer', () => ({ sendMail: jest.fn().mockResolvedValue() }));

const pool = require('../config/db');
const { sendMail } = require('../services/mailer');
const handoverSummary = require('../jobs/handoverSummary');
const taskReminders = require('../jobs/taskReminders');

beforeEach(() => {
  pool.query.mockReset();
  sendMail.mockReset().mockResolvedValue();
});

describe('handover summary job', () => {
  const ended = {
    shift_id: 7,
    manager_id: 1,
    department_id: 1,
    shift_type: 'Night',
    start_time: '2026-11-02T19:00:00Z',
    end_time: '2026-11-03T03:00:00Z',
    staff_count: 6,
    notes: 'GPU on stand 4 <unreliable>',
    manager_name: 'Amina Odhiambo',
    department_name: 'Line Maintenance',
  };
  const tasks = [{ task_id: 1, title: 'Borescope engine 2', aircraft_reg: '5Y-ABC', status: 'In Progress' }];
  const incidents = [
    { incident_id: 3, incident_type: 'Hardware', occurred_at: '2026-11-02T23:00:00Z', risk_level: 'High' },
    { incident_id: 4, incident_type: 'Power failure', occurred_at: '2026-11-03T01:00:00Z', risk_level: null },
  ];

  test('claims ended shifts and emails the next manager on duty', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [ended] })
      .mockResolvedValueOnce({ rows: [{ email: 'brian@example.com', first_name: 'Brian' }] })
      .mockResolvedValueOnce({ rows: tasks })
      .mockResolvedValueOnce({ rows: incidents });

    const result = await handoverSummary.run();

    expect(result).toEqual({ shifts: 1, sent: 1 });
    expect(pool.query.mock.calls[0][0]).toMatch(/SET handover_sent_at = NOW\(\)[\s\S]*handover_sent_at IS NULL/);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.to).toBe('brian@example.com');
    expect(mail.subject).toBe('Handover: Night shift, Line Maintenance, 1 High risk');
    expect(mail.text).toMatch(/Amina Odhiambo has handed over/);
    expect(mail.text).toMatch(/Borescope engine 2 \(5Y-ABC\): In Progress/);
    expect(mail.text).toMatch(/Hardware: High risk/);
    expect(mail.text).toMatch(/Power failure: not predicted/);
    expect(mail.text).toMatch(/\/shifts\/7/);
    expect(mail.html).toMatch(/&lt;unreliable&gt;/);
    expect(mail.html).not.toMatch(/<unreliable>/);
  });

  test("falls back to the department's other managers when no next shift is scheduled", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [ended] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ email: 'c@example.com', first_name: 'C' }, { email: 'd@example.com', first_name: 'D' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await handoverSummary.run();

    expect(result.sent).toBe(2);
    expect(pool.query.mock.calls[2][1]).toEqual([1, 1]);
    expect(sendMail.mock.calls[0][0].text).toMatch(/Open tasks \(0\)\nNone/);
  });

  test('does nothing when no shift has ended', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    expect(await handoverSummary.run()).toEqual({ shifts: 0, sent: 0 });
    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe('task reminders job', () => {
  const open = (task_id, shift_id, title) => ({
    task_id, title, aircraft_reg: null, status: 'Pending',
    shift_id, manager_id: shift_id, shift_type: 'Night', end_time: '2026-11-03T03:00:00Z',
  });

  test('sends one reminder per shift listing its open tasks, with an in-app notification', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [open(1, 7, 'Borescope'), open(2, 7, 'Tyre change'), open(3, 8, 'Oil top-up')] })
      .mockResolvedValueOnce({ rows: [{ email: 'amina@example.com', first_name: 'Amina' }] })
      .mockResolvedValueOnce({ rows: [] }) // notification for shift 7
      .mockResolvedValueOnce({ rows: [{ email: 'brian@example.com', first_name: 'Brian' }] })
      .mockResolvedValueOnce({ rows: [] }); // notification for shift 8

    const result = await taskReminders.run();

    expect(result).toEqual({ tasks: 3, sent: 2 });
    expect(pool.query.mock.calls[0][0]).toMatch(/SET reminder_sent_at = NOW\(\)[\s\S]*reminder_sent_at IS NULL/);
    expect(pool.query.mock.calls[0][1]).toEqual([60]);
    expect(pool.query.mock.calls[2][1].slice(0, 2)).toEqual([7, 7]);
    expect(pool.query.mock.calls[2][1][2]).toMatch(/^2 tasks still open on your Night shift/);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.subject).toBe('2 tasks still open on your Night shift');
    expect(mail.text).toMatch(/- Borescope: Pending\n- Tyre change: Pending/);
    expect(sendMail.mock.calls[1][0].subject).toBe('1 task still open on your Night shift');
  });

  test('uses REMINDER_LEAD_MINUTES for the window', async () => {
    process.env.REMINDER_LEAD_MINUTES = '30';
    pool.query.mockResolvedValueOnce({ rows: [] });

    await taskReminders.run();

    expect(pool.query.mock.calls[0][1]).toEqual([30]);
    delete process.env.REMINDER_LEAD_MINUTES;
  });
});
