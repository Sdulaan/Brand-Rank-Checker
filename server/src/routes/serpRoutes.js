const express = require('express');

const createSerpRoutes = (serpController) => {
  const router = express.Router();
  router.post('/check', serpController.checkTopTen);
  return router;
};

module.exports = createSerpRoutes;
