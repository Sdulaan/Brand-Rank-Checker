const mongoose = require('mongoose');

const connectDb = async (mongoUri) => {
  await mongoose.connect(mongoUri);

  // Support legacy index upgrade: previously domains were unique by (brand, domainHostKey).
  // We now allow multiple rows per host by adding a path prefix, so we drop the old index if present.
  try {
    // eslint-disable-next-line global-require
    const Domain = require('../models/Domain');
    const indexes = await Domain.collection.indexes();
    const legacy = indexes.find((idx) => idx?.name === 'brand_1_domainHostKey_1');
    if (legacy) {
      await Domain.collection.dropIndex('brand_1_domainHostKey_1');
    }
    await Domain.collection.createIndex(
      { brand: 1, domainHostKey: 1, domainPathPrefix: 1 },
      { unique: true, name: 'brand_1_domainHostKey_1_domainPathPrefix_1' }
    );
  } catch (error) {
    // Non-fatal: app can still run. Log once for visibility.
    // eslint-disable-next-line no-console
    console.warn('Domain index check skipped:', error.message);
  }

  return mongoose.connection;
};

module.exports = connectDb;
