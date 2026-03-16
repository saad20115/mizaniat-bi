/**
 * Toast notification utility
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Modal utility
 */
export function showModal(title, contentHTML) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  
  content.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <button class="modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')">✕</button>
    </div>
    <div class="modal-body">${contentHTML}</div>
  `;
  
  overlay.classList.add('active');
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.classList.remove('active');
  };
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

/**
 * Loading state for an element
 */
export function setLoading(element, loading) {
  if (loading) {
    element.style.position = 'relative';
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner"></div>';
    overlay.id = 'loading-' + element.id;
    element.appendChild(overlay);
  } else {
    const overlay = element.querySelector('.loading-overlay');
    if (overlay) overlay.remove();
  }
}
