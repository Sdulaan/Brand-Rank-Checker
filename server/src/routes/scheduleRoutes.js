const express = require('express');
const router = express.Router();
const scheduler = require('../services/schedulerService');

// GET /api/schedules — list all schedules
router.get('/', (req, res) => {
  try {
    res.json(scheduler.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedules — create a new schedule
// Body: { name, cronExpression, label, brands }
router.post('/', (req, res) => {
  try {
    const { name, cronExpression, label, brands } = req.body;
    if (!name || !cronExpression) {
      return res.status(400).json({ error: 'name and cronExpression are required' });
    }
    const schedule = scheduler.create({ name, cronExpression, label, brands });
    res.status(201).json(schedule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/schedules/:id/toggle — enable or disable a schedule
router.patch('/:id/toggle', (req, res) => {
  try {
    const schedule = scheduler.toggle(req.params.id);
    res.json(schedule);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/schedules/:id/run — run a schedule immediately
router.post('/:id/run', async (req, res) => {
  try {
    const schedule = await scheduler.runNow(req.params.id);
    res.json(schedule);
  } catch (err) {
    const status = err.statusCode || (err.message.toLowerCase().includes('not found') ? 404 : 500);
    res.status(status).json({ error: err.message });
  }
});

// DELETE /api/schedules/:id — delete a schedule and stop its cron job
router.delete('/:id', (req, res) => {
  try {
    scheduler.remove(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;