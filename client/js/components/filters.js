import { store } from '../store.js';
import { api } from '../api.js';

export function renderFilters(container, onChange) {
  const companies = store.get('companies');
  const selected = store.get('selectedCompanyIds');
  const dateFrom = store.get('dateFrom');
  const dateTo = store.get('dateTo');
  const filterOptions = store.get('filterOptions');

  container.innerHTML = `
    <div class="filter-group" style="min-width:100%;">
      <span class="filter-label">الشركات</span>
      <div class="company-chips">
        <div class="company-chip ${selected.length === 0 ? 'active' : ''}" data-company="all">
          <span class="chip-dot" style="background: var(--accent-purple)"></span>
          الكل
        </div>
        ${companies.map(c => `
          <div class="company-chip ${selected.includes(c.id) ? 'active' : ''}" data-company="${c.id}">
            <span class="chip-dot" style="background: ${c.color || '#3b82f6'}"></span>
            ${c.name}
          </div>
        `).join('')}
      </div>
    </div>
    
    <div class="filter-group">
      <span class="filter-label">من تاريخ</span>
      <input type="date" class="filter-input" id="filter-date-from" value="${dateFrom}" />
    </div>
    
    <div class="filter-group">
      <span class="filter-label">إلى تاريخ</span>
      <input type="date" class="filter-input" id="filter-date-to" value="${dateTo}" />
    </div>
    
    <div class="filter-group">
      <span class="filter-label">السنة المالية</span>
      <select class="filter-select" id="filter-fiscal-year">
        <option value="">الكل</option>
        ${(filterOptions.fiscalYears || []).map(fy => `
          <option value="${fy}" ${store.get('fiscalYear') === fy ? 'selected' : ''}>${fy}</option>
        `).join('')}
      </select>
    </div>

    <div class="filter-group">
      <span class="filter-label">مركز التكلفة</span>
      <select class="filter-select" id="filter-cost-center">
        <option value="">الكل</option>
        ${(filterOptions.costCenters || []).map(cc => `
          <option value="${cc}" ${store.get('costCenter') === cc ? 'selected' : ''}>${cc}</option>
        `).join('')}
      </select>
    </div>

    <div class="filter-group">
      <span class="filter-label">نوع الحساب</span>
      <select class="filter-select" id="filter-account-type">
        <option value="">الكل</option>
        ${(filterOptions.accountTypes || []).map(t => `
          <option value="${t}" ${store.get('accountType') === t ? 'selected' : ''}>${t}</option>
        `).join('')}
      </select>
    </div>

    <div class="filter-group" style="align-self:flex-end;">
      <button class="btn btn-primary" id="btn-apply-filters">تطبيق الفلاتر</button>
    </div>
  `;

  // Company chip click
  container.querySelectorAll('.company-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.company;
      let newSelected;
      
      if (val === 'all') {
        newSelected = [];
      } else {
        const id = parseInt(val);
        const current = [...selected];
        if (current.includes(id)) {
          newSelected = current.filter(x => x !== id);
        } else {
          newSelected = [...current, id];
        }
      }
      
      store.set('selectedCompanyIds', newSelected);
      renderFilters(container, onChange);
      if (onChange) onChange();
    });
  });

  // Date inputs
  container.querySelector('#filter-date-from').addEventListener('change', (e) => {
    store.set('dateFrom', e.target.value);
  });
  container.querySelector('#filter-date-to').addEventListener('change', (e) => {
    store.set('dateTo', e.target.value);
  });
  container.querySelector('#filter-cost-center').addEventListener('change', (e) => {
    store.set('costCenter', e.target.value);
  });
  container.querySelector('#filter-account-type').addEventListener('change', (e) => {
    store.set('accountType', e.target.value);
  });
  container.querySelector('#filter-fiscal-year').addEventListener('change', (e) => {
    const fy = e.target.value;
    store.set('fiscalYear', fy);
    // Auto-fill date range when a fiscal year is selected
    if (fy) {
      store.set('dateFrom', `${fy}-01-01`);
      store.set('dateTo', `${fy}-12-31`);
      container.querySelector('#filter-date-from').value = `${fy}-01-01`;
      container.querySelector('#filter-date-to').value = `${fy}-12-31`;
    }
  });

  // Apply button
  container.querySelector('#btn-apply-filters').addEventListener('click', () => {
    if (onChange) onChange();
  });
}

export async function loadFilterOptions() {
  try {
    const params = store.getFilterParams();
    const options = await api.getFilterOptions(params);
    store.set('filterOptions', options);
  } catch (err) {
    console.error('Failed to load filter options:', err);
  }
}
