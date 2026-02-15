const mongoose = require('mongoose');

const domainSchema = new mongoose.Schema(
  {
    domain: { type: String, required: true, trim: true },
    domainKey: { type: String, required: true, trim: true, index: true },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

domainSchema.index({ domainKey: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model('Domain', domainSchema);
