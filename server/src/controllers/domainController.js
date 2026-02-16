const Domain = require('../models/Domain');

const getDomains = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.brandId) {
      filter.brand = req.query.brandId;
    }
    if (req.query.active === 'true') {
      filter.isActive = true;
    }

    const domains = await Domain.find(filter).populate('brand', 'name code color');
    res.json(domains);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDomains,
};
