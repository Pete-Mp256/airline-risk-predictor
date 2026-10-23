const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const shiftRoutes = require('./routes/shifts');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/shifts', shiftRoutes);

// Unknown routes
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// Errors passed to next(err), including malformed JSON bodies
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Malformed JSON body' });
  }
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
});

module.exports = app;
