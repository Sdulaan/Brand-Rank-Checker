const express = require('express');
const { getRankingHistory, getRecentAutoChecks } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/brands/:brandId/ranking-history', getRankingHistory);
router.get('/brands/:brandId/recent-auto-checks', getRecentAutoChecks);

module.exports = router;
