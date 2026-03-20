const express = require('express');

const createSerpRoutes = (serpController) => {
  const router = express.Router();
  router.post('/check', serpController.checkTopTen);
  router.post('/bulk-check', serpController.bulkDomainCheck);
  router.post('/bulk-check/start', serpController.startBulkDomainCheck);
  router.get('/bulk-check/:runId', serpController.getBulkDomainCheck);
  router.post('/bulk-check/:runId/stop', serpController.stopBulkDomainCheck);
  return router;
};

module.exports = createSerpRoutes;
