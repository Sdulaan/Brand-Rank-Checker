const mongoose = require('mongoose');

const DOMAIN_ACTIVITY_ACTIONS = {
  ADD: 'add',
  DELETE: 'delete',
};

const domainActivityLogSchema = new mongoose.Schema(
  {
    action: { type: String, enum: Object.values(DOMAIN_ACTIVITY_ACTIONS), required: true, index: true },
    domain: { type: String, required: true, trim: true },
    domainHostKey: { type: String, required: true, trim: true, index: true },
    note: { type: String, default: '' },
    brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    metadata: { type: Object, default: {} },
  },
  {
    timestamps: true,
  }
);

domainActivityLogSchema.index({ createdAt: -1 });

module.exports = {
  DomainActivityLog: mongoose.model('DomainActivityLog', domainActivityLogSchema),
  DOMAIN_ACTIVITY_ACTIONS,
};
