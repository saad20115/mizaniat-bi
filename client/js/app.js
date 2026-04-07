import { store } from './store.js';
import { api } from './api.js';
import { renderSidebar } from './components/sidebar.js';
import { loadFilterOptions } from './components/filters.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderIncomeStatement } from './pages/income-stmt.js';
import { renderBalanceSheet } from './pages/balance-sheet.js';
import { renderCashFlow } from './pages/cash-flow.js';
import { renderPivotTable } from './pages/pivot.js';
import { renderJournalItems } from './pages/journal-items.js';
import { renderMapping } from './pages/mapping.js';
import { renderSettings } from './pages/settings.js';
import { renderDataPreview } from './pages/data-preview.js';
import { renderTrialBalance } from './pages/trial-balance.js';
import { renderDetailedTrialBalance } from './pages/detailed-trial-balance.js';
import { renderClosingEntries } from './pages/closing-entries.js';
import { renderAnalyticAccounts } from './pages/analytic-accounts.js';
import { renderJournalMapping } from './pages/journal-mapping.js';
import { renderPresentation } from './pages/presentation.js';
import { renderAccountStatement } from './pages/account-statement.js';
import { renderGuaranteesPage } from './pages/guarantees.js';
import { renderApiManager } from './pages/api-manager.js';
import { renderSalesSettings } from './pages/sales-settings.js';
import { renderSalesDataPreview } from './pages/sales-data-preview.js';
import { showTaxReportBuilder } from './pages/tax-report-builder.js';
import { showToast } from './utils/ui.js';

// Page router
const pages = {
  'dashboard': renderDashboard,
  'income-statement': renderIncomeStatement,
  'balance-sheet': renderBalanceSheet,
  'cash-flow': renderCashFlow,
  'pivot': renderPivotTable,
  'journal-items': renderJournalItems,
  'mapping': renderMapping,
  'journal-mapping': renderJournalMapping,
  'settings': renderSettings,
  'data-preview': renderDataPreview,
  'trial-balance': renderTrialBalance,
  'detailed-trial-balance': renderDetailedTrialBalance,
  'closing-entries': renderClosingEntries,
  'analytic-accounts': renderAnalyticAccounts,
  'presentation': renderPresentation,
  'account-statement': renderAccountStatement,
  'guarantees': renderGuaranteesPage,
  'api-manager': renderApiManager,
  'sales-settings': renderSalesSettings,
  'sales-data-preview': renderSalesDataPreview,
  'tax-builder': showTaxReportBuilder,
};

async function navigateTo(pageName) {
  const container = document.getElementById('main-content');
  let renderPage = pages[pageName];

  // Lazy load special expenses
  if (pageName === 'special-expenses' && !renderPage) {
    const mod = await import('./pages/special-expenses.js');
    pages['special-expenses'] = mod.renderSpecialExpenses;
    renderPage = mod.renderSpecialExpenses;
  }
  
  // Lazy load viewers-management
  if (pageName === 'viewers-management' && !renderPage) {
    const mod = await import('./pages/viewers-management.js');
    pages['viewers-management'] = mod.renderViewersManagement;
    renderPage = mod.renderViewersManagement;
  }

  if (renderPage) {
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;"><div class="spinner"></div></div>';
    try {
      await renderPage(container);
    } catch (err) {
      console.error(`Error rendering ${pageName}:`, err);
      container.innerHTML = `
        <div style="text-align:center;padding:60px;">
          <div style="font-size:2rem;margin-bottom:16px;">⚠️</div>
          <h2 style="color:var(--text-white);margin-bottom:8px;">حدث خطأ</h2>
          <p style="color:var(--text-muted);">${err.message}</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="location.reload()">إعادة المحاولة</button>
        </div>
      `;
    }
  }
  
  // Update sidebar active state
  renderSidebar();
}

// Logout function (globally available)
window.mizaniatLogout = function() {
  localStorage.removeItem('mizaniat_admin_token');
  localStorage.removeItem('mizaniat_admin_info');
  localStorage.removeItem('mizaniat_viewer_mode');
  sessionStorage.removeItem('mizaniat_viewer_token');
  window.location.href = '/login.html';
};

// Check if viewer mode
window.isViewerMode = () => localStorage.getItem('mizaniat_viewer_mode') === 'true';

// Initialize app
async function init() {
  const isViewer = window.isViewerMode();
  const token = localStorage.getItem('mizaniat_admin_token');

  if (!token) {
    window.location.href = '/login.html';
    return;
  }

  // Verify JWT token (same for admin and viewer — viewer gets a real admin JWT)
  try {
    const meRes = await fetch('/api/auth/admin/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!meRes.ok) {
      localStorage.removeItem('mizaniat_admin_token');
      localStorage.removeItem('mizaniat_admin_info');
      localStorage.removeItem('mizaniat_viewer_mode');
      window.location.href = '/login.html';
      return;
    }
  } catch (e) {
    // Server might be down, continue anyway
  }

  console.log(isViewer ? '👁️ Mizaniat BI Viewer mode' : '🚀 Mizaniat BI initializing...');
  
  try {
    // Load initial data
    const companies = await api.getCompanies();
    store.set('companies', companies);
    
    // Load filter options
    await loadFilterOptions();
    
    // Render sidebar
    renderSidebar();
    
    // Listen to page changes
    store.subscribe((key) => {
      if (key === 'currentPage') {
        navigateTo(store.get('currentPage'));
      }
    });
    
    // Navigate to presentation for viewer, dashboard for admin
    const startPage = isViewer ? 'presentation' : 'dashboard';
    store.set('currentPage', startPage);
    await navigateTo(startPage);
    
    console.log('✅ Mizaniat BI ready');
    
  } catch (err) {
    console.error('Init error:', err);
    document.getElementById('main-content').innerHTML = `
      <div style="text-align:center;padding:80px;">
        <div style="font-size:3rem;margin-bottom:24px;">📊</div>
        <h1 style="color:var(--text-white);margin-bottom:12px;">تقارير مالية</h1>
        <p style="color:var(--text-muted);margin-bottom:24px;">تعذر الاتصال بالخادم.</p>
        <button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>
      </div>
    `;
  }
}

// Start
init();

