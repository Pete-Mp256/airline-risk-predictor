// Background job tests. The database and the mailer are mocked.
jest.mock('../config/db', () => ({ query: jest.fn() }));
jest.mock('../services/mailer', () => ({ sendMail: jest.fn().mockResolvedValue() }));

const pool = require('../config/db');
const { sendMail } = require('../services/mailer');
const handoverSummary = require('../jobs/handoverSummary');

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
