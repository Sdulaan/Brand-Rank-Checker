const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Brand = require('../src/models/Brand');
const Domain = require('../src/models/Domain');
const { buildDomainKeys } = require('../src/utils/domain');

dotenv.config({ path: `${__dirname}/../.env` });

const sampleBrands = [
  {
    name: 'Asia100 Official',
    code: 'asia100',
    description: 'Primary brand',
    color: '#16a34a',
    isActive: true,
  },
  {
    name: 'Hair Plus',
    code: 'hairplus',
    description: 'Competitor brand',
    color: '#dc2626',
    isActive: true,
  },
  {
    name: 'Vantage Web',
    code: 'vantage',
    description: 'Media network',
    color: '#2563eb',
    isActive: true,
  },
];

const sampleDomains = [
  { domain: 'asia100vip.website', brandCode: 'asia100', note: 'Main site' },
  { domain: 'asia100', brandCode: 'asia100', note: 'Alias token domain' },
  { domain: 'hairplus.co.id', brandCode: 'hairplus', note: 'Competitor' },
  { domain: 'vantageweb.id', brandCode: 'vantage', note: 'Publisher' },
];

const seed = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('Missing MONGO_URI in server/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const brandCount = await Brand.countDocuments();
  if (brandCount === 0) {
    await Brand.insertMany(sampleBrands);
    console.log('Seeded brands');
  } else {
    console.log('Brands already populated, skipping');
  }

  const domainCount = await Domain.countDocuments();
  if (domainCount === 0) {
    const brands = await Brand.find();
    const brandByCode = new Map(brands.map((brand) => [brand.code, brand]));

    const domainDocs = sampleDomains
      .map((item) => {
        const brand = brandByCode.get(item.brandCode);
        if (!brand) return null;

        const keys = buildDomainKeys({ domain: item.domain, brandCode: brand.code });
        return {
          domain: item.domain,
          brand: brand._id,
          note: item.note,
          isActive: true,
          ...keys,
        };
      })
      .filter(Boolean);

    await Domain.insertMany(domainDocs);
    console.log('Seeded domains');
  } else {
    console.log('Domains already populated, skipping');
  }

  await mongoose.disconnect();
};

seed()
  .then(() => {
    console.log('Seed finished');
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
