require('dotenv').config();

const mongoose = require('mongoose');
const { loadEnv } = require('../src/config/env');
const Brand = require('../src/models/Brand');
const Domain = require('../src/models/Domain');
const { normalizeDomain } = require('../src/utils/domain');

const sampleBrands = [
  { name: 'Tokopedia', code: 'TOKO', color: '#22c55e', isActive: true },
  { name: 'Shopee', code: 'SHOP', color: '#f97316', isActive: true },
  { name: 'Lazada', code: 'LAZA', color: '#3b82f6', isActive: true }
];

const sampleDomains = {
  TOKO: ['tokopedia.com'],
  SHOP: ['shopee.co.id', 'shopee.com'],
  LAZA: ['lazada.co.id', 'lazada.com']
};

async function seed() {
  const env = loadEnv();
  await mongoose.connect(env.MONGODB_URI);

  const brandCount = await Brand.countDocuments();
  const domainCount = await Domain.countDocuments();

  if (brandCount > 0 || domainCount > 0) {
    console.log('Database is not empty. Skipping seed.');
    await mongoose.disconnect();
    return;
  }

  const createdBrands = await Brand.insertMany(sampleBrands);
  const brandByCode = new Map(createdBrands.map((brand) => [brand.code, brand]));

  const domainDocs = [];
  for (const [code, domains] of Object.entries(sampleDomains)) {
    for (const domain of domains) {
      domainDocs.push({
        domain,
        domainKey: normalizeDomain(domain),
        brand: brandByCode.get(code)._id,
        isActive: true
      });
    }
  }

  await Domain.insertMany(domainDocs);

  console.log('Seed completed successfully.');
  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error('Seed failed:', error);
  await mongoose.disconnect();
  process.exit(1);
});
