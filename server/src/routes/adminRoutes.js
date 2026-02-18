const express = require('express');
const {
  getAdminSettings,
  updateSchedule,
  addApiKey,
  updateApiKey,
  deleteApiKey,
  getAdminDashboard,
  runAutoNow,
  stopAutoRun,
  getDomainActivityLogs,
} = require('../controllers/adminController');

const router = express.Router();

router.get('/settings', getAdminSettings);
router.patch('/settings/schedule', updateSchedule);
router.post('/settings/keys', addApiKey);
router.patch('/settings/keys/:keyId', updateApiKey);
router.delete('/settings/keys/:keyId', deleteApiKey);
router.get('/dashboard', getAdminDashboard);
router.get('/domain-logs', getDomainActivityLogs);
router.post('/run-now', runAutoNow);
router.post('/stop-run', stopAutoRun);

module.exports = router;
