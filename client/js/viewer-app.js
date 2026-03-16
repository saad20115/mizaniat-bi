/**
 * Viewer App — standalone entry point for phone-authenticated viewers.
 * Renders the EXACT SAME presentation page as the admin panel,
 * but uses viewer token (phone login) instead of admin JWT.
 */
import { store } from './store.js';
import { api } from './api.js';
import { renderPresentation } from './pages/presentation.js';

// ===== VIEWER AUTH =====
let viewerToken = sessionStorage.getItem('mizaniat_viewer_token') || '';

// Override api.js request behavior: use viewer token instead of admin JWT
// We do this by setting a fake admin token that won't be used,
// and intercepting fetch to add the viewer token header
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  // For API calls, replace admin auth with viewer auth
  if (typeof url === 'string' && url.startsWith('/api') && viewerToken) {
    options.headers = options.headers || {};
    // Remove any admin token
    delete options.headers['Authorization'];
    // Add viewer token
    options.headers['x-viewer-token'] = viewerToken;
  }
  return originalFetch.call(this, url, options);
};

// Prevent api.js from redirecting to login.html on 401
// by setting a dummy admin token in localStorage
localStorage.setItem('mizaniat_admin_token', 'viewer-mode');

// ===== INIT =====
checkAuth();

async function checkAuth() {
  // If we have a stored viewer token, verify it
  if (viewerToken) {
    try {
      const vr = await originalFetch('/api/auth/viewer/verify?token=' + viewerToken);
      if (vr.ok) {
        hideLogin();
        loadApp();
        return;
      }
    } catch (e) {}
    sessionStorage.removeItem('mizaniat_viewer_token');
    viewerToken = '';
  }
  // Show phone login
  showLogin();
}

function showLogin() {
  document.getElementById('viewer-login-overlay').classList.remove('hidden');
  document.getElementById('viewer-loading').style.display = 'none';
  document.getElementById('main-content').style.display = 'none';
  const phoneInput = document.getElementById('viewer-phone');
  phoneInput.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  phoneInput.focus();
  document.getElementById('viewer-login-btn').addEventListener('click', doLogin);
}

function hideLogin() {
  document.getElementById('viewer-login-overlay').classList.add('hidden');
}

async function doLogin() {
  const phone = document.getElementById('viewer-phone').value.trim();
  const errEl = document.getElementById('viewer-error');
  errEl.classList.remove('show');

  if (!phone) {
    errEl.textContent = 'يرجى إدخال رقم الجوال';
    errEl.classList.add('show');
    return;
  }

  const btn = document.getElementById('viewer-login-btn');
  btn.disabled = true;
  btn.textContent = 'جاري التحقق...';

  try {
    const r = await originalFetch('/api/auth/viewer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await r.json();
    if (!r.ok) {
      errEl.textContent = data.error || 'رقم الجوال غير مسجل — تواصل مع المسؤول';
      errEl.classList.add('show');
      return;
    }

    viewerToken = data.token;
    sessionStorage.setItem('mizaniat_viewer_token', viewerToken);
    hideLogin();
    loadApp();
  } catch (e) {
    errEl.textContent = 'تعذر الاتصال بالخادم';
    errEl.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'دخول';
  }
}

// ===== LOAD APP =====
async function loadApp() {
  const loading = document.getElementById('viewer-loading');
  const main = document.getElementById('main-content');
  loading.style.display = 'flex';
  main.style.display = 'none';

  try {
    // Load companies (same as admin app.js init)
    const companies = await api.getCompanies();
    store.set('companies', companies);

    // Load filter options
    const { loadFilterOptions } = await import('./components/filters.js');
    await loadFilterOptions();

    // Show main content and render the presentation page
    loading.style.display = 'none';
    main.style.display = 'block';
    await renderPresentation(main);

    console.log('✅ Mizaniat Viewer ready');
  } catch (err) {
    console.error('Viewer init error:', err);
    // If 401, re-show login
    if (err.message && err.message.includes('401')) {
      sessionStorage.removeItem('mizaniat_viewer_token');
      viewerToken = '';
      loading.style.display = 'none';
      showLogin();
      return;
    }
    loading.style.display = 'none';
    main.style.display = 'block';
    main.innerHTML = `
      <div style="text-align:center;padding:80px;">
        <div style="font-size:3rem;margin-bottom:24px;">📊</div>
        <h1 style="color:var(--text-white);margin-bottom:12px;">تقارير مالية</h1>
        <p style="color:var(--text-muted);margin-bottom:24px;">${err.message || 'تعذر تحميل البيانات'}</p>
        <button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>
      </div>
    `;
  }
}
