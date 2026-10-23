const pool = require('../config/db');
const { parseId } = require('../utils/request');

// The logged-in manager's notifications, unread first.
async function listNotifications(req, res, next) {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, p.incident_id, p.risk_level
         FROM notifications n
         LEFT JOIN incident_predictions p ON p.prediction_id = n.prediction_id
        WHERE n.manager_id = $1
        ORDER BY n.is_read, n.created_at DESC
        LIMIT 50`,
      [req.user.manager_id]
    );
    res.json({ notifications: rows, unread_count: rows.filter((n) => !n.is_read).length });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  const notificationId = parseId(req.params.id);
  if (!notificationId) return res.status(404).json({ message: 'Notification not found' });

  try {
    const { rows } = await pool.query(
      `UPDATE notifications SET is_read = TRUE
        WHERE notification_id = $1 AND manager_id = $2
        RETURNING *`,
      [notificationId, req.user.manager_id]
    );
    if (!rows[0]) return res.status(404).json({ message: 'Notification not found' });
    res.json({ notification: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listNotifications, markRead };
