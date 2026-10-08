/**
 * SlicerDropdown
 * Generic portal-based searchable multi-select dropdown component.
 * Appends to document.body with position: fixed to prevent overflow clipping.
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function normalizeArabic(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove tashkeel
    .replace(/[\u0640]/g, '')             // remove tatweel
    .replace(/[أإآآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[يى]/g, 'ي')
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .toLowerCase()
    .trim();
}

let activePortal = null;
let activeBackdrop = null;
let activeCleanup = null;

export function closeActiveSlicerDropdown() {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }
  if (activePortal && activePortal.parentNode) {
    activePortal.parentNode.removeChild(activePortal);
  }
  if (activeBackdrop && activeBackdrop.parentNode) {
    activeBackdrop.parentNode.removeChild(activeBackdrop);
  }
  activePortal = null;
  activeBackdrop = null;

  // Clean up any stray or orphaned portal or backdrop elements in the DOM
  if (typeof document !== 'undefined') {
    document.querySelectorAll('.bi-portal-dropdown, .bi-portal-backdrop').forEach(el => {
      try {
        if (el.parentNode) el.parentNode.removeChild(el);
      } catch (e) {}
    });
    document.querySelectorAll('.bi-slicer-btn[aria-expanded="true"]').forEach(btn => {
      btn.setAttribute('aria-expanded', 'false');
    });
  }
}

export class SlicerDropdown {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.triggerBtn
   * @param {string} options.title
   * @param {string} options.icon
   * @param {string} options.placeholder
   * @param {Array<{id: number|string, name: string, companyId?: number, companyName?: string, groupId?: number, groupName?: string, code?: string}>} options.items
   * @param {Array<number|string>} options.selectedIds
   * @param {Function} options.onApply
   * @param {boolean} [options.groupByCompany=false]
   */
  constructor(options) {
    this.triggerBtn = options.triggerBtn;
    this.title = options.title || 'تصفية';
    this.icon = options.icon || '🔍';
    this.placeholder = options.placeholder || 'بحث بالاسم...';
    this.items = options.items || [];
    this.selectedIds = new Set((options.selectedIds || []).map(String));
    this.onApply = options.onApply || (() => {});
    this.groupByCompany = options.groupByCompany || false;
    this.disabled = options.disabled || false;

    this.initTrigger();
  }

  updateItems(items, selectedIds) {
    this.items = items || [];
    if (selectedIds !== undefined) {
      this.selectedIds = new Set((selectedIds || []).map(String));
    }
    this.updateTriggerText();
  }

  setSelectedIds(selectedIds) {
    this.selectedIds = new Set((selectedIds || []).map(String));
    this.updateTriggerText();
  }

  setDisabled(disabled, title = '') {
    this.disabled = disabled;
    if (this.triggerBtn) {
      this.triggerBtn.disabled = disabled;
      if (disabled) {
        this.triggerBtn.style.opacity = '0.45';
        this.triggerBtn.style.pointerEvents = 'none';
        this.triggerBtn.title = title || 'غير متاح لهذا التبويب';
      } else {
        this.triggerBtn.style.opacity = '1';
        this.triggerBtn.style.pointerEvents = 'auto';
        this.triggerBtn.title = '';
      }
    }
  }

  initTrigger() {
    if (!this.triggerBtn) return;
    this.triggerBtn.classList.add('bi-slicer-btn');
    this.triggerBtn.setAttribute('type', 'button');
    this.triggerBtn.setAttribute('aria-haspopup', 'dialog');
    this.triggerBtn.setAttribute('aria-expanded', 'false');

    this.updateTriggerText();

    this.triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (this.disabled) return;
      if (activePortal && this.triggerBtn.getAttribute('aria-expanded') === 'true') {
        closeActiveSlicerDropdown();
        this.triggerBtn.setAttribute('aria-expanded', 'false');
      } else {
        this.open();
      }
    });
  }

  updateTriggerText() {
    if (!this.triggerBtn) return;
    const count = this.selectedIds.size;
    let label = 'الكل';
    if (count === 1) {
      const selectedId = Array.from(this.selectedIds)[0];
      const found = this.items.find(it => String(it.id) === String(selectedId));
      label = found ? (found.name || '').replace(/\s+/g, ' ').trim() : `1 مختار`;
    } else if (count > 1) {
      label = `(${count} مختارة)`;
    }

    const valEl = this.triggerBtn.querySelector('.bi-slicer-value');
    if (valEl) {
      valEl.textContent = label;
      valEl.style.fontWeight = count > 0 ? '800' : '600';
      valEl.style.color = count > 0 ? 'var(--exec-accent, #60a5fa)' : 'inherit';
    }

    if (count > 0) {
      this.triggerBtn.classList.add('has-active-filter');
    } else {
      this.triggerBtn.classList.remove('has-active-filter');
    }
  }

  open() {
    closeActiveSlicerDropdown();
    this.triggerBtn.setAttribute('aria-expanded', 'true');

    // Create a local copy of selected IDs to edit before clicking Apply
    const tempSelected = new Set(this.selectedIds);

    // Create backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'bi-portal-backdrop';
    document.body.appendChild(backdrop);
    activeBackdrop = backdrop;

    // Create portal container
    const portal = document.createElement('div');
    portal.className = 'bi-portal-dropdown';
    portal.setAttribute('role', 'dialog');
    portal.setAttribute('aria-modal', 'true');
    document.body.appendChild(portal);
    activePortal = portal;

    // Position the dropdown
    const isMobile = window.innerWidth <= 640;
    this.positionDropdown(portal, isMobile);

    const onWindowChange = () => {
      if (activePortal) {
        this.positionDropdown(activePortal, window.innerWidth <= 640);
      }
    };
    window.addEventListener('resize', onWindowChange);
    window.addEventListener('scroll', onWindowChange, true);

    const handleOutsideClick = (e) => {
      if (activePortal && !activePortal.contains(e.target) && this.triggerBtn && !this.triggerBtn.contains(e.target)) {
        closeActiveSlicerDropdown();
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick, true);

    activeCleanup = () => {
      window.removeEventListener('resize', onWindowChange);
      window.removeEventListener('scroll', onWindowChange, true);
      document.removeEventListener('pointerdown', handleOutsideClick, true);
      this.triggerBtn.setAttribute('aria-expanded', 'false');
    };

    // Render portal content
    this.renderPortalContent(portal, tempSelected, backdrop);
  }

  positionDropdown(portal, isMobile) {
    if (isMobile) {
      portal.style.position = 'fixed';
      portal.style.bottom = '0';
      portal.style.left = '0';
      portal.style.right = '0';
      portal.style.top = 'auto';
      portal.style.width = '100%';
      portal.style.maxHeight = '82vh';
      portal.style.borderRadius = '20px 20px 0 0';
      portal.style.zIndex = '100000';
      return;
    }

    const rect = this.triggerBtn.getBoundingClientRect();
    const width = Math.min(420, window.innerWidth - 24);
    const maxHeight = Math.min(500, window.innerHeight - 80);

    portal.style.position = 'fixed';
    portal.style.zIndex = '100000';
    portal.style.width = `${width}px`;
    portal.style.maxHeight = `${maxHeight}px`;

    // Horizontal positioning (RTL: align right edge of dropdown with right edge of button)
    let right = window.innerWidth - rect.right;
    if (right < 12) right = 12;
    if (right + width > window.innerWidth - 12) {
      right = window.innerWidth - width - 12;
    }
    portal.style.right = `${right}px`;
    portal.style.left = 'auto';

    // Vertical positioning: check available space below vs above
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < 380 && spaceAbove > spaceBelow) {
      // Flip upwards
      const top = Math.max(12, rect.top - maxHeight - 6);
      portal.style.top = `${top}px`;
      portal.style.bottom = 'auto';
    } else {
      // Open downwards
      const top = rect.bottom + 6;
      portal.style.top = `${top}px`;
      portal.style.bottom = 'auto';
    }
  }

  renderPortalContent(portal, tempSelected, backdrop) {
    // Check for duplicate names across companies
    const nameCounts = {};
    for (const it of this.items) {
      const nm = (it.name || '').trim();
      nameCounts[nm] = (nameCounts[nm] || 0) + 1;
    }
    const hasDuplicates = Object.values(nameCounts).some(c => c > 1);

    portal.innerHTML = `
      <div class="slicer-drop-header">
        <div class="slicer-drop-title">
          <span>${this.icon}</span>
          <strong>${escapeHtml(this.title)}</strong>
          <span class="slicer-drop-badge" id="drop-selected-count"></span>
        </div>
        <button type="button" class="slicer-drop-close" id="btn-drop-close" aria-label="إغلاق">✕</button>
      </div>

      <div class="slicer-drop-search-wrap">
        <span class="slicer-search-icon">🔍</span>
        <input type="text" class="slicer-drop-search" id="drop-search-input" placeholder="${escapeHtml(this.placeholder)}" autocomplete="off">
        <button type="button" class="slicer-drop-search-clear" id="btn-search-clear" style="display:none;" aria-label="مسح البحث">✕</button>
      </div>

      <div class="slicer-drop-quick-actions">
        <button type="button" class="slicer-quick-btn" id="btn-drop-select-all">☑ تحديد الكل</button>
        <button type="button" class="slicer-quick-btn" id="btn-drop-clear-all">☐ إلغاء التحديد</button>
        ${hasDuplicates ? `
          <button type="button" class="slicer-quick-btn btn-match-names" id="btn-drop-match-names" title="تحديد جميع الدفاتر التي تحمل نفس اسم الدفتر المختار عبر جميع الشركات">
            ✨ كل الدفاتر بهذا الاسم
          </button>
        ` : ''}
      </div>

      <div class="slicer-drop-list" id="drop-items-list" tabindex="0">
        <!-- Rendered items -->
      </div>

      <div class="slicer-drop-footer">
        <button type="button" class="btn btn-secondary slicer-btn-cancel" id="btn-drop-cancel">إلغاء</button>
        <button type="button" class="btn btn-primary slicer-btn-apply" id="btn-drop-apply">تطبيق</button>
      </div>
    `;

    const searchInput = portal.querySelector('#drop-search-input');
    const searchClear = portal.querySelector('#btn-search-clear');
    const itemsList = portal.querySelector('#drop-items-list');
    const countBadge = portal.querySelector('#drop-selected-count');
    const selectAllBtn = portal.querySelector('#btn-drop-select-all');
    const clearAllBtn = portal.querySelector('#btn-drop-clear-all');
    const matchNamesBtn = portal.querySelector('#btn-drop-match-names');
    const applyBtn = portal.querySelector('#btn-drop-apply');
    const cancelBtn = portal.querySelector('#btn-drop-cancel');
    const closeBtn = portal.querySelector('#btn-drop-close');

    const updateBadge = () => {
      const c = tempSelected.size;
      if (c === 0) {
        countBadge.textContent = 'الكل';
        countBadge.style.background = 'rgba(148, 163, 184, 0.2)';
        countBadge.style.color = 'var(--exec-text-muted, #94a3b8)';
      } else {
        countBadge.textContent = `${c} مختارة`;
        countBadge.style.background = 'rgba(59, 130, 246, 0.2)';
        countBadge.style.color = 'var(--exec-accent, #60a5fa)';
      }
    };
    updateBadge();

    const renderList = (filterQuery = '') => {
      const cleanQ = normalizeArabic(filterQuery);
      
      let filteredItems = this.items;
      if (cleanQ) {
        filteredItems = this.items.filter(it => {
          const n1 = normalizeArabic(it.name);
          const n2 = normalizeArabic(it.companyName || '');
          const n3 = normalizeArabic(it.groupName || '');
          const n4 = String(it.id);
          const n5 = String(it.code || '');
          return n1.includes(cleanQ) || n2.includes(cleanQ) || n3.includes(cleanQ) || n4.includes(cleanQ) || n5.includes(cleanQ);
        });
      }

      if (filteredItems.length === 0) {
        itemsList.innerHTML = `<div class="slicer-empty-msg">🔍 لا توجد نتائج مطابقة لـ «${escapeHtml(filterQuery)}»</div>`;
        return;
      }

      if (!this.groupByCompany) {
        // Flat list (e.g. for Groups)
        itemsList.innerHTML = filteredItems.map(it => {
          const isChecked = tempSelected.has(String(it.id));
          const colorDot = it.color ? `<span class="slicer-dot" style="background:${it.color};"></span>` : '';
          return `
            <label class="slicer-item-row ${isChecked ? 'selected' : ''}" data-id="${it.id}">
              <input type="checkbox" class="slicer-chk" value="${it.id}" ${isChecked ? 'checked' : ''}>
              ${colorDot}
              <span class="slicer-item-name">${escapeHtml((it.name || '').replace(/\s+/g, ' ').trim())}</span>
            </label>
          `;
        }).join('');
      } else {
        // Grouped by Company > Analytic Group (for Journals / Cost Centers)
        const compMap = new Map();
        for (const it of filteredItems) {
          const cName = it.companyName || 'شركة غير محددة';
          if (!compMap.has(cName)) compMap.set(cName, new Map());
          const grpMap = compMap.get(cName);
          const gName = it.groupName || 'غير مصنّف';
          if (!grpMap.has(gName)) grpMap.set(gName, []);
          grpMap.get(gName).push(it);
        }

        let html = '';
        for (const [cName, grpMap] of compMap.entries()) {
          html += `
            <div class="slicer-group-block">
              <div class="slicer-company-header">
                <span>🏢 ${escapeHtml(cName)}</span>
              </div>
          `;

          for (const [gName, jList] of grpMap.entries()) {
            html += `
              <div class="slicer-subgroup-header">📁 ${escapeHtml(gName)}</div>
              <div class="slicer-subgroup-items">
            `;

            for (const it of jList) {
              const isChecked = tempSelected.has(String(it.id));
              const meta = it.code ? `<span class="slicer-item-meta">(${escapeHtml(it.code)})</span>` : '';
              const cleanItemName = (it.name || '').replace(/\s+/g, ' ').trim();
              html += `
                <label class="slicer-item-row ${isChecked ? 'selected' : ''}" data-id="${it.id}" data-name="${escapeHtml(cleanItemName)}">
                  <input type="checkbox" class="slicer-chk" value="${it.id}" ${isChecked ? 'checked' : ''}>
                  <span class="slicer-item-name">${escapeHtml(cleanItemName)}</span>
                  ${meta}
                </label>
              `;
            }

            html += `</div>`; // .slicer-subgroup-items
          }

          html += `</div>`; // .slicer-group-block
        }

        itemsList.innerHTML = html;
      }

      // Attach item change listeners
      itemsList.querySelectorAll('.slicer-chk').forEach(chk => {
        chk.addEventListener('change', () => {
          const id = String(chk.value);
          if (chk.checked) {
            tempSelected.add(id);
            chk.closest('.slicer-item-row')?.classList.add('selected');
          } else {
            tempSelected.delete(id);
            chk.closest('.slicer-item-row')?.classList.remove('selected');
          }
          updateBadge();
        });
      });
    };

    renderList();

    // Search input handler
    searchInput.addEventListener('input', () => {
      const q = searchInput.value;
      searchClear.style.display = q ? 'block' : 'none';
      renderList(q);
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchClear.style.display = 'none';
      searchInput.focus();
      renderList('');
    });

    // Quick Select All
    selectAllBtn.addEventListener('click', () => {
      const visibleChks = itemsList.querySelectorAll('.slicer-chk');
      visibleChks.forEach(chk => {
        chk.checked = true;
        tempSelected.add(String(chk.value));
        chk.closest('.slicer-item-row')?.classList.add('selected');
      });
      updateBadge();
    });

    // Quick Clear All
    clearAllBtn.addEventListener('click', () => {
      const visibleChks = itemsList.querySelectorAll('.slicer-chk');
      visibleChks.forEach(chk => {
        chk.checked = false;
        tempSelected.delete(String(chk.value));
        chk.closest('.slicer-item-row')?.classList.remove('selected');
      });
      if (!searchInput.value) {
        tempSelected.clear();
      }
      updateBadge();
    });

    // Match Duplicate Names (✨ تحديد بالاسم المشترك)
    if (matchNamesBtn) {
      matchNamesBtn.addEventListener('click', () => {
        // Collect names of all currently selected items
        const selectedNames = new Set();
        for (const it of this.items) {
          if (tempSelected.has(String(it.id))) {
            selectedNames.add((it.name || '').trim());
          }
        }
        if (selectedNames.size === 0) return;

        // Select all items that match these names
        for (const it of this.items) {
          if (selectedNames.has((it.name || '').trim())) {
            tempSelected.add(String(it.id));
          }
        }

        renderList(searchInput.value);
        updateBadge();
      });
    }

    // Apply button
    applyBtn.addEventListener('click', () => {
      this.selectedIds = new Set(tempSelected);
      this.updateTriggerText();
      closeActiveSlicerDropdown();
      const resultIds = Array.from(this.selectedIds).map(id => {
        const s = String(id).trim();
        return (!isNaN(Number(s)) && !s.includes(':') && s !== '') ? Number(s) : s;
      });
      this.onApply(resultIds);
    });

    // Cancel / Close
    const cancelAndClose = () => {
      closeActiveSlicerDropdown();
    };
    cancelBtn.addEventListener('click', cancelAndClose);
    closeBtn.addEventListener('click', cancelAndClose);
    backdrop.addEventListener('click', cancelAndClose);

    // Keyboard handling
    portal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        cancelAndClose();
      } else if (e.key === 'Enter') {
        // Submit
        e.preventDefault();
        applyBtn.click();
      }
    });

    // Focus search input
    setTimeout(() => {
      if (searchInput) searchInput.focus();
    }, 50);
  }
}
