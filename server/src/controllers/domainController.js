const Domain = require('../models/Domain');
const Brand = require('../models/Brand');
const { DomainActivityLog, DOMAIN_ACTIVITY_ACTIONS } = require('../models/DomainActivityLog');
const { normalizeDomainForStorage } = require('../utils/domain');

const parseCsvLine = (line) => {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',') {
      out.push(cur.trim());
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
};

const parseCsvText = (text) => {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (!lines.length) return { header: null, rows: [] };

  const first = parseCsvLine(lines[0]).map((v) => v.toLowerCase());
  const hasHeader = first.includes('domain');

  const header = hasHeader ? first : null;
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows = dataLines.map((line) => parseCsvLine(line));
  return { header, rows };
};

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

const createDomain = async (req, res, next) => {
  try {
    const rawDomain = String(req.body.domain || '').trim();
    const note = String(req.body.note || '').trim();
    const brandId = String(req.body.brandId || '').trim();

    if (!rawDomain || !brandId) {
      return res.status(400).json({ error: 'domain and brandId are required' });
    }

    const normalized = normalizeDomainForStorage(rawDomain);
    if (!normalized.domainHostKey) {
      return res.status(400).json({ error: 'Invalid domain' });
    }

    const brand = await Brand.findById(brandId).select('_id');
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const domain = await Domain.create({
      domain: normalized.domainNormalized,
      brand: brand._id,
      note,
      isActive: true,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    await DomainActivityLog.create({
      action: DOMAIN_ACTIVITY_ACTIONS.ADD,
      domain: domain.domain,
      domainHostKey: domain.domainHostKey,
      note: domain.note,
      brand: domain.brand,
      actor: req.user._id,
    });

    const populated = await Domain.findById(domain._id).populate('brand', 'name code color');
    return res.status(201).json(populated);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'Domain already exists for this brand' });
    }
    return next(error);
  }
};

const bulkCreateDomains = async (req, res, next) => {
  try {
    const csv = String(req.body.csv || req.body.text || '');
    const defaultBrandId = String(req.body.defaultBrandId || '').trim();

    if (!csv.trim()) {
      return res.status(400).json({ error: 'csv is required' });
    }

    const { header, rows } = parseCsvText(csv);

    if (!rows.length) {
      return res.status(400).json({ error: 'No CSV rows found' });
    }

    const brands = await Brand.find({}).select('_id code name');
    const brandByCode = new Map(
      brands
        .filter((b) => b.code)
        .map((b) => [String(b.code).trim().toLowerCase(), b._id.toString()])
    );

    const colIndex = (name) => (header ? header.indexOf(name) : -1);

    const domainIdx = header ? colIndex('domain') : 0;
    const noteIdx = header ? colIndex('note') : 2;

    const brandIdIdx = header ? colIndex('brandid') : -1;
    const brandCodeIdx = header ? Math.max(colIndex('brandcode'), colIndex('code')) : 1;
    const brandTextIdx = header ? colIndex('brand') : -1;

    const errors = [];
    const docs = [];
    const meta = [];

    rows.forEach((cols, i) => {
      const rowNumber = header ? i + 2 : i + 1;
      const rawDomain = String(cols[domainIdx] || '').trim();
      const rawNote = noteIdx >= 0 ? String(cols[noteIdx] || '').trim() : '';

      if (!rawDomain) {
        errors.push({ row: rowNumber, error: 'domain is required' });
        return;
      }

      const normalized = normalizeDomainForStorage(rawDomain);
      if (!normalized.domainHostKey) {
        errors.push({ row: rowNumber, error: `Invalid domain: ${rawDomain}` });
        return;
      }

      let brandId = '';
      if (brandIdIdx >= 0 && cols[brandIdIdx]) {
        brandId = String(cols[brandIdIdx]).trim();
      } else if (brandCodeIdx >= 0 && cols[brandCodeIdx]) {
        const code = String(cols[brandCodeIdx]).trim().toLowerCase();
        brandId = brandByCode.get(code) || '';
        if (!brandId) {
          errors.push({ row: rowNumber, error: `Unknown brand code: ${cols[brandCodeIdx]}` });
          return;
        }
      } else if (brandTextIdx >= 0 && cols[brandTextIdx]) {
        const code = String(cols[brandTextIdx]).trim().toLowerCase();
        brandId = brandByCode.get(code) || '';
        if (!brandId) {
          errors.push({ row: rowNumber, error: `Unknown brand: ${cols[brandTextIdx]}` });
          return;
        }
      } else if (defaultBrandId) {
        brandId = defaultBrandId;
      } else {
        errors.push({ row: rowNumber, error: 'brand is required (brandId/brandCode or defaultBrandId)' });
        return;
      }

      docs.push({
        domain: normalized.domainNormalized,
        brand: brandId,
        note: rawNote,
        isActive: true,
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });
      meta.push({ row: rowNumber, domain: normalized.domainNormalized, brand: brandId, note: rawNote });
    });

    if (!docs.length) {
      return res.status(400).json({ error: 'No valid rows to insert', errors });
    }

    let insertedDocs = [];
    let duplicateCount = 0;
    let writeErrors = [];

    try {
      insertedDocs = await Domain.insertMany(docs, { ordered: false });
    } catch (err) {
      insertedDocs = err.insertedDocs || [];
      writeErrors = err.writeErrors || [];

      writeErrors.forEach((we) => {
        if (we.code === 11000) {
          duplicateCount += 1;
          const row = meta[we.index]?.row;
          if (row) errors.push({ row, error: 'Duplicate domain for this brand (skipped)' });
          return;
        }

        const row = meta[we.index]?.row;
        errors.push({ row: row || null, error: we.errmsg || 'Insert failed' });
      });
    }

    if (insertedDocs.length) {
      await DomainActivityLog.insertMany(
        insertedDocs.map((doc) => ({
          action: DOMAIN_ACTIVITY_ACTIONS.ADD,
          domain: doc.domain,
          domainHostKey: doc.domainHostKey,
          note: doc.note,
          brand: doc.brand,
          actor: req.user._id,
          metadata: { source: 'bulk_csv' },
        })),
        { ordered: false }
      );
    }

    return res.status(201).json({
      ok: true,
      totalRows: rows.length,
      validRows: docs.length,
      createdCount: insertedDocs.length,
      duplicateCount,
      errorCount: errors.length,
      errors: errors.slice(0, 200),
    });
  } catch (error) {
    return next(error);
  }
};

const deleteDomain = async (req, res, next) => {
  try {
    const domain = await Domain.findById(req.params.id);
    if (!domain) {
      return res.status(404).json({ error: 'Domain not found' });
    }

    await DomainActivityLog.create({
      action: DOMAIN_ACTIVITY_ACTIONS.DELETE,
      domain: domain.domain,
      domainHostKey: domain.domainHostKey,
      note: domain.note,
      brand: domain.brand,
      actor: req.user._id,
    });

    await domain.deleteOne();
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getDomains,
  createDomain,
  bulkCreateDomains,
  deleteDomain,
};
