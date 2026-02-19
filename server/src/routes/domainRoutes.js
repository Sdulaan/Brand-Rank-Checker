const express = require('express');
const { getDomains, createDomain, bulkCreateDomains, deleteDomain } = require('../controllers/domainController');

const router = express.Router();

router.get('/', getDomains);
router.post('/', createDomain);
router.post('/bulk', bulkCreateDomains);
router.delete('/:id', deleteDomain);

module.exports = router;
