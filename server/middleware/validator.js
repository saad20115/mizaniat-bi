/**
 * Query Filter Validation Middleware
 * Rejects invalid, malicious, or malformed query parameters with HTTP 400.
 * Protects against SQL injections, NaN strings, and illegal parameters.
 */

function validateFilterQuery(req, res, next) {
  const query = req.query;
  if (!query || typeof query !== 'object') return next();

  const sqlInjectionRegex = /(--|\/\*|\*\/|;|\b(UNION\s+(?:ALL\s+)?SELECT|DROP\s+TABLE|ALTER\s+TABLE|DELETE\s+FROM|INSERT\s+INTO|UPDATE\s+\w+\s+SET)\b|\b(?:OR|AND)\s+['"\d\w]+\s*=\s*['"\d\w]+|['"])/i;

  const targetParams = [
    'companyIds', 'masterCompanyIds', 'companyId',
    'departmentIds', 'groupIds', 'departmentId',
    'journalIds', 'journalId', 'journalNames', 'journalName',
    'costCenters', 'costCenterKey',
    'partnerIds', 'partnerId',
    'years', 'year'
  ];

  for (const param of targetParams) {
    const val = query[param];
    if (val === undefined || val === null || val === '') continue;

    const list = Array.isArray(val) ? val : String(val).split(',');
    for (const rawItem of list) {
      const s = String(rawItem).trim();
      if (!s) continue;

      const lower = s.toLowerCase();
      if (lower === 'nan' || lower === 'null' || lower === 'undefined') {
        return res.status(400).json({
          error: `قيمة غير صالحة (${s}) في معلمة التصفية ${param}`,
          code: 'INVALID_FILTER_PARAM',
          param
        });
      }

      if (sqlInjectionRegex.test(s)) {
        return res.status(400).json({
          error: `محتوى غير مسموح به في معلمة التصفية ${param}`,
          code: 'INVALID_FILTER_PARAM',
          param
        });
      }

      // Numeric ID check
      if (
        param === 'companyIds' || param === 'masterCompanyIds' || param === 'companyId' ||
        param === 'departmentIds' || param === 'groupIds' || param === 'departmentId' ||
        param === 'partnerIds' || param === 'partnerId'
      ) {
        if (!/^\d+$/.test(s) || Number(s) <= 0) {
          return res.status(400).json({
            error: `معلمة ${param} تتطلب معرّفاً رقمياً صحيحاً (${s})`,
            code: 'INVALID_FILTER_PARAM',
            param
          });
        }
      }

      // Years check
      if (param === 'years' || param === 'year') {
        if (s !== 'ALL' && (!/^\d{4}$/.test(s) || Number(s) < 2000 || Number(s) > 2100)) {
          return res.status(400).json({
            error: `معلمة ${param} تتطلب سنة صالحة (${s})`,
            code: 'INVALID_FILTER_PARAM',
            param
          });
        }
      }

      // Cost centers / journalIds check: enforce pair format companyId|key for filter parameters
      if (param === 'journalIds' || param === 'costCenters') {
        if (/[<>{}\\]/.test(s) || !/^\d+\|(?:an:|j:).+$/.test(s)) {
          return res.status(400).json({
            error: `معلمة ${param} تتطلب صيغة زوجية صالحة companyId|key (${s})`,
            code: 'INVALID_FILTER_PARAM',
            param
          });
        }
      }

      // Single journalId may be numeric (from tree node) or pair format
      if (param === 'journalId') {
        if (/[<>{}\\]/.test(s) || !/^(?:\d+|\d+\|(?:an:|j:).+)$/.test(s)) {
          return res.status(400).json({
            error: `معلمة ${param} تتطلب معرّفاً صالحاً (${s})`,
            code: 'INVALID_FILTER_PARAM',
            param
          });
        }
      }

      if (param === 'costCenterKey') {
        if (/[<>{}\\]/.test(s) || !/^(?:\d+\|)?(?:an:|j:).+$/.test(s)) {
          return res.status(400).json({
            error: `معلمة ${param} تتطلب صيغة مركز تكلفة صالحة (${s})`,
            code: 'INVALID_FILTER_PARAM',
            param
          });
        }
      }
    }
  }

  next();
}

module.exports = {
  validateFilterQuery
};
