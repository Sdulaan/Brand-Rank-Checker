const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    color: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

brandSchema.index({ code: 1 });

module.exports = mongoose.model('Brand', brandSchema);
