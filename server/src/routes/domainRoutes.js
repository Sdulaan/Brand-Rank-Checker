const express = require('express');
const { getDomains } = require('../controllers/domainController');

const router = express.Router();

router.get('/', getDomains);

module.exports = router;
