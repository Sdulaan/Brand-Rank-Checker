const express = require('express');
const Brand = require('../models/Brand');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const active = req.query.active === 'true';
    const filter = active ? { isActive: true } : {};
    const brands = await Brand.find(filter).sort({ code: 1 }).lean();
    res.json(brands);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
