import { api } from '../api.js';

/**
 * Reusable Tree Table Component with Single Event Delegation & Path-based Keys
 * Designed for Mizaniat BI Hierarchical Tables (Executive Dashboard, Aging, Presentation D1/D2)
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * F1-b: Comprehensive Arabic text normalization
 * (أ إ آ ا), (ة ه), (ي ى), diacritics, tatweel, extra spaces, Indic digits
 */
export function normalizeArabic(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel/diacritics
    .replace(/\u0640/g, '') // remove tatweel (ـ)
    .replace(/[أإآٱ]/g, 'ا') // normalize alef
    .replace(/ة/g, 'ه') // normalize teh marbuta
    .replace(/[ىي]/g, 'ي') // normalize yeh
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]) // Arabic-Indic digits
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * F1-b: Match highlight helper preserving HTML escaping
 */
export function highlightMatch(text, query) {
  if (!text || !query) return escapeHtml(text || '');
  const rawText = String(text);
  const normText = normalizeArabic(rawText);
  const normQuery = normalizeArabic(query);
  if (!normQuery || !normText.includes(normQuery)) {
    return escapeHtml(rawText);
  }

  const startIdx = normText.indexOf(normQuery);
  if (startIdx === -1) return escapeHtml(rawText);

  let rawStart = 0;
  let normPos = 0;
  while (rawStart < rawText.length && normPos < startIdx) {
    const ch = rawText[rawStart];
    if (!/[\u064B-\u065F\u0670\u0640]/.test(ch)) {
      normPos++;
    }
    rawStart++;
  }
  let rawEnd = rawStart;
  let normEnd = normPos;
  while (rawEnd < rawText.length && normEnd < startIdx + normQuery.length) {
    const ch = rawText[rawEnd];
    if (!/[\u064B-\u065F\u0670\u0640]/.test(ch)) {
      normEnd++;
    }
    rawEnd++;
  }

  const before = escapeHtml(rawText.slice(0, rawStart));
  const matched = escapeHtml(rawText.slice(rawStart, rawEnd));
  const after = escapeHtml(rawText.slice(rawEnd));

  return `${before}<mark class="tree-search-match" style="background:var(--status-warning-subtle);color:var(--status-warning);border-radius:3px;padding:0 2px;font-weight:700;">${matched}</mark>${after}`;
}

export function getInvoiceBucket(ageDays) {
  const age = Number(ageDays) || 0;
  if (age <= 0) return 'not_due';
  if (age <= 30) return 'b1_30';
  if (age <= 60) return 'b31_60';
  if (age <= 90) return 'b61_90';
  if (age <= 180) return 'b91_180';
  if (age <= 365) return 'b181_365';
  return 'over_365';
}

export class TreeTable {
  constructor(container, options = {}) {
    this.container = container;
    this.storageKey = options.storageKey || 'mizaniat_tree_table';
    this.columns = options.columns || [];
    this.data = options.data || [];
    this.totals = options.totals || {};
    this.getNodeKey = options.getNodeKey || ((node, parentPath, depth) => {
      const type = node.type || (depth === 0 ? 'co' : depth === 1 ? 'dept' : 'node');
      const id = node.id !== undefined ? String(node.id) : (node.name || 'item');
      return parentPath ? `${parentPath}/${type}:${id}` : `${type}:${id}`;
    });
    this.getChildren = options.getChildren || (node => node.children || node.departments || node.partners || node.invoices);
    this.hasChildren = options.hasChildren || (node => {
      if (node.hasChildren !== undefined) return !!node.hasChildren;
      const kids = this.getChildren(node);
      return (kids && kids.length > 0) || !!node._canLoad;
    });
    this.loadChildren = options.loadChildren || null;
    this.renderRow = options.renderRow || this.defaultRenderRow.bind(this);
    this.renderTotals = options.renderTotals || null;
    this.onLeafClick = options.onLeafClick || null;
    this.tableClass = options.tableClass || 'exec-table';
    this.tableLayout = options.tableLayout || 'auto';

    const globalShowZeros = typeof window !== 'undefined' && window.__mizaniat_show_zero_items !== undefined ? !!window.__mizaniat_show_zero_items : false;
    this.showZeroItems = options.showZeroItems !== undefined ? !!options.showZeroItems : globalShowZeros;
    this.onHiddenCountChange = options.onHiddenCountChange || null;
    this.hiddenZeroCount = 0;

    // F1-b: Search state
    this.searchQuery = options.searchQuery || '';
    this.normalizedQuery = normalizeArabic(this.searchQuery);
    this.matchedCount = 0;
    this.preSearchExpandedKeys = null;
    this.searchContext = options.searchContext || {};
    this.onSearchMatchCountChange = options.onSearchMatchCountChange || null;
    this.emptyMessage = options.emptyMessage || 'لا توجد بيانات متاحة';

    // RESP1: ensure container has data-scroll-x="true" and responsive wrapper
    if (this.container) {
      this.container.setAttribute('data-scroll-x', 'true');
      this.container.classList.add('tree-table-wrap');
    }

    this.expandedKeys = this.loadExpandedKeys();
    this.pathMap = new Map();

    this.initEvents();
    this.render();

    if (options.searchInput) {
      this.bindSearchInput(options.searchInput, options.searchOptions || {});
    }

    if (typeof this.loadChildren === 'function' && this.expandedKeys.size > 0) {
      this.refreshExpandedLazyNodes();
    }
  }

  loadExpandedKeys() {
    try {
      const saved = sessionStorage.getItem(this.storageKey);
      if (saved) {
        const arr = JSON.parse(saved);
        return new Set(Array.isArray(arr) ? arr.map(String) : []);
      }
    } catch (e) {
      console.warn('[TreeTable] Failed to load expanded keys:', e);
    }
    return new Set();
  }

  saveExpandedKeys() {
    try {
      sessionStorage.setItem(this.storageKey, JSON.stringify([...this.expandedKeys]));
    } catch (e) {
      console.warn('[TreeTable] Failed to save expanded keys:', e);
    }
  }

  initEvents() {
    if (this.container._treeTableDelegated) return;
    this.container._treeTableDelegated = true;

    this.container.addEventListener('click', async (e) => {
      const row = e.target.closest('[data-tree-row="true"]');
      if (!row) return;

      const pathKey = row.dataset.pathKey;
      if (!pathKey) return;

      const node = this.pathMap.get(pathKey);
      if (!node) return;

      // Tap on name text toggles full name view on mobile/tablet (RESP1)
      if (e.target.closest('[data-tree-name="true"]')) {
        const td = e.target.closest('td');
        const title = td?.getAttribute('title');
        if (title && window.innerWidth < 1280) {
          const el = e.target.closest('[data-tree-name="true"]');
          if (el.dataset.expanded === 'true') {
            el.dataset.expanded = 'false';
            el.style.whiteSpace = 'nowrap';
          } else {
            el.dataset.expanded = 'true';
            el.style.whiteSpace = 'normal';
          }
          return;
        }
      }

      const canExpand = this.hasChildren(node);

      if (!canExpand) {
        if (typeof this.onLeafClick === 'function') {
          this.onLeafClick(node, pathKey, e);
        }
        return;
      }

      // Expand / Collapse toggle
      if (this.expandedKeys.has(pathKey)) {
        this.expandedKeys.delete(pathKey);
        this.saveExpandedKeys();
        this.render();
      } else {
        const currentKids = this.getChildren(node);
        if (typeof this.loadChildren === 'function' && (!currentKids || currentKids.length === 0)) {
          node._loading = true;
          this.render();
          try {
            const loaded = await this.loadChildren(node, pathKey);
            if (Array.isArray(loaded)) {
              if (node.children) node.children = loaded;
              else if (node.partners) node.partners = loaded;
              else if (node.invoices) node.invoices = loaded;
              else node.children = loaded;
            }
          } catch (err) {
            console.error('[TreeTable] loadChildren error for path:', pathKey, err);
          } finally {
            node._loading = false;
          }
        }
        this.expandedKeys.add(pathKey);
        this.saveExpandedKeys();
        this.render();
      }
    });
  }

  async refreshExpandedLazyNodes() {
    if (!this.loadChildren || this.expandedKeys.size === 0) return;

    const refreshNodeRecursive = async (node, parentPath, depth) => {
      const pathKey = this.getNodeKey(node, parentPath, depth);
      if (this.expandedKeys.has(pathKey)) {
        const kids = this.getChildren(node);
        if (!kids || kids.length === 0) {
          try {
            const loaded = await this.loadChildren(node, pathKey);
            if (Array.isArray(loaded)) {
              if (node.children) node.children = loaded;
              else if (node.partners) node.partners = loaded;
              else if (node.invoices) node.invoices = loaded;
              else node.children = loaded;
            }
          } catch (err) {
            console.error('[TreeTable] refreshExpandedLazyNodes error:', pathKey, err);
          }
        }
        const updatedKids = this.getChildren(node);
        if (Array.isArray(updatedKids)) {
          for (const kid of updatedKids) {
            await refreshNodeRecursive(kid, pathKey, depth + 1);
          }
        }
      }
    };

    for (const rootNode of this.data) {
      await refreshNodeRecursive(rootNode, null, 0);
    }
    this.render();
  }

  async setData(data, totals) {
    this.data = data || [];
    if (totals !== undefined) this.totals = totals;
    this.render();
    if (typeof this.loadChildren === 'function' && this.expandedKeys.size > 0) {
      await this.refreshExpandedLazyNodes();
    }
  }

  setColumns(columns) {
    this.columns = columns;
    this.render();
  }

  expandPath(pathKey) {
    if (pathKey) this.expandedKeys.add(String(pathKey));
    this.saveExpandedKeys();
    this.render();
  }

  expandPaths(paths) {
    if (Array.isArray(paths)) {
      for (const p of paths) this.expandedKeys.add(String(p));
      this.saveExpandedKeys();
      this.render();
    }
  }

  expandAll(keys) {
    if (Array.isArray(keys)) {
      for (const k of keys) this.expandedKeys.add(String(k));
    } else {
      const collect = (node, parentPath = '', depth = 0) => {
        const pk = this.getNodeKey(node, parentPath, depth);
        this.expandedKeys.add(pk);
        const kids = this.getChildren(node) || [];
        for (const k of kids) collect(k, pk, depth + 1);
      };
      const rootList = Array.isArray(this.data) ? this.data : (this.data.rows || []);
      for (const r of rootList) collect(r, '', 0);
    }
    this.saveExpandedKeys();
    this.render();
  }

  collapseAll() {
    this.expandedKeys.clear();
    this.saveExpandedKeys();
    this.render();
  }

  isNodeSelfZero(node) {
    if (!node) return true;

    // Fast-path: Check common total / net_profit properties directly
    if (node.total !== undefined && node.total !== null) {
      const nTot = Number(node.total);
      if (!isNaN(nTot) && Math.abs(nTot) >= 0.5) return false;
    }
    if (node.net_profit !== undefined && node.net_profit !== null) {
      const nNet = Number(node.net_profit);
      if (!isNaN(nNet) && Math.abs(nNet) >= 0.5) return false;
    }
    if (node.total_revenue !== undefined && node.total_revenue !== null) {
      const nRev = Number(node.total_revenue);
      if (!isNaN(nRev) && Math.abs(nRev) >= 0.5) return false;
    }
    if (node.total_expenses !== undefined && node.total_expenses !== null) {
      const nExp = Number(node.total_expenses);
      if (!isNaN(nExp) && Math.abs(nExp) >= 0.5) return false;
    }

    // Check all visible columns for non-zero displayed numbers
    for (const col of this.columns) {
      if (!col || !col.id) continue;
      const id = col.id;
      // Skip structural, descriptive or action columns
      if (id === 'name' || id === 'actions' || id === 'index' || id === 'id' || id === 'code' || id === 'tag' || id === 'type' || id === 'level' || col.type === 'action') {
        continue;
      }
      // Skip relative percentage & visual columns
      if (id === 'contribution' || id === 'margin' || id === 'collection_rate' || id === 'visual' || id === 'bar') {
        continue;
      }

      let val = node[id];
      if (val === undefined && node.periods) val = node.periods[id];
      if (val === undefined && node.values) val = node.values[id];
      if (val === undefined || val === null) continue;

      if (typeof val === 'number') {
        if (Math.abs(val) >= 0.5) return false;
      } else if (typeof col.format === 'function') {
        try {
          const formatted = String(col.format(val, node));
          const stripped = formatted.replace(/<[^>]*>/g, '').replace(/[\s,،ر.سSAR%\u200e\u200f]/g, '');
          if (stripped !== '' && stripped !== '—' && stripped !== '-' && !/^0(\.0+)?$/.test(stripped)) {
            return false;
          }
        } catch (e) {}
      } else {
        const num = Number(val);
        if (!isNaN(num) && Math.abs(num) >= 0.005) {
          return false;
        }
      }
    }

    // Residual / balance / remaining amount check (financial position balances stay visible)
    const balanceKeys = ['residual', 'remaining_amount', 'balance', 'total_due', 'net_balance', 'net_tax_due', 'amount'];
    for (const bk of balanceKeys) {
      if (node[bk] !== undefined && node[bk] !== null) {
        const bNum = Number(node[bk]);
        if (!isNaN(bNum) && Math.abs(bNum) >= 0.005) {
          return false;
        }
      }
    }

    // Opposing period values check (+500 and -500)
    if (node.periods && typeof node.periods === 'object') {
      for (const pKey in node.periods) {
        const pVal = Number(node.periods[pKey]);
        if (!isNaN(pVal) && Math.abs(pVal) >= 0.005) {
          return false;
        }
      }
    }
    if (node.values && typeof node.values === 'object') {
      for (const vKey in node.values) {
        const vVal = Number(node.values[vKey]);
        if (!isNaN(vVal) && Math.abs(vVal) >= 0.005) {
          return false;
        }
      }
    }

    return true;
  }

  isSubtreeZero(node, cache = null) {
    if (!node) return true;
    if (cache && cache.has(node)) return cache.get(node);
    if (!this.isNodeSelfZero(node)) {
      if (cache) cache.set(node, false);
      return false;
    }
    const kids = this.getChildren(node);
    if (Array.isArray(kids) && kids.length > 0) {
      for (const kid of kids) {
        if (!this.isSubtreeZero(kid, cache)) {
          if (cache) cache.set(node, false);
          return false;
        }
      }
    }
    if (cache) cache.set(node, true);
    return true;
  }

  countExpandedNodes(forceShowZeros = true) {
    let count = 0;
    const subtreeZeroCache = new WeakMap();
    const traverse = (node, parentPath = '', depth = 0) => {
      if (!this.normalizedQuery && !forceShowZeros && this.isSubtreeZero(node, subtreeZeroCache)) {
        return;
      }
      if (this.normalizedQuery && !this.hasSearchMatchInSubtree(node)) {
        return;
      }
      count++;
      const pathKey = this.getNodeKey(node, parentPath, depth);
      if (this.expandedKeys.has(pathKey)) {
        const kids = this.getChildren(node) || [];
        for (const child of kids) {
          traverse(child, pathKey, depth + 1);
        }
      }
    };
    const rootList = Array.isArray(this.data) ? this.data : (this.data.rows || []);
    for (const rootNode of rootList) {
      traverse(rootNode, '', 0);
    }
    return count;
  }

  getHiddenZeroCount(visibleRows) {
    if (this.showZeroItems) return 0;
    const visibleCount = visibleRows ? visibleRows.length : this.countExpandedNodes(false);
    const totalCount = this.countExpandedNodes(true);
    return Math.max(0, totalCount - visibleCount);
  }

  setShowZeroItems(show) {
    this.showZeroItems = !!show;
    this.render();
  }

  matchesSearch(node) {
    if (!this.normalizedQuery) return false;
    const normQ = this.normalizedQuery;
    const fields = [
      node.name,
      node.label,
      node.invoice_name,
      node.number,
      node.move_name,
      node.partner_name,
      node.client_name,
      node.account_code,
      node.code,
      node.account_name,
      node.journal_name,
      node.department_name,
      node.group_name
    ];
    for (const f of fields) {
      if (f !== undefined && f !== null && normalizeArabic(f).includes(normQ)) {
        return true;
      }
    }
    return false;
  }

  hasSearchMatchInSubtree(node) {
    if (this.matchesSearch(node)) return true;
    const kids = this.getChildren(node);
    if (Array.isArray(kids)) {
      for (const kid of kids) {
        if (this.hasSearchMatchInSubtree(kid)) return true;
      }
    }
    return false;
  }

  flattenTree(forceShowZeros = this.showZeroItems) {
    this.pathMap.clear();
    const visible = [];
    if (this.normalizedQuery) {
      this.matchedCount = 0;
    }
    const subtreeZeroCache = new WeakMap();

    const traverse = (node, parentPath = '', depth = 0) => {
      // If zero hiding is active, hide entire subtree if all values are zero (only when not searching)
      if (!this.normalizedQuery && !forceShowZeros && this.isSubtreeZero(node, subtreeZeroCache)) {
        return;
      }

      // Search filter: prune node if neither it nor its subtree matches
      if (this.normalizedQuery && !this.hasSearchMatchInSubtree(node)) {
        return;
      }

      const pathKey = this.getNodeKey(node, parentPath, depth);
      this.pathMap.set(pathKey, node);

      const nodeIsMatch = this.matchesSearch(node);
      if (nodeIsMatch) {
        this.matchedCount++;
      }

      // Auto-expand parents during search so matched items are shown
      if (this.normalizedQuery && this.hasSearchMatchInSubtree(node)) {
        this.expandedKeys.add(pathKey);
      }

      const isExpanded = this.expandedKeys.has(pathKey);
      const allKids = this.getChildren(node) || [];
      const kids = forceShowZeros 
        ? allKids 
        : (this.normalizedQuery ? allKids.filter(k => this.hasSearchMatchInSubtree(k)) : allKids.filter(k => !this.isSubtreeZero(k, subtreeZeroCache)));
      
      const hasKids = forceShowZeros 
        ? this.hasChildren(node)
        : (kids.length > 0 || (this.hasChildren(node) && !this.isNodeSelfZero(node)));
      
      const isLeaf = !hasKids;

      visible.push({
        node,
        pathKey,
        depth,
        isExpanded,
        hasKids,
        isLeaf,
        isSearchMatch: nodeIsMatch
      });

      if (isExpanded && hasKids && kids.length > 0) {
        for (const child of kids) {
          traverse(child, pathKey, depth + 1);
        }
      }
    };

    const rootList = Array.isArray(this.data) ? this.data : (this.data.rows || []);
    for (const rootNode of rootList) {
      traverse(rootNode, '', 0);
    }

    return visible;
  }

  defaultRenderRow({ node, pathKey, depth, isExpanded, hasKids, isLeaf }) {
    const chevronDown = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
    const chevronLeft = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
    const spinIcon = '<svg class="spin-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>';
    const icon = node._loading ? spinIcon : hasKids ? (isExpanded ? chevronDown : chevronLeft) : '•';
    const cursor = hasKids ? 'cursor:pointer;' : (this.onLeafClick ? 'cursor:pointer;' : '');
    const bg = depth === 0 ? 'background:var(--bg-subtle);font-weight:700;' : '';
    const nodeName = node.name || node.label || '';
    const firstCol = this.columns[0] || { id: 'name' };
    const indent = depth * (this.indentWidth || 20);

    return `
      <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${bg}">
        <td data-col-id="${firstCol.id}" data-priority="1" class="tree-col-name" style="padding:8px 12px;padding-right:${indent + 12}px;text-align:right;" title="${escapeHtml(nodeName)}">
          <span data-tree-toggle="true" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-left:4px;color:var(--text-muted);vertical-align:middle;">${icon}</span>
          <span class="tree-node-name" data-tree-name="true" title="${escapeHtml(nodeName)}" style="display:inline;vertical-align:middle;word-break:break-word;">${escapeHtml(nodeName)}</span>
        </td>
        ${this.columns.slice(1).map(col => {
          const val = node[col.id] !== undefined ? node[col.id] : '';
          const formatted = col.format ? col.format(val, node) : escapeHtml(val);
          const prio = col.priority || 1;
          const isAction = col.id === 'actions';
          const isFlex = !!col.flex;
          const isVisual = col.id === 'visual' || col.id === 'vat_visual' || col.id === 'aging_visual' || isFlex;
          const wStyle = isAction ? 'width:36px;' : (isFlex ? 'width:auto;' : (col.width ? `width:${col.width};` : 'width:85px;'));
          const minW = isAction ? 'min-width:36px;' : (isFlex ? 'min-width:100px;' : (col.minWidth ? `min-width:${col.minWidth};` : 'min-width:75px;'));
          const maxW = isAction ? 'max-width:36px;' : (isFlex ? '' : (col.maxWidth ? `max-width:${col.maxWidth};` : ''));
          const colClass = isAction ? 'tree-col-action' : (isVisual ? 'tree-col-visual' : 'tree-col-num');
          const padStyle = isAction ? 'padding:6px 2px;' : (isVisual ? 'padding:6px 6px;' : 'padding:6px 10px;');
          return `<td data-col-id="${col.id}" data-priority="${prio}" class="${colClass}" style="text-align:${col.align || 'left'};${wStyle}${minW}${maxW}${padStyle}">${formatted}</td>`;
        }).join('')}
      </tr>
    `;
  }

  async setSearchQuery(query, searchContext = {}) {
    const cleanQ = (query || '').trim();
    if (searchContext && Object.keys(searchContext).length > 0) {
      this.searchContext = { ...this.searchContext, ...searchContext };
    }

    if (!cleanQ) {
      this.searchQuery = '';
      this.normalizedQuery = '';
      if (this.preSearchExpandedKeys) {
        this.expandedKeys = new Set(this.preSearchExpandedKeys);
        this.preSearchExpandedKeys = null;
        this.saveExpandedKeys();
      }
      this.matchedCount = 0;
      this.render();
      if (typeof this.onSearchMatchCountChange === 'function') {
        this.onSearchMatchCountChange(0);
      }
      return;
    }

    if (!this.searchQuery && this.expandedKeys) {
      this.preSearchExpandedKeys = new Set(this.expandedKeys);
    }

    this.searchQuery = cleanQ;
    this.normalizedQuery = normalizeArabic(cleanQ);

    // Deep search for remote / lazy nodes if pattern matches or 2+ chars
    if (cleanQ.length >= 2) {
      try {
        const res = await api.searchTree({
          query: cleanQ,
          companyIds: this.searchContext?.companyIds,
          years: this.searchContext?.years,
          dateFrom: this.searchContext?.dateFrom,
          dateTo: this.searchContext?.dateTo
        });
        if (res && Array.isArray(res.matches) && res.matches.length > 0) {
          for (const m of res.matches) {
            const pathsToExpand = [];
            if (Array.isArray(m.exec_path)) pathsToExpand.push(m.exec_path);
            if (Array.isArray(m.path)) pathsToExpand.push(m.path);

            for (const pArr of pathsToExpand) {
              for (let pIdx = 0; pIdx < pArr.length; pIdx++) {
                const subPath = pArr.slice(0, pIdx + 1).join('/');
                this.expandedKeys.add(subPath);
              }
            }
          }
          if (typeof this.loadChildren === 'function') {
            await this.refreshExpandedLazyNodes();
          }
        }
      } catch (err) {
        console.warn('[TreeTable] Remote tree search error:', err);
      }
    }

    this.render();
    if (typeof this.onSearchMatchCountChange === 'function') {
      this.onSearchMatchCountChange(this.matchedCount);
    }
  }

  bindSearchInput(inputEl, options = {}) {
    if (!inputEl) return;
    const counterEl = options.counterEl || options.countElement || null;
    const clearBtnEl = options.clearBtnEl || options.clearButton || null;
    const searchContext = options.searchContext || this.searchContext || {};
    let debounceTimer = null;

    const updateUIState = (count) => {
      if (counterEl) {
        if (!this.searchQuery) {
          counterEl.style.display = 'none';
          counterEl.textContent = '';
        } else if (count > 0) {
          counterEl.style.display = 'inline-block';
          counterEl.textContent = `${count} نتيجة`;
          counterEl.style.background = 'var(--status-positive-subtle)';
          counterEl.style.color = 'var(--status-positive)';
        } else {
          counterEl.style.display = 'inline-block';
          counterEl.textContent = 'لا توجد نتائج';
          counterEl.style.background = 'var(--status-negative-subtle)';
          counterEl.style.color = 'var(--status-negative)';
        }
      }
      if (clearBtnEl) {
        clearBtnEl.style.display = this.searchQuery ? 'inline-flex' : 'none';
      }
    };

    this.onSearchMatchCountChange = (count) => {
      updateUIState(count);
      if (typeof options.onMatchCountChange === 'function') {
        options.onMatchCountChange(count);
      }
    };

    inputEl.addEventListener('input', (e) => {
      const q = e.target.value;
      if (clearBtnEl) clearBtnEl.style.display = q.trim() ? 'inline-flex' : 'none';
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.setSearchQuery(q, searchContext);
      }, 250);
    });

    if (clearBtnEl) {
      clearBtnEl.addEventListener('click', () => {
        inputEl.value = '';
        if (debounceTimer) clearTimeout(debounceTimer);
        this.setSearchQuery('', searchContext);
        inputEl.focus();
      });
    }

    if (inputEl.value) {
      this.setSearchQuery(inputEl.value, searchContext);
    }
  }

  applySearchHighlights() {
    if (!this.searchQuery || !this.normalizedQuery) return;
    const nameEls = this.container.querySelectorAll('.tree-node-name, .tree-col-name span[data-tree-name="true"]');
    nameEls.forEach(el => {
      const orig = el.getAttribute('data-orig-text') || el.textContent;
      if (!el.getAttribute('data-orig-text')) {
        el.setAttribute('data-orig-text', orig);
      }
      el.innerHTML = highlightMatch(orig, this.searchQuery);
    });
  }

  render() {
    const visibleRows = this.flattenTree();
    this.hiddenZeroCount = this.showZeroItems ? 0 : this.getHiddenZeroCount(visibleRows);
    if (typeof this.onHiddenCountChange === 'function') {
      try { this.onHiddenCountChange(this.hiddenZeroCount); } catch (e) {}
    }
    if (typeof window !== 'undefined' && typeof window.updateHiddenZeroBadge === 'function') {
      try { window.updateHiddenZeroBadge(this.hiddenZeroCount); } catch (e) {}
    }

    const theadHtml = `
      <thead>
        <tr style="background:var(--exec-sticky-bg);">
          ${this.columns.map((col, idx) => {
            const isFirst = idx === 0;
            const isAction = col.id === 'actions';
            const isFlex = !!col.flex;
            const isVisual = col.id === 'visual' || col.id === 'vat_visual' || col.id === 'aging_visual' || isFlex;
            const prio = col.priority || 1;
            const wStyle = isFirst ? 'width:auto;' : (isAction ? 'width:36px;' : (isFlex ? 'width:auto;' : (col.width ? `width:${col.width};` : 'width:85px;')));
            const minW = isFirst ? (col.minWidth ? `min-width:${col.minWidth};` : 'min-width:160px;') : (isAction ? 'min-width:36px;' : (isFlex ? 'min-width:100px;' : (col.minWidth ? `min-width:${col.minWidth};` : 'min-width:75px;')));
            const maxW = isFirst ? '' : (isAction ? 'max-width:36px;' : (isFlex ? '' : (col.maxWidth ? `max-width:${col.maxWidth};` : '')));
            const align = col.align || (isFirst ? 'right' : (isVisual ? 'center' : 'left'));
            const colColor = col.color ? `color:${col.color};` : '';
            const padStyle = isAction ? 'padding:6px 2px;' : (isFirst ? 'padding:12px 14px;' : (isVisual ? 'padding:12px 6px;' : 'padding:12px 10px;'));
            const colClass = isFirst ? 'tree-col-name' : (isAction ? 'tree-col-action' : (isVisual ? 'tree-col-visual' : 'tree-col-num'));
            return `
              <th data-col-id="${col.id}" data-priority="${prio}" ${col.title ? `title="${escapeHtml(col.title)}"` : ''} class="${colClass}" style="text-align:${align};font-size:12px;font-weight:500;${wStyle}${minW}${maxW}${colColor}${padStyle}">
                ${escapeHtml(col.label)}
              </th>
            `;
          }).join('')}
        </tr>
      </thead>
    `;

    let tbodyHtml = '';
    if (visibleRows.length === 0) {
      const msg = this.searchQuery 
        ? `لا توجد نتائج مطابقة للبحث «${escapeHtml(this.searchQuery)}»`
        : (this.emptyMessage || 'لا توجد بيانات متاحة');
      tbodyHtml = `
        <tbody>
          <tr>
            <td colspan="${this.columns.length}" style="text-align:center;padding:36px;color:var(--text-muted);font-size:1.05rem;">
              ${escapeHtml(msg)}
            </td>
          </tr>
        </tbody>
      `;
    } else {
      tbodyHtml = `
        <tbody>
          ${visibleRows.map(rowCtx => this.renderRow(rowCtx, this.columns)).join('')}
        </tbody>
      `;
    }

    let tfootHtml = '';
    const hasSearchActive = !!(this.searchQuery && this.matchedCount > 0);
    let searchSubtotalRow = '';

    if (hasSearchActive) {
      const searchTotals = {};
      const numCols = this.columns.filter(c => c.id !== 'name' && c.id !== 'actions' && c.id !== 'visual' && c.id !== 'aging_visual' && !c.flex);
      for (const row of visibleRows) {
        if (row.isLeaf || row.isSearchMatch) {
          for (const col of numCols) {
            const val = Number(row.node[col.id]);
            if (!isNaN(val)) {
              searchTotals[col.id] = (searchTotals[col.id] || 0) + val;
            }
          }
        }
      }

      searchSubtotalRow = `
        <tr class="tree-search-subtotal-row" style="background:var(--status-warning-subtle);border-top:1px solid var(--status-warning);border-bottom:1px solid var(--status-warning);font-weight:700;font-size:0.95rem;color:var(--text-primary);">
          <td class="tree-col-name" data-col-id="name" style="padding:12px 16px;color:var(--status-warning);">
            مجموع النتائج الظاهرة (${this.matchedCount} نتيجة):
          </td>
          ${this.columns.slice(1).map(col => {
            if (col.id === 'actions' || col.id === 'visual' || col.id === 'vat_visual' || col.id === 'aging_visual' || col.flex) {
              return `<td class="tree-col-action" style="padding:12px 2px;"></td>`;
            }
            const val = searchTotals[col.id] !== undefined ? searchTotals[col.id] : null;
            let formatted = '—';
            if (val !== null && !isNaN(val)) {
              formatted = col.format ? col.format(val, searchTotals) : Math.round(val).toLocaleString('en-US');
            }
            return `<td class="tree-col-num tabular-nums" data-col-id="${col.id}" style="text-align:${col.align || 'left'};padding:12px 10px;color:var(--status-warning);">${formatted}</td>`;
          }).join('')}
        </tr>
      `;
    }

    if (typeof this.renderTotals === 'function' || hasSearchActive) {
      const baseTotalsHtml = typeof this.renderTotals === 'function' ? this.renderTotals(this.totals, this.columns) : '';
      tfootHtml = `
        <tfoot>
          ${searchSubtotalRow}
          ${baseTotalsHtml}
        </tfoot>
      `;
    }

    this.container.innerHTML = `
      <table class="${escapeHtml(this.tableClass)}" style="width:100% !important;min-width:100%;border-collapse:separate;border-spacing:0;table-layout:${this.tableLayout};">
        ${theadHtml}
        ${tbodyHtml}
        ${tfootHtml}
      </table>
    `;

    this.applySearchHighlights();
  }
}

export function createTreeTable(container, options = {}) {
  if (container._treeTableInstance && !options.forceNew) {
    const inst = container._treeTableInstance;
    if (options.columns) inst.columns = options.columns;
    if (options.tableLayout) inst.tableLayout = options.tableLayout;
    if (options.tableClass) inst.tableClass = options.tableClass;
    if (options.getNodeKey) inst.getNodeKey = options.getNodeKey;
    if (options.getChildren) inst.getChildren = options.getChildren;
    if (options.hasChildren) inst.hasChildren = options.hasChildren;
    if (options.loadChildren) inst.loadChildren = options.loadChildren;
    if (options.renderRow) inst.renderRow = options.renderRow;
    if (options.renderTotals) inst.renderTotals = options.renderTotals;
    if (options.onLeafClick) inst.onLeafClick = options.onLeafClick;
    if (options.showZeroItems !== undefined) inst.showZeroItems = !!options.showZeroItems;
    if (options.onHiddenCountChange) inst.onHiddenCountChange = options.onHiddenCountChange;
    if (options.searchContext) inst.searchContext = options.searchContext;
    if (options.searchInput) inst.bindSearchInput(options.searchInput, options.searchOptions || {});
    inst.setData(options.data, options.totals);
    return inst;
  }
  const inst = new TreeTable(container, options);
  container._treeTableInstance = inst;
  return inst;
}
