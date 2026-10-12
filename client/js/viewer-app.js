/**
 * Viewer App — standalone entry point for phone-authenticated viewers.
 * Renders the EXACT SAME presentation page as the admin panel,
 * but uses viewer token (phone login) instead of admin JWT.
 */
import { store } from './store.js';
import { api } from './api.js';
import { renderPresentation } from './pages/presentation.js';

// ===== VIEWER AUTH =====
const urlParams = new URLSearchParams(window.location.search);
const currentUrlScopedToken = urlParams.get('share') || urlParams.get('scoped');
if (currentUrlScopedToken) {
  sessionStorage.setItem('mizaniat_scoped_token', currentUrlScopedToken);
}
const scopedShareToken = currentUrlScopedToken || sessionStorage.getItem('mizaniat_scoped_token') || '';

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

// Ensure viewer mode flag is set and admin token is cleared
localStorage.setItem('mizaniat_viewer_mode', 'true');
localStorage.removeItem('mizaniat_admin_token');

// ===== INIT =====
checkAuth();

async function checkAuth() {
  // If we have a stored viewer token, verify it
  if (viewerToken) {
    try {
      const verifyEndpoint = scopedShareToken ? '/api/auth/scoped-share/verify' : '/api/auth/viewer/verify';
      const vr = await originalFetch(verifyEndpoint, {
        headers: { 'x-viewer-token': viewerToken }
      });
      if (vr.ok) {
        const vdata = await vr.json().catch(() => ({}));
        if (vdata.share) {
          sessionStorage.setItem('mizaniat_scoped_share', JSON.stringify(vdata.share));
        }
        hideLogin();
        loadApp();
        return;
      }
    } catch (e) {}
    sessionStorage.removeItem('mizaniat_viewer_token');
    sessionStorage.removeItem('mizaniat_scoped_share');
    viewerToken = '';
  }
  // Show phone login
  showLogin();
}

function showLogin() {
  document.getElementById('viewer-login-overlay').classList.remove('hidden');
  document.getElementById('viewer-loading').style.display = 'none';
  document.getElementById('main-content').style.display = 'none';

  if (scopedShareToken) {
    const subtitleEl = document.querySelector('.viewer-login-subtitle');
    if (subtitleEl) subtitleEl.textContent = 'رابط مشاركة مخصص بنطاق محدد';
    const labelEl = document.querySelector('.viewer-login-label');
    if (labelEl) labelEl.textContent = 'أدخل رقم الجوال المصرح به لعرض التقرير:';
    const footerEl = document.querySelector('.viewer-login-footer');
    if (footerEl) footerEl.textContent = 'الدخول مقتصر على أرقام الجوال المصرح لها لهذا الرابط';
  }

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
    const loginEndpoint = scopedShareToken ? '/api/auth/scoped-share/login' : '/api/auth/viewer/login';
    const loginBody = scopedShareToken ? { token: scopedShareToken, phone } : { phone };

    const r = await originalFetch(loginEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginBody)
    });
    const data = await r.json();
    if (!r.ok) {
      errEl.textContent = data.error || (scopedShareToken ? 'رابط المشاركة أو رقم الجوال غير صحيح' : 'رقم الجوال غير مسجل — تواصل مع المسؤول');
      errEl.classList.add('show');
      return;
    }

    viewerToken = data.token;
    sessionStorage.setItem('mizaniat_viewer_token', viewerToken);
    localStorage.setItem('mizaniat_viewer_token', viewerToken);
    localStorage.setItem('mizaniat_viewer_mode', 'true');
    localStorage.removeItem('mizaniat_admin_token');

    if (data.share) {
      sessionStorage.setItem('mizaniat_scoped_share', JSON.stringify(data.share));
    }

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
