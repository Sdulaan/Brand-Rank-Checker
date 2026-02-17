const express = require('express');
const { getRankingHistory } = require('../controllers/analyticsController');

const router = express.Router();

router.get('/brands/:brandId/ranking-history', getRankingHistory);

module.exports = router;
