const pool = require('../config/db');
const { parseId, isBlank, buildSet, invalid } = require('../utils/request');
const { findOwnedShift } = require('./shiftController');
const { emailHandoverSummary } = require('../services/alerts');

const BOXES = ['incoming', 'sent'];

// One handover with its shift, department and the two managers' names.
const HANDOVER_SELECT = `
  SELECT h.*, s.department_id, s.shift_type, s.shift_date, s.start_time, s.end_time, s.staff_count,
         d.name AS department_name,
         f.first_name || ' ' || f.last_name AS from_manager_name,
         t.first_name || ' ' || t.last_name AS to_manager_name
    FROM handovers h
    JOIN shifts s ON s.shift_id = h.shift_id
    JOIN departments d ON d.department_id = s.department_id
    JOIN shift_managers f ON f.manager_id = h.from_manager_id
    LEFT JOIN shift_managers t ON t.manager_id = h.to_manager_id`;

// Items with the task or incident they point at (latest prediction for incidents).
// Ordered Open task, Incident, Note (enum order).
async function fetchItems(handoverId) {
  const { rows } = await pool.query(
    `SELECT hi.*, t.title AS task_title, t.aircraft_reg, t.status AS task_status,
            i.incident_type, i.occurred_at, p.risk_level
       FROM handover_items hi
       LEFT JOIN tasks t ON t.task_id = hi.task_id
       LEFT JOIN incidents i ON i.incident_id = hi.incident_id
       LEFT JOIN LATERAL (
         SELECT risk_level FROM incident_predictions
          WHERE incident_id = hi.incident_id
          ORDER BY created_at DESC, prediction_id DESC LIMIT 1
       ) p ON TRUE
      WHERE hi.handover_id = $1
      ORDER BY hi.item_type, hi.item_id`,
    [handoverId]
  );
  return rows;
}

const isSender = (h, user) => h.from_manager_id === user.manager_id;
const isIncoming = (h, user) => h.to_manager_id === user.manager_id;
const inDepartment = (h, user) => h.department_id === user.department_id;
const canView = (h, user) => isSender(h, user) || isIncoming(h, user) || inDepartment(h, user);
const canAcknowledge = (h, user) => !isSender(h, user) && (isIncoming(h, user) || inDepartment(h, user));

// Returns the handover, or sends 404 and returns null.
async function findHandover(req, res) {
  const handoverId = parseId(req.params.id);
  const { rows } = handoverId
    ? await pool.query(`${HANDOVER_SELECT} WHERE h.handover_id = $1`, [handoverId])
    : { rows: [] };
  if (!rows[0]) {
    res.status(404).json({ message: 'Handover not found' });
    return null;
  }
  return rows[0];
}

// A Draft handover the logged-in manager started, or sends 404/403/409 and returns null.
async function findOwnDraft(req, res) {
  const handover = await findHandover(req, res);
  if (!handover) return null;
  if (!isSender(handover, req.user)) {
    res.status(403).json({ message: 'Only the manager who started this handover can change it' });
    return null;
  }
  if (handover.status !== 'Draft') {
    res.status(409).json({ message: 'This handover has been submitted and can no longer be changed' });
    return null;
  }
  return handover;
}

// A Submitted handover the logged-in manager may acknowledge, or sends 404/403/409 and returns null.
async function findForAcknowledge(req, res) {
  const handover = await findHandover(req, res);
  if (!handover) return null;
  if (!canAcknowledge(handover, req.user)) {
    res.status(403).json({ message: 'Only the incoming manager or their department can acknowledge this handover' });
    return null;
  }
  if (handover.status !== 'Submitted') {
    res.status(409).json({
      message: handover.status === 'Draft' ? 'This handover has not been submitted yet' : 'This handover is already acknowledged',
    });
    return null;
  }
  return handover;
}

// Validates summary / to_manager_id from the body into `updates`; returns the errors.
function readFields(body, user, updates) {
  const errors = {};
  if ('summary' in body) {
    if (body.summary !== null && typeof body.summary !== 'string') errors.summary = 'summary must be text';
    else updates.summary = body.summary;
  }
  if ('to_manager_id' in body) {
    const toId = body.to_manager_id === null ? null : parseId(body.to_manager_id);
    if (body.to_manager_id !== null && toId === null) {
      errors.to_manager_id = 'to_manager_id must be a manager id or null';
    } else if (toId === user.manager_id) {
      errors.to_manager_id = 'You cannot hand over to yourself';
    } else {
      updates.to_manager_id = toId;
    }
  }
  return errors;
}

function handleDbError(err, res, next) {
  if (err.code === '23503') return invalid(res, { to_manager_id: 'Manager not found' });
  next(err);
}

// POST /api/shifts/:id/handover: starts the shift's handover with its unfinished tasks
// (carried over) and its incidents.
async function startHandover(req, res, next) {
  const fields = {};
  const errors = readFields(req.body || {}, req.user, fields);
  if (Object.keys(errors).length > 0) return invalid(res, errors);

  try {
    const shift = await findOwnedShift(req, res);
    if (!shift) return;

    const { rows } = await pool.query(
      `WITH h AS (
         INSERT INTO handovers (shift_id, from_manager_id, to_manager_id, summary)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (shift_id) DO NOTHING
         RETURNING *
       ), open_tasks AS (
         INSERT INTO handover_items (handover_id, item_type, task_id, carried_over)
         SELECT h.handover_id, 'Open task', t.task_id, TRUE
           FROM h, tasks t
          WHERE t.shift_id = $1 AND t.status <> 'Complete'
       ), shift_incidents AS (
         INSERT INTO handover_items (handover_id, item_type, incident_id)
         SELECT h.handover_id, 'Incident', i.incident_id
           FROM h, incidents i
          WHERE i.shift_id = $1
       )
       SELECT * FROM h`,
      [shift.shift_id, req.user.manager_id, fields.to_manager_id ?? null, fields.summary ?? null]
    );
    if (!rows[0]) return res.status(409).json({ message: 'This shift already has a handover' });

    res.status(201).json({ handover: rows[0], items: await fetchItems(rows[0].handover_id) });
  } catch (err) {
    handleDbError(err, res, next);
  }
}

// GET /api/handovers?box=incoming|sent
// incoming: submitted handovers to me, or to my department when no incoming manager is set.
async function listHandovers(req, res, next) {
  const box = req.query.box ?? 'incoming';
  if (!BOXES.includes(box)) return invalid(res, { box: `box must be one of ${BOXES.join(', ')}` });

  const where = box === 'sent'
    ? 'h.from_manager_id = $1'
    : `h.status <> 'Draft' AND h.from_manager_id <> $1
       AND (h.to_manager_id = $1 OR (h.to_manager_id IS NULL AND s.department_id = $2))`;
  try {
    const { rows } = await pool.query(
      `${HANDOVER_SELECT}
        WHERE ${where}
        ORDER BY COALESCE(h.submitted_at, h.created_at) DESC
        LIMIT 100`,
      box === 'sent' ? [req.user.manager_id] : [req.user.manager_id, req.user.department_id ?? null]
    );
    res.json({ handovers: rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/handovers/:id
async function getHandover(req, res, next) {
  try {
    const handover = await findHandover(req, res);
    if (!handover) return;
    if (!canView(handover, req.user)) {
      return res.status(403).json({ message: 'You can only view handovers you sent, received or from your department' });
    }
    res.json({ handover, items: await fetchItems(handover.handover_id) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/handovers/:id: summary and incoming manager, while Draft.
async function updateHandover(req, res, next) {
  const updates = {};
  const errors = readFields(req.body || {}, req.user, updates);
  if (Object.keys(errors).length > 0) return invalid(res, errors);
  if (Object.keys(updates).length === 0) {
    return invalid(res, { body: 'Send at least one of summary, to_manager_id' });
  }

  try {
    const handover = await findOwnDraft(req, res);
    if (!handover) return;

    const { clause, values } = buildSet(updates);
    const { rows } = await pool.query(
      `UPDATE handovers SET ${clause}, updated_at = NOW()
        WHERE handover_id = $${values.length + 1} RETURNING *`,
      [...values, handover.handover_id]
    );
    res.json({ handover: rows[0] });
  } catch (err) {
    handleDbError(err, res, next);
  }
}

// POST /api/handovers/:id/notes
async function addNote(req, res, next) {
  const { note } = req.body || {};
  if (isBlank(note)) return invalid(res, { note: 'note is required' });

  try {
    const handover = await findOwnDraft(req, res);
    if (!handover) return;

    const { rows } = await pool.query(
      `INSERT INTO handover_items (handover_id, item_type, note)
       VALUES ($1, 'Note', $2) RETURNING *`,
      [handover.handover_id, note.trim()]
    );
    res.status(201).json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/handovers/:id/items/:itemId: removes a note (tasks and incidents stay).
async function removeNote(req, res, next) {
  const itemId = parseId(req.params.itemId);
  try {
    const handover = await findOwnDraft(req, res);
    if (!handover) return;

    const { rows } = itemId
      ? await pool.query(
        `DELETE FROM handover_items
          WHERE item_id = $1 AND handover_id = $2 AND item_type = 'Note'
          RETURNING item_id`,
        [itemId, handover.handover_id]
      )
      : { rows: [] };
    if (!rows[0]) return res.status(404).json({ message: 'Note not found on this handover' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

// POST /api/handovers/:id/submit: notifies the incoming manager (or the department) in-app and by
// email. Marks the shift's handover_sent_at so the end-of-shift job doesn't send its own email.
async function submitHandover(req, res, next) {
  try {
    const handover = await findOwnDraft(req, res);
    if (!handover) return;
    if (isBlank(handover.summary)) {
      return invalid(res, { summary: 'Add a summary before submitting the handover' });
    }

    const { rows } = await pool.query(
      `UPDATE handovers SET status = 'Submitted', submitted_at = NOW(), updated_at = NOW()
        WHERE handover_id = $1 AND status = 'Draft' RETURNING *`,
      [handover.handover_id]
    );
    if (!rows[0]) {
      return res.status(409).json({ message: 'This handover has been submitted and can no longer be changed' });
    }

    const items = await fetchItems(handover.handover_id);
    const tasks = items.filter((i) => i.item_type === 'Open task');
    const message = `Handover from ${handover.from_manager_name}: ${handover.shift_type} shift, ` +
      `${handover.department_name}. ${tasks.length} open task${tasks.length === 1 ? '' : 's'} carried over.`;
    const { rows: recipients } = await pool.query(
      `WITH sent AS (
         UPDATE shifts SET handover_sent_at = COALESCE(handover_sent_at, NOW()) WHERE shift_id = $1
       ), n AS (
         INSERT INTO notifications (manager_id, shift_id, message)
         SELECT manager_id, $1, $2
           FROM shift_managers
          WHERE is_active AND manager_id <> $3
            AND (manager_id = $4 OR ($4::int IS NULL AND department_id = $5))
         RETURNING manager_id
       )
       SELECT m.email, m.first_name FROM n JOIN shift_managers m USING (manager_id)`,
      [handover.shift_id, message, handover.from_manager_id, handover.to_manager_id, handover.department_id]
    );

    // Reuses the end-of-shift email, with the handover summary and notes as the notes.
    const notes = [handover.summary, ...items.filter((i) => i.item_type === 'Note').map((i) => `- ${i.note}`)];
    // Not awaited: the response shouldn't wait on SMTP, and an email failure must not fail the request.
    emailHandoverSummary({
      shift: { ...handover, manager_name: handover.from_manager_name, notes: notes.join('\n') },
      tasks: tasks.map((t) => ({ title: t.task_title, aircraft_reg: t.aircraft_reg, status: t.task_status })),
      incidents: items.filter((i) => i.item_type === 'Incident'),
      recipients,
    }).catch((err) => console.error('[alerts] handover email failed:', err));

    res.json({ handover: rows[0], items, notified: recipients.length });
  } catch (err) {
    next(err);
  }
}

// POST /api/handovers/:id/acknowledge: the whole handover, and any items not yet acknowledged.
async function acknowledgeHandover(req, res, next) {
  try {
    const handover = await findForAcknowledge(req, res);
    if (!handover) return;

    const { rows } = await pool.query(
      `WITH h AS (
         UPDATE handovers
            SET status = 'Acknowledged', acknowledged_at = NOW(), acknowledged_by = $2, updated_at = NOW()
          WHERE handover_id = $1 AND status = 'Submitted'
          RETURNING *
       ), items AS (
         UPDATE handover_items SET acknowledged_at = NOW()
          WHERE handover_id = (SELECT handover_id FROM h) AND acknowledged_at IS NULL
          RETURNING item_id
       )
       SELECT h.*, (SELECT COUNT(*)::int FROM items) AS items_acknowledged FROM h`,
      [handover.handover_id, req.user.manager_id]
    );
    if (!rows[0]) return res.status(409).json({ message: 'This handover is already acknowledged' });
    res.json({ handover: rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/handovers/:id/items/:itemId/acknowledge
async function acknowledgeItem(req, res, next) {
  const itemId = parseId(req.params.itemId);
  try {
    const handover = await findForAcknowledge(req, res);
    if (!handover) return;

    const { rows } = itemId
      ? await pool.query(
        `UPDATE handover_items SET acknowledged_at = COALESCE(acknowledged_at, NOW())
          WHERE item_id = $1 AND handover_id = $2 RETURNING *`,
        [itemId, handover.handover_id]
      )
      : { rows: [] };
    if (!rows[0]) return res.status(404).json({ message: 'Item not found on this handover' });
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startHandover, listHandovers, getHandover, updateHandover, addNote, removeNote,
  submitHandover, acknowledgeHandover, acknowledgeItem,
};
