const cron = require('node-cron');

// Background jobs, each run once a minute. Every job claims its rows in the database
// (e.g. sets handover_sent_at) before sending, so each email goes out once even if
// runs overlap or two servers are running.
// [name, module]: each module exports run() -> { sent, ... } counts.
const JOBS = [
  ['handover summary', require('./handoverSummary')],
  ['task reminders', require('./taskReminders')],
];

function start() {
  if (process.env.JOBS_ENABLED === 'false') {
    console.log('[jobs] disabled (JOBS_ENABLED=false)');
    return;
  }
  for (const [name, job] of JOBS) {
    cron.schedule('* * * * *', async () => {
      try {
        const result = await job.run();
        if (result && result.sent > 0) console.log(`[jobs] ${name}:`, result);
      } catch (err) {
        console.error(`[jobs] ${name} failed:`, err);
      }
    }, { name, noOverlap: true });
  }
  console.log(`[jobs] scheduled: ${JOBS.map(([name]) => name).join(', ')}`);
}

module.exports = { start };
