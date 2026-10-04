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

    // RESP1: ensure container has data-scroll-x="true" and responsive wrapper
    if (this.container) {
      this.container.setAttribute('data-scroll-x', 'true');
      this.container.classList.add('tree-table-wrap');
    }

    this.expandedKeys = this.loadExpandedKeys();
    this.pathMap = new Map();

    this.initEvents();
    this.render();

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

  flattenTree() {
    this.pathMap.clear();
    const visible = [];

    const traverse = (node, parentPath = '', depth = 0) => {
      const pathKey = this.getNodeKey(node, parentPath, depth);
      this.pathMap.set(pathKey, node);

      const isExpanded = this.expandedKeys.has(pathKey);
      const kids = this.getChildren(node) || [];
      const hasKids = this.hasChildren(node);
      const isLeaf = !hasKids;

      visible.push({
        node,
        pathKey,
        depth,
        isExpanded,
        hasKids,
        isLeaf
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
    const indent = depth * 20;
    const icon = node._loading ? '⏳' : hasKids ? (isExpanded ? '▼' : '▶') : '•';
    const cursor = hasKids ? 'cursor:pointer;' : (this.onLeafClick ? 'cursor:pointer;' : '');
    const bg = depth === 0 ? 'background:rgba(59,130,246,0.06);font-weight:800;' : '';
    const nodeName = node.name || node.label || '';
    const firstCol = this.columns[0] || { id: 'name' };

    return `
      <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${bg}">
        <td data-col-id="${firstCol.id}" data-priority="1" class="tree-col-name" style="padding-right:${indent + 14}px;text-align:right;" title="${escapeHtml(nodeName)}">
          <span data-tree-toggle="true" style="display:inline-block;width:18px;color:var(--exec-text-muted);font-size:0.85rem;">${icon}</span>
          <span class="tree-node-name" data-tree-name="true">${escapeHtml(nodeName)}</span>
        </td>
        ${this.columns.slice(1).map(col => {
          const val = node[col.id] !== undefined ? node[col.id] : '';
          const formatted = col.format ? col.format(val, node) : escapeHtml(val);
          const prio = col.priority || 1;
          const wStyle = col.width ? `width:${col.width};` : 'width:120px;';
          const minW = col.minWidth ? `min-width:${col.minWidth};` : 'min-width:110px;';
          const maxW = col.maxWidth ? `max-width:${col.maxWidth};` : 'max-width:135px;';
          return `<td data-col-id="${col.id}" data-priority="${prio}" class="tree-col-num" style="text-align:${col.align || 'left'};${wStyle}${minW}${maxW}">${formatted}</td>`;
        }).join('')}
      </tr>
    `;
  }

  render() {
    const visibleRows = this.flattenTree();

    const theadHtml = `
      <thead>
        <tr style="background:var(--exec-sticky-bg);">
          ${this.columns.map((col, idx) => {
            const isFirst = idx === 0;
            const prio = col.priority || 1;
            const wStyle = col.width ? `width:${col.width};` : (isFirst ? '' : 'width:120px;');
            const minW = col.minWidth ? `min-width:${col.minWidth};` : (isFirst ? 'min-width:220px;' : 'min-width:110px;');
            const maxW = col.maxWidth ? `max-width:${col.maxWidth};` : (isFirst ? '' : 'max-width:135px;');
            const align = col.align || (isFirst ? 'right' : 'left');
            const colColor = col.color ? `color:${col.color};` : '';
            return `
              <th data-col-id="${col.id}" data-priority="${prio}" class="${isFirst ? 'tree-col-name' : 'tree-col-num'}" style="text-align:${align};${wStyle}${minW}${maxW}${colColor}">
                ${escapeHtml(col.label)}
              </th>
            `;
          }).join('')}
        </tr>
      </thead>
    `;

    let tbodyHtml = '';
    if (visibleRows.length === 0) {
      tbodyHtml = `
        <tbody>
          <tr>
            <td colspan="${this.columns.length}" style="text-align:center;padding:36px;color:var(--exec-text-muted);">
              ${escapeHtml(this.emptyMessage)}
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
    if (typeof this.renderTotals === 'function') {
      tfootHtml = `
        <tfoot>
          ${this.renderTotals(this.totals, this.columns)}
        </tfoot>
      `;
    }

    this.container.innerHTML = `
      <table class="${escapeHtml(this.tableClass)}">
        ${theadHtml}
        ${tbodyHtml}
        ${tfootHtml}
      </table>
    `;
  }
}

export function createTreeTable(container, options = {}) {
  if (container._treeTableInstance && !options.forceNew) {
    const inst = container._treeTableInstance;
    if (options.columns) inst.columns = options.columns;
    if (options.getNodeKey) inst.getNodeKey = options.getNodeKey;
    if (options.getChildren) inst.getChildren = options.getChildren;
    if (options.hasChildren) inst.hasChildren = options.hasChildren;
    if (options.loadChildren) inst.loadChildren = options.loadChildren;
    if (options.renderRow) inst.renderRow = options.renderRow;
    if (options.renderTotals) inst.renderTotals = options.renderTotals;
    if (options.onLeafClick) inst.onLeafClick = options.onLeafClick;
    inst.setData(options.data, options.totals);
    return inst;
  }
  const inst = new TreeTable(container, options);
  container._treeTableInstance = inst;
  return inst;
}
