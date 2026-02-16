const Brand = require('../models/Brand');

const getBrands = async (req, res, next) => {
  try {
    const activeOnly = req.query.active === 'true';
    const filter = activeOnly ? { isActive: true } : {};

    const brands = await Brand.find(filter).sort({ code: 1 });
    res.json(brands);
  } catch (error) {
    next(error);
  }
};

const getBrandById = async (req, res, next) => {
  try {
    const brand = await Brand.findById(req.params.id);
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    return res.json(brand);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBrands,
  getBrandById,
};
