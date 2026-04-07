import { store } from '../store.js';

const navItems = [
  { id: 'dashboard', icon: '📊', label: 'لوحة التحكم', section: 'رئيسي' },
  { id: 'income-statement', icon: '📈', label: 'قائمة الدخل', section: 'التقارير المالية' },
  { id: 'balance-sheet', icon: '⚖️', label: 'الميزانية العمومية', section: 'التقارير المالية' },
  { id: 'cash-flow', icon: '💰', label: 'التدفقات النقدية', section: 'التقارير المالية' },
  { id: 'special-expenses', icon: '💸', label: 'مصروفات مخصصة', section: 'التقارير المالية' },
  { id: 'trial-balance', icon: '📝', label: 'ميزان المراجعة', section: 'التقارير المالية' },
  { id: 'detailed-trial-balance', icon: '🔍', label: 'ميزان تفصيلي', section: 'التقارير المالية' },
  { id: 'account-statement', icon: '📄', label: 'كشف حساب', section: 'التقارير المالية' },
  { id: 'guarantees', icon: '🏦', label: 'الضمانات البنكية', section: 'التقارير المالية' },
  { id: 'closing-entries', icon: '🔒', label: 'قيود الإقفال', section: 'التقارير المالية' },
  { id: 'pivot', icon: '🔄', label: 'الجداول المحورية', section: 'التحليل' },
  { id: 'presentation', icon: '🎬', label: 'عرض تقديمي', section: 'التحليل' },
  { id: 'tax-builder', icon: '🧾', label: 'مصمم التقرير الضريبي', section: 'التحليل' },
  { id: 'journal-items', icon: '📋', label: 'القيود المحاسبية', section: 'التحليل' },
  { id: 'data-preview', icon: '🗂️', label: 'معاينة بيانات API', section: 'التحليل' },
  { id: 'sales-data-preview', icon: '🛒', label: 'معاينة المبيعات API', section: 'التحليل' },
  { id: 'analytic-accounts', icon: '📂', label: 'الحسابات التحليلية', section: 'الإعدادات' },
  { id: 'mapping', icon: '🔗', label: 'توحيد الحسابات', section: 'الإعدادات' },
  { id: 'journal-mapping', icon: '🎯', label: 'توحيد اليوميات', section: 'الإعدادات' },
  { id: 'viewers-management', icon: '👥', label: 'إدارة المشاهدين', section: 'الإعدادات' },
  { id: 'settings', icon: '⚙️', label: 'إعدادات النظام', section: 'الإعدادات' },
  { id: 'sales-settings', icon: '🛍️', label: 'إعدادات نظام المبيعات', section: 'الإعدادات' },
  { id: 'api-manager', icon: '🔌', label: 'إدارة الـ APIs', section: 'الإعدادات' },
];

export function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('main-content');
  const toggle = document.getElementById('sidebar-toggle');
  
  const currentPage = store.get('currentPage');
  const isViewer = window.isViewerMode && window.isViewerMode();
  
  // Apply saved collapse state
  if (store.get('sidebarCollapsed')) {
    sidebar.classList.add('collapsed');
    main.classList.add('sidebar-collapsed');
    if (toggle) toggle.querySelector('span').textContent = '►';
  } else {
    sidebar.classList.remove('collapsed');
    main.classList.remove('sidebar-collapsed');
    if (toggle) toggle.querySelector('span').textContent = '◄';
  }
  
  // In viewer mode, only show presentation
  const items = isViewer
    ? navItems.filter(i => i.id === 'presentation')
    : navItems;
  
  let html = '';
  let currentSection = '';
  
  for (const item of items) {
    if (item.section !== currentSection) {
      currentSection = item.section;
      html += `<div class="nav-section-title">${currentSection}</div>`;
    }
    html += `
      <div class="nav-item ${currentPage === item.id ? 'active' : ''}" data-page="${item.id}">
        <span class="nav-item-icon">${item.icon}</span>
        <span class="nav-item-label">${item.label}</span>
      </div>
    `;
  }

  // Logout button
  const adminInfo = JSON.parse(localStorage.getItem('mizaniat_admin_info') || '{}');
  const userName = isViewer ? ('👁️ ' + (adminInfo.name || 'مشاهد')) : (adminInfo.name || adminInfo.email || 'مدير');
  html += `
    <div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:16px; padding-top:12px;">
      <div style="padding:8px 16px; font-size:0.8rem; color:rgba(255,255,255,0.4); display:flex; align-items:center; gap:8px;">
        <span>👤</span>
        <span>${userName}</span>
      </div>
      <div class="nav-item" id="logout-btn" style="color:#ef4444;">
        <span class="nav-item-icon">🚪</span>
        <span class="nav-item-label">تسجيل الخروج</span>
      </div>
    </div>
  `;
  
  nav.innerHTML = html;
  
  // Click handlers
  nav.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      const page = el.dataset.page;
      store.set('currentPage', page);
    });
  });

  // Logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('هل تريد تسجيل الخروج؟')) {
        window.mizaniatLogout();
      }
    });
  }

  // Toggle sidebar
  if (toggle) {
    toggle.onclick = () => {
      sidebar.classList.toggle('collapsed');
      main.classList.toggle('sidebar-collapsed');
      store.set('sidebarCollapsed', sidebar.classList.contains('collapsed'));
      toggle.querySelector('span').textContent = sidebar.classList.contains('collapsed') ? '►' : '◄';
    };
  }
}
