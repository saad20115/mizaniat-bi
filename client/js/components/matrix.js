import { formatNumber, formatCurrency } from '../utils/format.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * MatrixTable — Interactive multi-dimensional hierarchical matrix component
 * Supports:
 * - Time drill-down (Year -> Quarter -> Month -> Week -> Day) with breadcrumb
 * - Row expansion (Company -> Department -> Cost Center -> Account)
 * - Comparison display (diff, pct %)
 * - Heatmap & % of Total toggles
 * - Excel / CSV export (with Arabic UTF-8 BOM)
 * - Sticky headers & RTL layout
 */
export class MatrixTable {
  constructor(options = {}) {
    this.container = options.container || null;
    this.data = options.data || null; // Matrix API response
    this.onDrillTime = options.onDrillTime || null;
    this.onBreadcrumb = options.onBreadcrumb || null;
    this.title = options.title || 'المصفوفة متعددة الأبعاد';
    this.measure = options.measure || 'revenue';
    
    // UI state
    this.collapsedNodes = new Set(); // Tracks collapsed node IDs (default: level >= 2 collapsed)
    this.showHeatmap = options.showHeatmap || false;
    this.showPctOfTotal = options.showPctOfTotal || false;
    this.searchFilter = '';
    this.isInitialized = false;

    // Set default collapse behavior: Level 0 and 1 expanded, Level >= 2 collapsed
    if (this.data && this.data.rows) {
      this._initDefaultCollapse(this.data.rows, 0);
    }
  }

  _initDefaultCollapse(nodes, level) {
    for (const node of nodes) {
      if (level >= 1 && node.children && node.children.length > 0) {
        this.collapsedNodes.add(node.id);
      }
      if (node.children && node.children.length > 0) {
        this._initDefaultCollapse(node.children, level + 1);
      }
    }
  }

  setData(data, keepCollapseState = true) {
    this.data = data;
    if (!keepCollapseState) {
      this.collapsedNodes.clear();
      if (this.data && this.data.rows) {
        this._initDefaultCollapse(this.data.rows, 0);
      }
    }
    this.render();
  }

  render(targetContainer) {
    if (targetContainer) this.container = targetContainer;
    if (!this.container) return;

    if (!this.data || !this.data.rows || this.data.rows.length === 0) {
      this.container.innerHTML = `
        <div class="matrix-empty" style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.4);font-size:1.1rem;">
          لا توجد بيانات مطابقة لمعايير البحث المحددة
        </div>
      `;
      return;
    }

    const { meta, columns, rows, totals } = this.data;
    const isCompare = meta && meta.compare && meta.compare !== 'none';
    const grandTotal = totals ? totals.grandTotal : 0;

    // Find min and max for heatmap
    let minVal = 0, maxVal = 0;
    if (this.showHeatmap) {
      for (const col of columns) {
        const colVal = totals?.columns?.[col.key] || 0;
        if (colVal > maxVal) maxVal = colVal;
      }
      for (const row of rows) {
        for (const col of columns) {
          const val = row.values?.[col.key] || 0;
          if (val > maxVal) maxVal = val;
          if (val < minVal) minVal = val;
        }
      }
    }

    // Build breadcrumb items
    const breadcrumbs = this._buildBreadcrumbs(meta);

    this.container.innerHTML = `
      <div class="matrix-wrapper" style="direction:rtl;display:flex;flex-direction:column;gap:16px;">
        <!-- Matrix Toolbar -->
        <div class="matrix-toolbar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:rgba(255,255,255,0.02);padding:14px 18px;border-radius:14px;border:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <!-- Breadcrumbs -->
            <div class="matrix-breadcrumbs" style="display:flex;align-items:center;gap:8px;font-size:0.92rem;font-weight:700;">
              ${breadcrumbs}
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <!-- Row search -->
            <div style="position:relative;">
              <input type="text" class="matrix-search" placeholder="بحث في البنود..." value="${this.searchFilter}" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 12px;color:#fff;font-size:0.88rem;width:160px;outline:none;">
            </div>

            <!-- Expand / Collapse All -->
            <button class="matrix-btn btn-expand-all" title="توسيع الكل" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;color:rgba(255,255,255,0.8);font-size:0.85rem;cursor:pointer;display:flex;align-items:center;gap:4px;">
              <span>➕</span> توسيع
            </button>
            <button class="matrix-btn btn-collapse-all" title="طي الكل" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 10px;color:rgba(255,255,255,0.8);font-size:0.85rem;cursor:pointer;display:flex;align-items:center;gap:4px;">
              <span>➖</span> طي
            </button>

            <!-- Heatmap Toggle -->
            <button class="matrix-btn btn-toggle-heatmap ${this.showHeatmap ? 'active' : ''}" style="background:${this.showHeatmap ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)'};border:1px solid ${this.showHeatmap ? '#3b82f6' : 'rgba(255,255,255,0.1)'};border-radius:8px;padding:6px 12px;color:${this.showHeatmap ? '#60a5fa' : 'rgba(255,255,255,0.8)'};font-size:0.85rem;cursor:pointer;font-weight:600;">
              🌡️ حراري
            </button>

            <!-- % of Total Toggle -->
            <button class="matrix-btn btn-toggle-pct ${this.showPctOfTotal ? 'active' : ''}" style="background:${this.showPctOfTotal ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'};border:1px solid ${this.showPctOfTotal ? '#10b981' : 'rgba(255,255,255,0.1)'};border-radius:8px;padding:6px 12px;color:${this.showPctOfTotal ? '#34d399' : 'rgba(255,255,255,0.8)'};font-size:0.85rem;cursor:pointer;font-weight:600;">
              % النسبة
            </button>

            <!-- Export CSV -->
            <button class="matrix-btn btn-export-csv" style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:6px 12px;color:#10b981;font-size:0.85rem;cursor:pointer;font-weight:700;">
              📥 تصدير Excel
            </button>

            <!-- Export PDF -->
            <button class="matrix-btn btn-export-pdf" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:6px 12px;color:#f87171;font-size:0.85rem;cursor:pointer;font-weight:700;">
              📄 تصدير PDF
            </button>
          </div>
        </div>

        <!-- Matrix Table Container with Sticky Headers & First Column -->
        <div class="matrix-table-scroll" style="max-height:680px;overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:rgba(15,23,42,0.6);position:relative;">
          <table class="matrix-table" style="width:100%;border-collapse:separate;border-spacing:0;font-size:0.95rem;text-align:right;">
            <thead style="position:sticky;top:0;z-index:20;background:#0d1527;backdrop-filter:blur(10px);">
              <tr>
                <th class="matrix-th-row-header" style="position:sticky;right:0;z-index:25;background:#0d1527;padding:14px 18px;border-bottom:2px solid rgba(255,255,255,0.12);border-left:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);font-weight:700;min-width:240px;box-shadow:-2px 0 6px rgba(0,0,0,0.25);">
                  البند / التصنيف
                </th>
                ${columns.map(col => `
                  <th class="matrix-th-col" data-col="${col.key}" style="padding:14px 16px;border-bottom:2px solid rgba(255,255,255,0.12);border-left:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.8);font-weight:700;text-align:left;white-space:nowrap;cursor:${this._canDrill(meta?.timeGrain) ? 'pointer' : 'default'};">
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">
                      <span>${col.label}</span>
                      ${this._canDrill(meta?.timeGrain) ? `<span style="font-size:0.7rem;color:#60a5fa;opacity:0.8;" title="انقر للتفصيل الزمني">🔍</span>` : ''}
                    </div>
                  </th>
                `).join('')}
                <th class="matrix-th-total" style="padding:14px 18px;border-bottom:2px solid rgba(255,255,255,0.12);border-left:1px solid rgba(255,255,255,0.08);color:#60a5fa;font-weight:800;text-align:left;white-space:nowrap;min-width:130px;">
                  الإجمالي
                </th>
                ${isCompare ? `
                  <th class="matrix-th-compare" style="padding:14px 16px;border-bottom:2px solid rgba(255,255,255,0.12);color:#a78bfa;font-weight:800;text-align:left;white-space:nowrap;min-width:120px;">
                    الفارق / %
                  </th>
                ` : ''}
              </tr>
            </thead>
            <tbody>
              ${this._renderRows(rows, columns, isCompare, 0, grandTotal, maxVal)}
            </tbody>
            <tfoot style="position:sticky;bottom:0;z-index:20;background:#0d1527;backdrop-filter:blur(10px);box-shadow:0 -2px 8px rgba(0,0,0,0.3);">
              <tr style="font-weight:800;border-top:2px solid rgba(255,255,255,0.2);">
                <td style="position:sticky;right:0;z-index:25;background:#0d1527;padding:16px 18px;border-left:1px solid rgba(255,255,255,0.1);color:#fff;font-size:1.05rem;box-shadow:-2px 0 6px rgba(0,0,0,0.25);">
                  الإجمالي العام
                </td>
                ${columns.map(col => {
                  const val = totals?.columns?.[col.key] || 0;
                  const pct = grandTotal !== 0 ? (val / grandTotal * 100).toFixed(1) + '%' : '';
                  return `
                    <td style="padding:16px 16px;border-left:1px solid rgba(255,255,255,0.06);text-align:left;font-family:var(--font-en);color:#fff;font-size:1.05rem;">
                      <div>${formatNumber(val, 0)}</div>
                      ${this.showPctOfTotal ? `<div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">${pct}</div>` : ''}
                    </td>
                  `;
                }).join('')}
                <td style="padding:16px 18px;border-left:1px solid rgba(255,255,255,0.1);text-align:left;font-family:var(--font-en);color:#60a5fa;font-size:1.15rem;">
                  <div>${formatNumber(grandTotal, 0)}</div>
                </td>
                ${isCompare ? `
                  <td style="padding:16px 16px;text-align:left;font-family:var(--font-en);font-size:1rem;color:${totals?.diff >= 0 ? '#10b981' : '#ef4444'};">
                    <div>${totals?.diff >= 0 ? '+' : ''}${formatNumber(totals?.diff || 0, 0)}</div>
                    <div style="font-size:0.8rem;opacity:0.85;">${totals?.pct !== null ? (totals.pct >= 0 ? '+' : '') + totals.pct + '%' : '—'}</div>
                  </td>
                ` : ''}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _renderRows(nodes, columns, isCompare, level, grandTotal, maxVal) {
    if (!nodes || nodes.length === 0) return '';
    let html = '';

    for (const node of nodes) {
      // Filter check
      const matchesSearch = !this.searchFilter || 
        String(node.label || '').toLowerCase().includes(this.searchFilter.toLowerCase()) ||
        String(node.key || '').toLowerCase().includes(this.searchFilter.toLowerCase());
      
      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = this.collapsedNodes.has(node.id);

      // Icon by dimension
      let dimIcon = '🏢';
      if (node.dim === 'department') dimIcon = '📁';
      else if (node.dim === 'analytic') dimIcon = '🏗️';
      else if (node.dim === 'account') dimIcon = '🏷️';

      // Indent padding
      const indentPx = level * 22 + 18;

      // Styling based on level
      let rowBg = 'transparent';
      let fontColor = 'rgba(255,255,255,0.9)';
      let fontWeight = level === 0 ? '700' : (level === 1 ? '600' : '400');
      let fontSize = level === 0 ? '1rem' : (level === 1 ? '0.94rem' : '0.88rem');
      if (level === 0) rowBg = 'rgba(255,255,255,0.035)';

      const rowPct = grandTotal !== 0 ? (node.total / grandTotal * 100).toFixed(1) + '%' : '';

      html += `
        <tr class="matrix-row level-${level} ${isCollapsed ? 'collapsed' : 'expanded'}" data-node-id="${node.id}" data-level="${level}" style="background:${rowBg};border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.15s;">
          <td class="matrix-td-label" style="position:sticky;right:0;z-index:5;background:${level === 0 ? '#111b2e' : '#0e1726'};padding:12px 14px 12px ${indentPx}px;border-left:1px solid rgba(255,255,255,0.08);color:${fontColor};font-size:${fontSize};font-weight:${fontWeight};box-shadow:-2px 0 6px rgba(0,0,0,0.25);white-space:nowrap;user-select:none;cursor:${hasChildren ? 'pointer' : 'default'};">
            <div style="display:flex;align-items:center;gap:8px;">
              ${hasChildren ? `
                <span class="tree-toggle" style="display:inline-block;width:14px;font-size:0.7rem;color:rgba(255,255,255,0.5);transition:transform 0.2s;transform:${isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)'};">
                  ▶
                </span>
              ` : `<span style="display:inline-block;width:14px;font-size:0.5rem;color:rgba(255,255,255,0.25);text-align:center;">•</span>`}
              <span>${dimIcon}</span>
              <span title="${node.label}">${node.label}</span>
            </div>
          </td>
          ${columns.map(col => {
            const val = node.values?.[col.key] || 0;
            const pctOfTot = grandTotal !== 0 ? (val / grandTotal * 100).toFixed(1) + '%' : '';
            
            // Heatmap background
            let cellBg = 'transparent';
            if (this.showHeatmap && maxVal > 0 && val > 0) {
              const intensity = Math.min(0.45, (val / maxVal) * 0.45);
              cellBg = `rgba(59, 130, 246, ${intensity.toFixed(2)})`;
            }

            return `
              <td class="matrix-td-cell" style="padding:10px 14px;border-left:1px solid rgba(255,255,255,0.04);text-align:left;font-family:var(--font-en);font-size:${fontSize};font-weight:${fontWeight};color:${val !== 0 ? fontColor : 'rgba(255,255,255,0.25)'};background:${cellBg};white-space:nowrap;">
                <div>${val !== 0 ? formatNumber(val, 0) : '—'}</div>
                ${this.showPctOfTotal && val !== 0 ? `<div style="font-size:0.72rem;color:rgba(255,255,255,0.35);">${pctOfTot}</div>` : ''}
              </td>
            `;
          }).join('')}
          <td class="matrix-td-total" style="padding:10px 16px;border-left:1px solid rgba(255,255,255,0.08);text-align:left;font-family:var(--font-en);font-size:${fontSize};font-weight:700;color:#60a5fa;white-space:nowrap;">
            <div>${formatNumber(node.total, 0)}</div>
            ${this.showPctOfTotal ? `<div style="font-size:0.72rem;color:rgba(255,255,255,0.4);">${rowPct}</div>` : ''}
          </td>
          ${isCompare ? `
            <td class="matrix-td-compare" style="padding:10px 14px;text-align:left;font-family:var(--font-en);font-size:0.85rem;white-space:nowrap;color:${node.diff >= 0 ? '#10b981' : '#ef4444'};">
              <div>${node.diff >= 0 ? '+' : ''}${formatNumber(node.diff, 0)}</div>
              <div style="font-size:0.75rem;opacity:0.8;">${node.pct !== null ? (node.pct >= 0 ? '+' : '') + node.pct + '%' : '—'}</div>
            </td>
          ` : ''}
        </tr>
      `;

      // Render children if not collapsed
      if (hasChildren && !isCollapsed) {
        html += this._renderRows(node.children, columns, isCompare, level + 1, grandTotal, maxVal);
      }
    }

    return html;
  }

  _canDrill(grain) {
    return grain === 'year' || grain === 'quarter' || grain === 'month' || grain === 'week';
  }

  _getNextGrain(grain) {
    if (grain === 'year') return 'quarter';
    if (grain === 'quarter') return 'month';
    if (grain === 'month') return 'week';
    if (grain === 'week') return 'day';
    return null;
  }

  _buildBreadcrumbs(meta) {
    const grainOrder = [
      { key: 'year', label: 'سنوي' },
      { key: 'quarter', label: 'أرباع سنوية' },
      { key: 'month', label: 'شهري' },
      { key: 'week', label: 'أسبوعي' },
      { key: 'day', label: 'يومي' }
    ];
    const currentGrain = meta?.timeGrain || 'year';
    const currentIdx = grainOrder.findIndex(g => g.key === currentGrain);
    const activeIdx = currentIdx >= 0 ? currentIdx : 0;

    let itemsHtml = '';
    for (let i = 0; i <= activeIdx; i++) {
      const g = grainOrder[i];
      const isCurrent = i === activeIdx;
      if (isCurrent) {
        itemsHtml += `
          <span style="color:#60a5fa;background:rgba(59,130,246,0.15);padding:3px 10px;border-radius:6px;border:1px solid rgba(59,130,246,0.3);font-weight:700;">
            ${g.label}
          </span>
        `;
      } else {
        itemsHtml += `
          <button class="btn-breadcrumb-step" data-grain="${g.key}" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);padding:3px 8px;border-radius:6px;cursor:pointer;font-size:0.85rem;">
            ${g.label}
          </button>
          <span style="color:rgba(255,255,255,0.3);font-size:0.8rem;">←</span>
        `;
      }
    }

    return `
      <span style="color:rgba(255,255,255,0.4);">التدرج الزمني:</span>
      <div style="display:inline-flex;align-items:center;gap:6px;">
        ${itemsHtml}
      </div>
      ${activeIdx > 0 ? `
        <button class="btn-breadcrumb-reset" style="background:transparent;border:none;color:#a78bfa;cursor:pointer;font-size:0.85rem;text-decoration:underline;margin-right:6px;">
          (رجوع للسنوي)
        </button>
      ` : ''}
    `;
  }

  _bindEvents() {
    if (!this.container) return;

    // Search filter
    const searchInput = this.container.querySelector('.matrix-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchFilter = e.target.value.trim();
        this.render();
        // Restore focus
        const newSearch = this.container.querySelector('.matrix-search');
        if (newSearch) {
          newSearch.focus();
          newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
        }
      });
    }

    // Expand all
    this.container.querySelector('.btn-expand-all')?.addEventListener('click', () => {
      this.collapsedNodes.clear();
      this.render();
    });

    // Collapse all
    this.container.querySelector('.btn-collapse-all')?.addEventListener('click', () => {
      if (this.data && this.data.rows) {
        this._collapseAll(this.data.rows);
      }
      this.render();
    });

    // Heatmap toggle
    this.container.querySelector('.btn-toggle-heatmap')?.addEventListener('click', () => {
      this.showHeatmap = !this.showHeatmap;
      this.render();
    });

    // % of Total toggle
    this.container.querySelector('.btn-toggle-pct')?.addEventListener('click', () => {
      this.showPctOfTotal = !this.showPctOfTotal;
      this.render();
    });

    // Export CSV
    this.container.querySelector('.btn-export-csv')?.addEventListener('click', () => {
      this.exportCSV();
    });

    // Export PDF
    this.container.querySelector('.btn-export-pdf')?.addEventListener('click', () => {
      this.exportPDF();
    });

    // Breadcrumb step clicks
    this.container.querySelectorAll('.btn-breadcrumb-step').forEach(btn => {
      btn.addEventListener('click', () => {
        const grain = btn.dataset.grain;
        if (grain && this.onBreadcrumb) this.onBreadcrumb(grain);
      });
    });

    // Breadcrumb reset
    this.container.querySelector('.btn-breadcrumb-reset')?.addEventListener('click', () => {
      if (this.onBreadcrumb) this.onBreadcrumb('year');
    });

    // Column header drill-down
    this.container.querySelectorAll('.matrix-th-col').forEach(th => {
      th.addEventListener('click', () => {
        const colKey = th.dataset.col;
        const currentGrain = this.data?.meta?.timeGrain || 'year';
        const nextGrain = this._getNextGrain(currentGrain);
        if (nextGrain && this.onDrillTime) {
          this.onDrillTime(colKey, nextGrain);
        }
      });
    });

    // Tree row toggle click
    this.container.querySelectorAll('.matrix-row').forEach(row => {
      const labelCell = row.querySelector('.matrix-td-label');
      if (labelCell) {
        labelCell.addEventListener('click', () => {
          const nodeId = row.dataset.nodeId;
          if (this.collapsedNodes.has(nodeId)) {
            this.collapsedNodes.delete(nodeId);
          } else {
            this.collapsedNodes.add(nodeId);
          }
          this.render();
        });
      }
    });
  }

  _collapseAll(nodes) {
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        this.collapsedNodes.add(node.id);
        this._collapseAll(node.children);
      }
    }
  }

  exportCSV() {
    if (!this.data || !this.data.rows) return;
    const { columns, rows, totals } = this.data;
    const isCompare = this.data.meta?.compare && this.data.meta.compare !== 'none';

    const header = ['البند', 'المستوى', ...columns.map(c => `"${c.label}"`), 'الإجمالي'];
    if (isCompare) {
      header.push('الفارق');
      header.push('النسبة %');
    }

    const csvRows = [header.join(',')];

    function addRowToCSV(node, level) {
      const row = [
        `"${'  '.repeat(level)}${node.label.replace(/"/g, '""')}"`,
        `"${node.dim || ''}"`,
        ...columns.map(c => node.values?.[c.key] || 0),
        node.total || 0
      ];
      if (isCompare) {
        row.push(node.diff || 0);
        row.push(node.pct !== null ? `${node.pct}%` : '—');
      }
      csvRows.push(row.join(','));

      if (node.children) {
        for (const child of node.children) {
          addRowToCSV(child, level + 1);
        }
      }
    }

    for (const root of rows) {
      addRowToCSV(root, 0);
    }

    // Totals row
    const totRow = [
      '"الإجمالي العام"',
      '""',
      ...columns.map(c => totals?.columns?.[c.key] || 0),
      totals?.grandTotal || 0
    ];
    if (isCompare) {
      totRow.push(totals?.diff || 0);
      totRow.push(totals?.pct !== null ? `${totals.pct}%` : '—');
    }
    csvRows.push(totRow.join(','));

    // UTF-8 BOM for Excel Arabic compatibility
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `matrix_${this.measure}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async exportPDF() {
    if (!this.data || !this.data.rows) return;
    const { meta, columns, rows, totals } = this.data;
    const isCompare = meta && meta.compare && meta.compare !== 'none';
    const grandTotal = totals ? totals.grandTotal : 0;

    const measureLabels = {
      revenue: 'مصفوفة الإيرادات',
      expense: 'مصفوفة المصروفات',
      net: 'مصفوفة صافي الأرباح',
      billed: 'مصفوفة المفوتر',
      collected: 'مصفوفة المحصل'
    };
    const title = measureLabels[meta?.measure] || this.title || 'مصفوفة البيانات المالية والتشغيلية';
    const periodLabel = meta?.dateFrom && meta?.dateTo
      ? `من ${meta.dateFrom} إلى ${meta.dateTo}`
      : (meta?.timeGrain ? `التدرج الزمني: ${meta.timeGrain}` : 'كافة الفترات');
    const printTime = new Date().toLocaleString('ar-SA');

    const buildPrintRows = (nodes, level = 0) => {
      let trs = '';
      for (const node of nodes) {
        const indent = level * 14;
        const total = node.total || 0;
        trs += `
          <tr style="border-bottom:1px solid #e2e8f0;background:${level === 0 ? '#f8fafc' : '#ffffff'};font-weight:${level === 0 ? '700' : 'normal'};font-size:10px;">
            <td style="padding:5px 8px;text-align:right;border:1px solid #cbd5e1;padding-right:${8 + indent}px;">
              ${node.label || node.key}
            </td>
            ${columns.map(col => {
              const val = node.values?.[col.key] || 0;
              return `<td style="padding:5px 8px;text-align:left;border:1px solid #cbd5e1;font-family:sans-serif;">${val !== 0 ? formatNumber(val, 0) : '—'}</td>`;
            }).join('')}
            <td style="padding:5px 8px;text-align:left;border:1px solid #cbd5e1;font-weight:700;font-family:sans-serif;">${formatNumber(total, 0)}</td>
            ${isCompare ? `<td style="padding:5px 8px;text-align:left;border:1px solid #cbd5e1;font-family:sans-serif;">${node.diff !== undefined ? formatNumber(node.diff, 0) : '—'}</td>` : ''}
          </tr>
        `;
        if (node.children && node.children.length > 0) {
          trs += buildPrintRows(node.children, level + 1);
        }
      }
      return trs;
    };

    const rowsHtml = buildPrintRows(rows, 0);

    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:fixed;top:-9999px;left:0;width:1150px;background:#ffffff;color:#0f172a;padding:24px;font-family:system-ui,-apple-system,sans-serif;direction:rtl;';
    tempDiv.innerHTML = `
      <div style="border-bottom:2px solid #0284c7;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;">
        <div>
          <h2 style="margin:0 0 4px 0;color:#0f172a;font-size:18px;font-weight:800;">${title}</h2>
          <div style="font-size:11px;color:#475569;">الفترة: ${periodLabel}</div>
        </div>
        <div style="text-align:left;font-size:10px;color:#64748b;">
          <div style="font-weight:700;color:#0f172a;">مجموعة شركات المهندس جمال حريري</div>
          <div>تاريخ الطباعة: ${printTime}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;text-align:right;">
        <thead>
          <tr style="background:#0f172a;color:#ffffff;font-size:10px;">
            <th style="padding:7px;border:1px solid #334155;text-align:right;">البند / التصنيف</th>
            ${columns.map(col => `<th style="padding:7px;border:1px solid #334155;text-align:left;">${col.label}</th>`).join('')}
            <th style="padding:7px;border:1px solid #334155;text-align:left;">الإجمالي</th>
            ${isCompare ? `<th style="padding:7px;border:1px solid #334155;text-align:left;">الفارق</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background:#f1f5f9;font-weight:700;font-size:10px;border-top:2px solid #0f172a;">
            <td style="padding:7px;border:1px solid #cbd5e1;text-align:right;">الإجمالي العام</td>
            ${columns.map(col => {
              const val = totals?.columns?.[col.key] || 0;
              return `<td style="padding:7px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${formatNumber(val, 0)}</td>`;
            }).join('')}
            <td style="padding:7px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#0284c7;">${formatNumber(grandTotal, 0)}</td>
            ${isCompare ? `<td style="padding:7px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${totals?.diff !== undefined ? formatNumber(totals.diff, 0) : '—'}</td>` : ''}
          </tr>
        </tfoot>
      </table>
      <div style="text-align:center;margin-top:14px;font-size:10px;color:#64748b;">Mizaniat BI | تقرير مصفوفة مؤشرات الأداء</div>
    `;

    document.body.appendChild(tempDiv);
    try {
      const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      document.body.removeChild(tempDiv);
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      const mt = 12, mb = 12, mx = 10, uw = pw - mx * 2, uh = ph - mt - mb;
      const iw = uw, ih = (canvas.height / canvas.width) * iw;
      const imgData = canvas.toDataURL('image/png');
      if (ih <= uh) {
        doc.addImage(imgData, 'PNG', mx, mt, iw, ih);
      } else {
        const pages = Math.ceil((ih + 5) / uh);
        for (let i = 0; i < pages; i++) {
          if (i > 0) doc.addPage();
          doc.addImage(imgData, 'PNG', mx, mt - (i * uh), iw, ih);
          doc.setFillColor(255, 255, 255);
          doc.rect(0, 0, pw, mt, 'F');
          const isLast = (i === pages - 1);
          if (!isLast) { doc.rect(0, ph - mb, pw, mb, 'F'); }
          else { doc.rect(0, ph - 5, pw, 5, 'F'); }
          doc.setFontSize(8); doc.setTextColor(150);
          doc.text(`${i + 1} / ${pages}`, pw / 2, ph - (isLast ? 1.5 : 4), { align: 'center' });
        }
      }
      doc.save(`matrix_${this.measure}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      if (tempDiv.parentNode) document.body.removeChild(tempDiv);
      console.error('PDF export error:', err);
      alert('حدث خطأ أثناء تصدير PDF: ' + err.message);
    }
  }
}
