/**
 * Scope Enforcement Middleware (SH1)
 * Restricts API requests for scoped share links.
 * 
 * Invariants:
 * 1. Complete bypass for admin and general viewers (zero overhead).
 * 2. Strict read-only (mutations rejected with 403).
 * 3. Route allowlist: only approved presentation routes allowed; everything else 403.
 * 4. Tab guard: unapproved tabs rejected with 403.
 * 5. Parameter override: client companyIds/costCenters intersected or replaced by scope.
 * 6. distributeAdmin rejected with 403 if requested.
 * 7. Detail routes: partners and companies outside scope rejected with 403.
 * 8. Cache isolation: runs within CacheService.runWithScope to namespace all cache keys.
 * 9. Response sanitization: zero outsider cost center / company data leaks in JSON.
 */

const { getDb } = require('../db/connection');
const CacheService = require('../services/cache');

// Allowed routes for scoped viewers
const ALLOWED_EXACT_ROUTES = [
  '/sync/latest-status',
  '/companies',
  '/filters',
  '/search/tree'
];

function isRouteAllowed(path) {
  // Auth routes are handled before this middleware
  if (path.startsWith('/auth/')) return true;
  if (path.startsWith('/preferences/')) return true;

  // Exact allowlist routes
  if (ALLOWED_EXACT_ROUTES.includes(path)) return true;

  // Tab routes
  if (path === '/executive' || path.startsWith('/executive/')) return true;
  if (path === '/customers-collection' || path.startsWith('/customers-collection/')) return true;
  if (path === '/actual-collections' || path.startsWith('/actual-collections/')) return true;
  if (path === '/departments-profitability' || path.startsWith('/departments-profitability/')) return true;

  return false;
}

function getTabForPath(path) {
  if (path === '/executive' || path.startsWith('/executive/')) return 'executive';
  if (path === '/customers-collection' || path.startsWith('/customers-collection/')) return 'customers';
  if (path === '/actual-collections' || path.startsWith('/actual-collections/')) return 'actual-collections';
  if (path === '/departments-profitability' || path.startsWith('/departments-profitability/')) return 'profitability';
  return null;
}

function isPartnerInScope(db, companyId, partnerId, scopedCostCenters) {
  if (!partnerId) return true;
  const numPartnerId = Number(partnerId);
  if (!numPartnerId) return true;
  const numCompanyId = Number(companyId);

  const allowedKeys = (scopedCostCenters || [])
    .filter(sc => Number(sc.companyId) === numCompanyId)
    .map(sc => sc.costCenterKey);
  if (allowedKeys.length === 0) return false;

  const ph = allowedKeys.map(() => '?').join(',');

  try {
    // Resolve sales_company_id
    const coRow = db.prepare(`
      SELECT sc.id as sales_cid
      FROM companies c
      JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
      WHERE c.id = ?
    `).get(numCompanyId);
    const salesCid = coRow?.sales_cid;
    if (!salesCid) return false;

    // Check sales invoices & departments
    const invRow = db.prepare(`
      SELECT 1 FROM sales_invoices si
      JOIN invoice_departments idep ON idep.sales_invoice_id = si.id
      WHERE si.company_id = ?
        AND si.partner_id = ?
        AND idep.cost_center_key IN (${ph})
      LIMIT 1
    `).get(salesCid, numPartnerId, ...allowedKeys);
    if (invRow) return true;

    // Check payment allocations
    const paRow = db.prepare(`
      SELECT 1 FROM payment_allocations pa
      WHERE pa.company_id = ?
        AND pa.partner_id = ?
        AND pa.cost_center_key IN (${ph})
      LIMIT 1
    `).get(numCompanyId, numPartnerId, ...allowedKeys);
    return Boolean(paRow);
  } catch (err) {
    console.error('[Scope] Partner check error:', err.message);
    return false;
  }
}

function enforceScope(req, res, next) {
  // 1. Bypass completely if not a scoped viewer
  if (!req.scopedShare) {
    return next();
  }

  const { scopedShare } = req;
  const path = req.path;

  // 2. Strict read-only: deny all mutations except UI preferences PUT
  if (req.method !== 'GET') {
    if (req.method === 'PUT' && path.startsWith('/preferences/')) {
      return next();
    }
    return res.status(403).json({
      error: 'غير مصرح بالعمليات التعديلية للمشاهد المقيد',
      code: 'FORBIDDEN_SCOPE'
    });
  }

  // 3. Route Allowlist check
  if (!isRouteAllowed(path)) {
    return res.status(403).json({
      error: 'المسار غير مصرح به لهذا النطاق',
      code: 'FORBIDDEN_SCOPE'
    });
  }

  // 4. Tab Guard
  const routeTab = getTabForPath(path);
  if (routeTab) {
    const allowedTabs = scopedShare.tabs || [];
    if (!allowedTabs.includes(routeTab)) {
      return res.status(403).json({
        error: 'التبويب المطلوب غير مصرح به لهذا النطاق',
        code: 'FORBIDDEN_SCOPE'
      });
    }
  }

  // 5. Admin allocation guard
  const reqRedist = req.query.distributeAdmin || req.query.redistributeAdmin;
  if (reqRedist === '1' || reqRedist === 'true') {
    if (!scopedShare.allowAdminAllocation) {
      return res.status(403).json({
        error: 'غير مصرح بتوزيع المصروفات الإدارية لهذا النطاق',
        code: 'FORBIDDEN_SCOPE'
      });
    }
  }
  req.query.distributeAdmin = '0';
  req.query.redistributeAdmin = '0';

  // 6. Scope Companies & Cost Centers
  const scopeCenters = scopedShare.costCenters || [];
  const scopeCompanyIds = Array.from(new Set(scopeCenters.map(c => Number(c.companyId)))).filter(Boolean);
  const scopeBareKeys = Array.from(new Set(scopeCenters.map(c => c.costCenterKey))).filter(Boolean);

  // Validate client companyIds
  let activeCompanyIds = scopeCompanyIds;
  if (req.query.companyIds !== undefined && req.query.companyIds !== '') {
    const reqCoIds = String(req.query.companyIds).split(',').map(Number).filter(Boolean);
    const intersected = reqCoIds.filter(id => scopeCompanyIds.includes(id));
    if (reqCoIds.length > 0 && intersected.length === 0) {
      return res.status(403).json({
        error: 'الشركات المطلوبة خارج نطاق المشاركة المخصص',
        code: 'FORBIDDEN_SCOPE'
      });
    }
    activeCompanyIds = intersected.length > 0 ? intersected : scopeCompanyIds;
  }
  req.query.companyIds = activeCompanyIds.join(',');

  // Validate client costCenters / costCenterKey
  if (req.query.costCenters !== undefined && req.query.costCenters !== '') {
    const reqCCs = String(req.query.costCenters).split(',').map(s => s.trim()).filter(Boolean);
    for (const cc of reqCCs) {
      let isAllowed = false;
      if (cc.includes('|')) {
        const [cIdStr, k] = cc.split('|');
        isAllowed = scopeCenters.some(sc => Number(sc.companyId) === Number(cIdStr) && sc.costCenterKey === k);
      } else {
        isAllowed = scopeBareKeys.includes(cc);
      }
      if (!isAllowed) {
        return res.status(403).json({
          error: 'مركز التكلفة المطلوب خارج نطاق المشاركة المخصص',
          code: 'FORBIDDEN_SCOPE'
        });
      }
    }
  }

  if (req.query.costCenterKey !== undefined && req.query.costCenterKey !== '') {
    const reqKey = String(req.query.costCenterKey).trim();
    const isAllowed = scopeBareKeys.includes(reqKey) || scopeCenters.some(sc => `${sc.companyId}|${sc.costCenterKey}` === reqKey);
    if (!isAllowed) {
      return res.status(403).json({
        error: 'مركز التكلفة المطلوب خارج نطاق المشاركة المخصص',
        code: 'FORBIDDEN_SCOPE'
      });
    }
  }

  // Force matching scope pairs for active companies
  const activePairs = scopeCenters
    .filter(c => activeCompanyIds.includes(Number(c.companyId)))
    .map(c => `${c.companyId}|${c.costCenterKey}`);

  req.query.costCenters = activePairs.join(',');
  req.query.journalIds = activePairs.join(',');
  delete req.query.groupIds;
  delete req.query.departmentIds;

  // 7. Detail Routes Guard (Partner & Company)
  const db = getDb();
  if (req.query.companyId) {
    const cId = Number(req.query.companyId);
    if (!scopeCompanyIds.includes(cId)) {
      return res.status(403).json({
        error: 'الشركة المطلوبة خارج نطاق المشاركة المخصص',
        code: 'FORBIDDEN_SCOPE'
      });
    }
  }

  if (req.query.partnerId) {
    const cId = Number(req.query.companyId) || activeCompanyIds[0];
    const inScope = isPartnerInScope(db, cId, req.query.partnerId, scopeCenters);
    if (!inScope) {
      return res.status(403).json({
        error: 'العميل المطلوب خارج نطاق المشاركة',
        code: 'FORBIDDEN_SCOPE'
      });
    }
  }

  // 8. Setup Response Sanitization (pruning outsider names/metadata from JSON)
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (data && typeof data === 'object') {
      try {
        // (a) /companies: restrict returned companies to in-scope companies
        if (path === '/companies' && Array.isArray(data)) {
          data = data.filter(c => activeCompanyIds.includes(Number(c.id)));
        }

        // (b) /actual-collections: strip outsider amounts from accounts comparison
        if (path === '/actual-collections' && data.accounts_comparison) {
          delete data.accounts_comparison.allocated_other_journals;
          delete data.accounts_comparison.other_journals_breakdown;
        }

        // (c) /filters: strip original_journals from journals
        if (path === '/filters' && Array.isArray(data.journals)) {
          for (const j of data.journals) {
            delete j.original_journals;
          }
        }
      } catch (err) {
        console.error('[Scope Sanitizer] Error:', err.message);
      }
    }
    return originalJson(data);
  };

  // 9. Run in Cache Isolation context
  CacheService.runWithScope({ scopedShareId: scopedShare.id }, () => {
    next();
  });
}

module.exports = {
  enforceScope,
  isRouteAllowed,
  isPartnerInScope
};
