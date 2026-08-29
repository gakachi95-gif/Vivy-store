/**
 * VIVY ADMIN — admin.js
 *
 * This talks to YOUR Render backend, not GitHub. Every request below goes
 * to `${Vivy.apiBase}/api/admin/...` with your login session token attached
 * as `Authorization: Bearer <token>`. The token is issued by the backend
 * after it checks your username/password against Render environment
 * variables (never against anything in this file), and it expires — if
 * it does, you'll see "Session expired" and be sent back to the login
 * screen. Nothing secret ever lives in this page's code.
 */

const API = () => Vivy.apiBase;
const TOKEN_KEY = 'vivy_admin_token_v1';

let token = null;
let catalog = { products: [], categories: [] }; // admin's working copy, always sourced from the backend
let editingId = null;      // id of the product currently being edited, or null when adding
let slugManuallyEdited = false;

/* ============================== Boot ============================== */

document.addEventListener('DOMContentLoaded', () => {
  wireLoginForm();
  wireDashboard();
  wireForm();

  token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    enterDashboard().catch(() => signOut(false));
  }
});

/* ============================ Auth ========================= */

function wireLoginForm() {
  const form = document.getElementById('admin-login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;
    if (!username || !password) return;

    const errEl = document.getElementById('admin-login-error');
    errEl.hidden = true;
    const btn = document.getElementById('admin-connect-btn');
    btn.disabled = true;
    btn.textContent = 'Logging in…';

    try {
      const res = await fetch(API() + '/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) {
        throw new Error(data.message || (res.status === 401 ? 'Incorrect username or password.' : 'Could not log in right now.'));
      }
      token = data.token;
      localStorage.setItem(TOKEN_KEY, token);
      await enterDashboard();
    } catch (err) {
      errEl.textContent = err.message || 'Could not reach the server. Please check your connection and try again.';
      errEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Log In';
    }
  });

  document.getElementById('admin-signout-btn').addEventListener('click', () => signOut(true));
}

function signOut(showLogin) {
  localStorage.removeItem(TOKEN_KEY);
  token = null;
  if (showLogin) {
    show('admin-login-view');
    hide('admin-dashboard-view');
    hide('admin-form-view');
    hide('admin-header-actions');
  }
}

async function enterDashboard() {
  hide('admin-login-view');
  show('admin-dashboard-view');
  show('admin-header-actions');
  await loadCatalog();
  renderDashboard();
}

/** Wraps fetch with the auth header + shared 401 ("session expired") handling. */
async function api(path, options) {
  options = options || {};
  const headers = Object.assign({}, options.headers, { Authorization: 'Bearer ' + token });
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(API() + path, Object.assign({}, options, { headers }));

  if (res.status === 401) {
    signOut(true);
    const el = document.getElementById('admin-login-error');
    el.textContent = 'Session expired. Please log in again.';
    el.hidden = false;
    throw new Error('Session expired.');
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }

  if (!res.ok) {
    throw new Error((data && data.message) || 'Something went wrong (' + res.status + ').');
  }
  return data;
}

/* ============================== Utilities ============================= */

function slugify(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
function linesToArray(text) {
  return (text || '').split('\n').map((s) => s.trim()).filter(Boolean);
}
function show(id) { document.getElementById(id).hidden = false; }
function hide(id) { document.getElementById(id).hidden = true; }
function fmtMoney(amount, currency) { return Vivy.formatMoney(amount, currency); }
function esc(s) { return Vivy.escapeHtml(s); }

/* ============================== Banners ============================== */

function banner(containerId, type, message) {
  const el = document.getElementById(containerId);
  el.innerHTML = `<div class="admin-banner is-${type}">${esc(message)}</div>`;
  el.hidden = false;
}
function clearBanner(containerId) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  el.hidden = true;
}

/* ============================== Catalog ============================= */

async function loadCatalog() {
  const data = await api('/api/admin/products', { method: 'GET' });
  catalog.products = (data && data.products) || [];
  catalog.categories = (data && data.categories) || [];
  if (!catalog.categories.length) {
    // Sensible built-in fallback so the category dropdown is never empty,
    // even before you've published anything.
    catalog.categories = [
      { id: 'make-money-online', name: 'Make Money Online' },
      { id: 'ai-automation', name: 'AI & Automation' },
      { id: 'social-growth', name: 'Social Growth' },
      { id: 'digital-marketing', name: 'Digital Marketing' },
      { id: 'content-creation', name: 'Content Creation' },
      { id: 'templates', name: 'Templates' },
      { id: 'business', name: 'Business' },
      { id: 'productivity', name: 'Productivity' },
    ];
  }
  return catalog;
}

/* ============================== Dashboard ============================= */

function wireDashboard() {
  document.getElementById('admin-add-btn').addEventListener('click', () => openForm(null));

  document.getElementById('admin-refresh-btn').addEventListener('click', async () => {
    clearBanner('dashboard-banner');
    try {
      await loadCatalog();
      renderDashboard();
    } catch (err) {
      banner('dashboard-banner', 'error', err.message);
    }
  });

  document.getElementById('admin-import-btn').addEventListener('click', importExistingProducts);
}

/**
 * One-time migration helper: reads the store's bundled data/products.json
 * (your existing catalog) and imports every product into the backend
 * database, so nothing you already have gets lost when the backend
 * becomes the source of truth. Safe to click more than once — the backend
 * is expected to skip/update by slug rather than duplicate.
 */
async function importExistingProducts() {
  if (!confirm("Import your existing products.json catalog into the backend? This won't delete anything already there.")) return;
  clearBanner('dashboard-banner');
  banner('dashboard-banner', 'info', 'Importing your existing products…');
  try {
    const res = await fetch('data/products.json');
    if (!res.ok) throw new Error('Could not read data/products.json.');
    const staticData = await res.json();
    const allProducts = (staticData.products || []).concat(staticData.freeResources || []);

    const result = await api('/api/admin/import', {
      method: 'POST',
      body: JSON.stringify({ products: allProducts, categories: staticData.categories || [] }),
    });

    await loadCatalog();
    renderDashboard();
    banner('dashboard-banner', 'success', (result && result.message) || `Imported ${allProducts.length} product(s) successfully.`);
  } catch (err) {
    banner('dashboard-banner', 'error', 'Unable to import products: ' + err.message);
  }
}

function renderDashboard() {
  const list = document.getElementById('admin-product-list');
  const products = catalog.products.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (!products.length) {
    list.innerHTML = `<div class="admin-empty"><p>No products yet. Tap <strong>+ Add Product</strong>, or <strong>Import existing products</strong> if you had products before.</p></div>`;
    return;
  }

  list.innerHTML = products.map((p) => {
    const isFree = Vivy.isFree(p);
    const freeTag = isFree ? '<span class="admin-tag tag-free">Free</span>' : '';

    const priceHtml = (!isFree && p.salePrice != null && p.salePrice < p.price)
      ? `<span class="admin-price-current">${fmtMoney(p.salePrice, p.currency)}</span> <span class="admin-price-original">${fmtMoney(p.price, p.currency)}</span>`
      : `<span class="admin-price-current">${fmtMoney(isFree ? 0 : p.price, p.currency)}</span>`;

    const toggleBtn = (field, label, activeClass) => {
      const active = !!p[field];
      const cls = 'admin-tag' + (active ? ' ' + activeClass : ' is-off');
      return `<button type="button" class="${cls}" style="border:none;cursor:pointer;opacity:${active ? '1' : '0.45'};" data-toggle-id="${esc(p.id)}" data-toggle-field="${field}">${label}</button>`;
    };

    return `
    <div class="admin-product-row" data-id="${esc(p.id)}">
      <img class="admin-product-thumb" src="${esc(p.image || 'assets/images/gallery-placeholder-1.svg')}" alt="" onerror="this.src='assets/images/gallery-placeholder-1.svg'">
      <div class="admin-product-info">
        <h3>${esc(p.name)}</h3>
        <div class="admin-product-meta">${priceHtml} ${freeTag}</div>
        <div class="admin-tag-row" style="margin-top:6px;">
          ${toggleBtn('featured', 'Featured', '')}
          ${toggleBtn('bestSeller', 'Best Seller', 'tag-best')}
          ${toggleBtn('newProduct', 'New', 'tag-new')}
        </div>
      </div>
      <div class="admin-row-actions">
        <button type="button" class="btn btn-outline btn-sm" data-edit="${esc(p.id)}">Edit</button>
        <button type="button" class="btn btn-danger btn-sm" data-delete="${esc(p.id)}">Delete</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', () => openForm(btn.dataset.edit)));
  list.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', () => deleteProduct(btn.dataset.delete)));
  list.querySelectorAll('[data-toggle-id]').forEach((btn) => btn.addEventListener('click', () => toggleFlag(btn.dataset.toggleId, btn.dataset.toggleField)));
}

async function deleteProduct(id) {
  const product = catalog.products.find((p) => String(p.id) === String(id));
  if (!product) return;
  if (!confirm(`Delete "${product.name}"? This removes it from the store and its product page. This can't be undone.`)) return;

  clearBanner('dashboard-banner');
  try {
    await api('/api/admin/products/' + encodeURIComponent(id), { method: 'DELETE' });
    banner('dashboard-banner', 'success', `Product deleted. "${product.name}" will disappear from the live store shortly.`);
    await loadCatalog();
    renderDashboard();
  } catch (err) {
    banner('dashboard-banner', 'error', 'Unable to save product: ' + err.message);
  }
}

async function toggleFlag(id, field) {
  const product = catalog.products.find((p) => String(p.id) === String(id));
  if (!product) return;
  clearBanner('dashboard-banner');
  try {
    await api('/api/admin/products/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify({ [field]: !product[field] }),
    });
    await loadCatalog();
    renderDashboard();
  } catch (err) {
    banner('dashboard-banner', 'error', 'Unable to save product: ' + err.message);
  }
}

/* =============================== Form ================================= */

function wireForm() {
  document.getElementById('admin-cancel-btn').addEventListener('click', closeForm);
  document.getElementById('admin-back-btn').addEventListener('click', closeForm);

  const nameEl = document.getElementById('f-name');
  const slugEl = document.getElementById('f-slug');
  nameEl.addEventListener('input', () => {
    if (!slugManuallyEdited) { slugEl.value = slugify(nameEl.value); updateSlugPreview(); }
  });
  slugEl.addEventListener('input', () => {
    slugManuallyEdited = true;
    slugEl.value = slugify(slugEl.value);
    updateSlugPreview();
  });

  document.getElementById('f-image').addEventListener('change', (e) => previewImage(e.target.files[0]));

  document.getElementById('admin-product-form').addEventListener('submit', handleSubmit);
  document.getElementById('admin-delete-from-form-btn').addEventListener('click', () => {
    if (editingId != null) deleteProduct(editingId);
  });
}

function updateSlugPreview() {
  const slugEl = document.getElementById('f-slug');
  document.getElementById('admin-slug-preview').textContent = 'Product URL: product.html?slug=' + (slugEl.value || '…');
}

function previewImage(file) {
  const img = document.getElementById('f-image-preview');
  if (!file) { img.style.display = 'none'; return; }
  const reader = new FileReader();
  reader.onload = () => { img.src = reader.result; img.style.display = 'block'; };
  reader.readAsDataURL(file);
}

function populateCategorySelect() {
  const sel = document.getElementById('f-category');
  sel.innerHTML = catalog.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}

function openForm(id) {
  editingId = id;
  slugManuallyEdited = !!id;
  clearBanner('form-banner');
  document.getElementById('admin-product-form').reset();
  document.getElementById('f-image-preview').style.display = 'none';
  document.getElementById('f-current-image').textContent = '';
  document.getElementById('f-current-pdf').textContent = '';

  populateCategorySelect();

  const title = document.getElementById('admin-form-title');
  const deleteBtn = document.getElementById('admin-delete-from-form-btn');

  if (id != null) {
    const p = catalog.products.find((x) => String(x.id) === String(id));
    title.textContent = 'Edit Product';
    deleteBtn.hidden = false;
    document.getElementById('f-name').value = p.name || '';
    document.getElementById('f-slug').value = p.slug || '';
    document.getElementById('f-short-desc').value = p.shortDescription || '';
    document.getElementById('f-desc').value = p.description || '';
    document.getElementById('f-price').value = p.price != null ? p.price : '';
    document.getElementById('f-sale-price').value = p.salePrice != null ? p.salePrice : '';
    document.getElementById('f-currency').value = p.currency || 'NGN';
    document.getElementById('f-category').value = p.category || '';
    document.getElementById('f-features').value = (p.features || []).join('\n');
    document.getElementById('f-included').value = (p.whatsIncluded || []).join('\n');
    document.getElementById('f-featured').checked = !!p.featured;
    document.getElementById('f-bestseller').checked = !!p.bestSeller;
    document.getElementById('f-new').checked = !!p.newProduct;
    if (p.image) document.getElementById('f-current-image').textContent = 'Current cover set.';
    if (p.hasFile) document.getElementById('f-current-pdf').textContent = 'A product file is already uploaded.';
  } else {
    title.textContent = 'Add Product';
    deleteBtn.hidden = true;
    document.getElementById('f-currency').value = 'NGN';
  }
  updateSlugPreview();

  hide('admin-dashboard-view');
  show('admin-form-view');
  window.scrollTo(0, 0);
}

function closeForm() {
  hide('admin-form-view');
  show('admin-dashboard-view');
  editingId = null;
}

async function handleSubmit(e) {
  e.preventDefault();
  clearBanner('form-banner');

  const name = document.getElementById('f-name').value.trim();
  const slug = slugify(document.getElementById('f-slug').value);
  const shortDescription = document.getElementById('f-short-desc').value.trim();
  const description = document.getElementById('f-desc').value.trim();
  const priceRaw = document.getElementById('f-price').value;
  const price = parseFloat(priceRaw);
  const salePriceRaw = document.getElementById('f-sale-price').value.trim();
  const salePrice = salePriceRaw === '' ? null : parseFloat(salePriceRaw);
  const currency = document.getElementById('f-currency').value;
  const category = document.getElementById('f-category').value;
  const features = linesToArray(document.getElementById('f-features').value);
  const whatsIncluded = linesToArray(document.getElementById('f-included').value);
  const featured = document.getElementById('f-featured').checked;
  const bestSeller = document.getElementById('f-bestseller').checked;
  const newProduct = document.getElementById('f-new').checked;
  const imageFile = document.getElementById('f-image').files[0] || null;
  const pdfFile = document.getElementById('f-pdf').files[0] || null;

  if (!name || !slug || !shortDescription || priceRaw === '' || isNaN(price) || !category) {
    banner('form-banner', 'error', 'Please fill in product name, slug, short description, price and category.');
    return;
  }

  const submitBtn = document.getElementById('admin-submit-btn');
  const progressEl = document.getElementById('admin-form-progress');
  submitBtn.disabled = true;
  progressEl.classList.add('is-active');

  try {
    // Fields go up as plain JSON; files go up separately as multipart to
    // /api/admin/upload, which returns a reference the backend then attaches
    // to the product record. This keeps large file bytes out of the JSON
    // product payload and lets the backend put the PDF in gated storage.
    let imageRef;
    if (imageFile) {
      progressEl.textContent = 'Uploading cover image…';
      imageRef = await uploadFile(imageFile, 'cover', slug);
    }
    let pdfRef;
    if (pdfFile) {
      progressEl.textContent = 'Uploading product file…';
      pdfRef = await uploadFile(pdfFile, 'pdf', slug);
    }

    progressEl.textContent = editingId != null ? 'Updating product…' : 'Publishing product…';

    const payload = {
      name, slug, shortDescription, description,
      price, salePrice: (salePriceRaw !== '' && !isNaN(salePrice)) ? salePrice : null,
      currency, category, features, whatsIncluded, featured, bestSeller, newProduct,
    };
    if (imageRef) payload.image = imageRef.url || imageRef.key;
    if (pdfRef) payload.fileRef = pdfRef.key || pdfRef.url;

    if (editingId != null) {
      await api('/api/admin/products/' + encodeURIComponent(editingId), { method: 'PUT', body: JSON.stringify(payload) });
      banner('dashboard-banner', 'success', `"${name}" was updated and published.`);
    } else {
      await api('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
      banner('dashboard-banner', 'success', `"${name}" is published. It will appear on your live store shortly, at product.html?slug=${slug}.`);
    }

    await loadCatalog();
    closeForm();
    renderDashboard();
  } catch (err) {
    banner('form-banner', 'error', (editingId != null ? 'Unable to save product: ' : 'Unable to publish product: ') + err.message);
  } finally {
    submitBtn.disabled = false;
    progressEl.classList.remove('is-active');
    progressEl.textContent = '';
  }
}

async function uploadFile(file, type, slug) {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type); // 'cover' | 'pdf'
  form.append('slug', slug);
  const data = await api('/api/admin/upload', { method: 'POST', body: form });
  if (!data || (!data.url && !data.key)) throw new Error('Upload did not return a file reference.');
  return data;
}
