/**
 * VIVY ADMIN — admin.js
 *
 * There is no traditional server here. GitHub Pages only serves static
 * files, so this page talks DIRECTLY to GitHub's own REST API (from your
 * phone's browser) to read and commit data/products.json, and to upload
 * cover images / PDF files into this same repository. Every "Publish"
 * click is really a small Git commit, made on your behalf using a
 * Personal Access Token that YOU create and paste in once. The token is
 * stored only in this browser's localStorage — never written into any
 * file, never sent anywhere except https://api.github.com.
 *
 * This is why there is no "admin password" anywhere in this file: nobody
 * can publish a product without a valid token that only you control, and
 * you can revoke that token at any time from your GitHub settings.
 */

const GH_API = 'https://api.github.com';
const CONFIG_KEY = 'vivy_admin_config_v1';
const DATA_PATH = 'data/products.json';

let cfg = null;            // { owner, repo, branch, token }
let catalog = null;        // parsed data/products.json
let catalogSha = null;     // sha of the currently-loaded products.json
let editingSlug = null;    // slug of product currently being edited, or null when adding
let slugManuallyEdited = false;

/* ============================== Boot ============================== */

document.addEventListener('DOMContentLoaded', () => {
  wireLoginForm();
  wireDashboard();
  wireForm();

  const saved = loadConfig();
  if (saved) {
    cfg = saved;
    connect(true);
  }
});

/* ============================ Config / auth ========================= */

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveConfig(c) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
}

function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
  cfg = null;
  catalog = null;
  catalogSha = null;
  show('admin-login-view');
  hide('admin-dashboard-view');
  hide('admin-form-view');
}

function wireLoginForm() {
  const form = document.getElementById('admin-login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const owner = document.getElementById('gh-owner').value.trim();
    const repo = document.getElementById('gh-repo').value.trim();
    const branch = document.getElementById('gh-branch').value.trim() || 'main';
    const token = document.getElementById('gh-token').value.trim();
    if (!owner || !repo || !token) return;
    cfg = { owner, repo, branch, token };
    await connect(false);
  });

  document.getElementById('admin-signout-btn').addEventListener('click', () => {
    if (confirm('Sign out and remove the saved token from this device?')) clearConfig();
  });
}

async function connect(silent) {
  const errEl = document.getElementById('admin-login-error');
  errEl.hidden = true;
  const connectBtn = document.getElementById('admin-connect-btn');
  if (connectBtn) { connectBtn.disabled = true; connectBtn.textContent = 'Connecting…'; }

  try {
    // Verify the token actually has access to this repo before saving it.
    const res = await fetch(`${GH_API}/repos/${cfg.owner}/${cfg.repo}`, { headers: ghHeaders() });
    if (!res.ok) {
      if (res.status === 404) throw new Error("Repository not found, or this token doesn't have access to it. Double-check the username, repository name, and token.");
      if (res.status === 401) throw new Error('That token was rejected by GitHub. It may be invalid, expired, or revoked.');
      throw new Error('GitHub returned an error (' + res.status + '). Please try again.');
    }
    const repoInfo = await res.json();
    if (!cfg.branch) cfg.branch = repoInfo.default_branch || 'main';

    saveConfig(cfg);
    document.getElementById('admin-repo-label').textContent = cfg.owner + '/' + cfg.repo + ' (' + cfg.branch + ')';

    hide('admin-login-view');
    show('admin-dashboard-view');
    await loadCatalog();
    renderDashboard();
  } catch (err) {
    if (silent) {
      // Saved token no longer works — fall back to the login screen quietly.
      clearConfig();
    } else {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  } finally {
    if (connectBtn) { connectBtn.disabled = false; connectBtn.textContent = 'Connect'; }
  }
}

function ghHeaders() {
  return {
    Authorization: 'Bearer ' + cfg.token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/* ======================== GitHub Contents API ======================= */

async function ghGetFile(path) {
  const url = `${GH_API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(cfg.branch)}&t=${Date.now()}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw await ghError(res);
  return res.json();
}

async function ghPutFile(path, base64Content, message, sha) {
  const url = `${GH_API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(path)}`;
  const body = { message, content: base64Content, branch: cfg.branch };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders()),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await ghError(res);
  return res.json();
}

async function ghDeleteFile(path, message, sha) {
  const url = `${GH_API}/repos/${cfg.owner}/${cfg.repo}/contents/${encodeURI(path)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: Object.assign({ 'Content-Type': 'application/json' }, ghHeaders()),
    body: JSON.stringify({ message, sha, branch: cfg.branch }),
  });
  if (!res.ok) throw await ghError(res);
  return res.json();
}

async function ghError(res) {
  let msg = res.status + ' ' + res.statusText;
  try {
    const j = await res.json();
    if (j && j.message) msg = j.message;
  } catch (e) { /* ignore */ }
  if (res.status === 409) msg = 'Someone/something else changed the file at the same moment. Please try again.';
  return new Error(msg);
}

/* ============================ Catalog I/O ============================ */

async function loadCatalog() {
  const file = await ghGetFile(DATA_PATH);
  if (!file) throw new Error(DATA_PATH + ' was not found in this repository.');
  const text = b64ToUtf8(file.content);
  catalog = JSON.parse(text);
  catalogSha = file.sha;
  if (!Array.isArray(catalog.products)) catalog.products = [];
  if (!Array.isArray(catalog.categories)) catalog.categories = [];
  if (!Array.isArray(catalog.freeResources)) catalog.freeResources = [];
  if (!Array.isArray(catalog.bundles)) catalog.bundles = [];
  return catalog;
}

/**
 * Re-fetches the latest products.json, applies `mutateFn(freshCatalog)` to
 * it, then commits the result. This minimizes the chance of overwriting a
 * change made elsewhere between page loads.
 */
async function saveCatalogChange(mutateFn, message) {
  const fresh = await loadCatalog();
  mutateFn(fresh);
  const json = JSON.stringify(fresh, null, 2);
  const result = await ghPutFile(DATA_PATH, utf8ToB64(json), message, catalogSha);
  catalog = fresh;
  catalogSha = result.content ? result.content.sha : catalogSha;
  return fresh;
}

/* ============================== Utilities ============================= */

function utf8ToB64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function b64ToUtf8(b64) {
  return decodeURIComponent(escape(atob(b64.replace(/\n/g, ''))));
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
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
  return (text || '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}
function show(id) { document.getElementById(id).hidden = false; }
function hide(id) { document.getElementById(id).hidden = true; }
function fmtMoney(amount, currency) {
  return window.Vivy ? Vivy.formatMoney(amount, currency) : (currency + ' ' + amount);
}
function esc(s) {
  return window.Vivy ? Vivy.escapeHtml(s) : String(s == null ? '' : s);
}

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
}

function renderDashboard() {
  const list = document.getElementById('admin-product-list');
  const products = catalog.products.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  if (!products.length) {
    list.innerHTML = `<div class="admin-empty"><p>No products yet. Tap <strong>+ Add Product</strong> to publish your first one.</p></div>`;
    return;
  }

  list.innerHTML = products.map((p) => {
    const freeTag = p.price === 0 ? '<span class="admin-tag tag-free">Free</span>' : '';

    const priceHtml = p.salePrice != null && p.salePrice < p.price
      ? `<span class="admin-price-current">${fmtMoney(p.salePrice, p.currency)}</span> <span class="admin-price-original">${fmtMoney(p.price, p.currency)}</span>`
      : `<span class="admin-price-current">${fmtMoney(p.price, p.currency)}</span>`;

    const toggleBtn = (field, label, activeClass) => {
      const active = !!p[field];
      const cls = 'admin-tag' + (active ? ' ' + activeClass : ' is-off');
      return `<button type="button" class="${cls}" style="border:none;cursor:pointer;opacity:${active ? '1' : '0.45'};" data-toggle-slug="${esc(p.slug)}" data-toggle-field="${field}">${label}</button>`;
    };

    return `
    <div class="admin-product-row" data-slug="${esc(p.slug)}">
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
        <button type="button" class="btn btn-outline btn-sm" data-edit="${esc(p.slug)}">Edit</button>
        <button type="button" class="btn btn-danger btn-sm" data-delete="${esc(p.slug)}">Delete</button>
      </div>
    </div>`;
  }).join('');

  list.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openForm(btn.dataset.edit));
  });
  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteProduct(btn.dataset.delete));
  });
  list.querySelectorAll('[data-toggle-slug]').forEach((btn) => {
    btn.addEventListener('click', () => toggleFlag(btn.dataset.toggleSlug, btn.dataset.toggleField));
  });
}

async function deleteProduct(slug) {
  const product = catalog.products.find((p) => p.slug === slug);
  if (!product) return;
  if (!confirm(`Delete "${product.name}"? This removes it from the store and its product page. This can't be undone.`)) return;

  clearBanner('dashboard-banner');
  banner('dashboard-banner', 'info', 'Deleting…');
  try {
    await saveCatalogChange((fresh) => {
      fresh.products = fresh.products.filter((p) => p.slug !== slug);
    }, `Delete product: ${product.name}`);

    // Best-effort cleanup of the uploaded files — a failure here doesn't
    // block the delete, since the product is already off the store.
    await tryDeleteFile(product.image);
    await tryDeleteFile(product.downloadUrl);

    banner('dashboard-banner', 'success', `"${product.name}" was deleted. It will disappear from the live store within about a minute.`);
    renderDashboard();
  } catch (err) {
    banner('dashboard-banner', 'error', err.message);
  }
}

async function tryDeleteFile(path) {
  if (!path || path.indexOf('assets/') !== 0) return;
  try {
    const file = await ghGetFile(path);
    if (file) await ghDeleteFile(path, 'Remove unused file: ' + path, file.sha);
  } catch (e) { /* best-effort only */ }
}

async function toggleFlag(slug, field) {
  clearBanner('dashboard-banner');
  try {
    await saveCatalogChange((fresh) => {
      const p = fresh.products.find((x) => x.slug === slug);
      if (p) p[field] = !p[field];
    }, `Toggle ${field} on ${slug}`);
    renderDashboard();
  } catch (err) {
    banner('dashboard-banner', 'error', err.message);
  }
}

/* =============================== Form ================================= */

function wireForm() {
  document.getElementById('admin-cancel-btn').addEventListener('click', closeForm);
  document.getElementById('admin-back-btn').addEventListener('click', closeForm);

  const nameEl = document.getElementById('f-name');
  const slugEl = document.getElementById('f-slug');
  nameEl.addEventListener('input', () => {
    if (!slugManuallyEdited) {
      slugEl.value = slugify(nameEl.value);
      updateSlugPreview();
    }
  });
  slugEl.addEventListener('input', () => {
    slugManuallyEdited = true;
    slugEl.value = slugify(slugEl.value);
    updateSlugPreview();
  });

  document.getElementById('f-image').addEventListener('change', (e) => previewImage(e.target.files[0]));

  document.getElementById('admin-product-form').addEventListener('submit', handleSubmit);
  document.getElementById('admin-delete-from-form-btn').addEventListener('click', () => {
    if (editingSlug) deleteProduct(editingSlug);
  });
}

function updateSlugPreview() {
  const slugEl = document.getElementById('f-slug');
  document.getElementById('admin-slug-preview').textContent =
    'Product URL: product.html?slug=' + (slugEl.value || '…');
}

function previewImage(file) {
  const img = document.getElementById('f-image-preview');
  if (!file) { img.style.display = 'none'; return; }
  const reader = new FileReader();
  reader.onload = () => { img.src = reader.result; img.style.display = 'block'; };
  reader.readAsDataURL(file);
}

function openForm(slug) {
  editingSlug = slug;
  slugManuallyEdited = !!slug;
  clearBanner('form-banner');
  document.getElementById('admin-product-form').reset();
  document.getElementById('f-image-preview').style.display = 'none';
  document.getElementById('f-current-image').textContent = '';
  document.getElementById('f-current-pdf').textContent = '';

  populateCategorySelect();

  const title = document.getElementById('admin-form-title');
  const deleteBtn = document.getElementById('admin-delete-from-form-btn');

  if (slug) {
    const p = catalog.products.find((x) => x.slug === slug);
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
    if (p.image) document.getElementById('f-current-image').textContent = 'Current cover: ' + p.image;
    if (p.downloadUrl && p.downloadUrl.indexOf('assets/') === 0) document.getElementById('f-current-pdf').textContent = 'Current file: ' + p.downloadUrl;
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
  editingSlug = null;
}

function populateCategorySelect() {
  const sel = document.getElementById('f-category');
  sel.innerHTML = catalog.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}

async function handleSubmit(e) {
  e.preventDefault();
  clearBanner('form-banner');

  const name = document.getElementById('f-name').value.trim();
  let slug = slugify(document.getElementById('f-slug').value);
  const shortDescription = document.getElementById('f-short-desc').value.trim();
  const description = document.getElementById('f-desc').value.trim();
  const price = parseFloat(document.getElementById('f-price').value);
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

  if (!name || !slug || !shortDescription || isNaN(price) || !category) {
    banner('form-banner', 'error', 'Please fill in product name, slug, short description, price and category.');
    return;
  }

  const duplicate = catalog.products.find((p) => p.slug === slug && p.slug !== editingSlug)
    || catalog.freeResources.find((p) => p.slug === slug);
  if (duplicate) {
    banner('form-banner', 'error', 'Another product already uses the slug "' + slug + '". Please choose a different slug.');
    return;
  }

  const submitBtn = document.getElementById('admin-submit-btn');
  const progressEl = document.getElementById('admin-form-progress');
  submitBtn.disabled = true;
  progressEl.classList.add('is-active');

  try {
    const existing = editingSlug ? catalog.products.find((p) => p.slug === editingSlug) : null;

    let imagePath = existing ? existing.image : 'assets/images/gallery-placeholder-1.svg';
    if (imageFile) {
      progressEl.textContent = 'Uploading cover image…';
      const ext = (imageFile.name.split('.').pop() || 'jpg').toLowerCase();
      imagePath = `assets/images/${slug}.${ext}`;
      await uploadBinaryFile(imagePath, imageFile, `Upload cover image for ${name}`);
    }

    let downloadUrl = existing ? existing.downloadUrl : '#placeholder-secure-download';
    if (pdfFile) {
      progressEl.textContent = 'Uploading product file…';
      downloadUrl = `assets/downloads/${slug}.pdf`;
      await uploadBinaryFile(downloadUrl, pdfFile, `Upload product file for ${name}`);
    }

    const product = Object.assign({}, existing, {
      id: existing ? existing.id : String(Date.now()).slice(-6),
      slug,
      name,
      shortDescription,
      description,
      price,
      salePrice: salePrice != null && !isNaN(salePrice) ? salePrice : null,
      currency,
      category,
      image: imagePath,
      gallery: [imagePath],
      rating: existing ? existing.rating || 0 : 0,
      reviewCount: existing ? existing.reviewCount || 0 : 0,
      featured,
      bestSeller,
      newProduct,
      format: (existing && existing.format) || 'PDF',
      pages: existing ? existing.pages : '',
      fileSize: pdfFile ? formatBytes(pdfFile.size) : (existing ? existing.fileSize : ''),
      whatsIncluded,
      features,
      whoItsFor: existing ? existing.whoItsFor : '',
      requirements: existing ? existing.requirements : '',
      seoTitle: (existing && existing.seoTitle) || (name + ' | Vivy'),
      seoDescription: (existing && existing.seoDescription) || shortDescription,
      downloadUrl,
    });

    progressEl.textContent = 'Publishing to your store…';

    await saveCatalogChange((fresh) => {
      const idx = editingSlug ? fresh.products.findIndex((p) => p.slug === editingSlug) : -1;
      if (idx !== -1) {
        fresh.products[idx] = product;
      } else {
        fresh.products.push(product);
      }
    }, (editingSlug ? 'Update product: ' : 'Add product: ') + name);

    banner('dashboard-banner', 'success', `"${name}" is published. It will appear on your live store within about 30–60 seconds, at product.html?slug=${slug}.`);
    closeForm();
    renderDashboard();
  } catch (err) {
    banner('form-banner', 'error', err.message);
  } finally {
    submitBtn.disabled = false;
    progressEl.classList.remove('is-active');
    progressEl.textContent = '';
  }
}

async function uploadBinaryFile(path, file, message) {
  const base64 = await fileToBase64(file);
  let sha = null;
  try {
    const existingFile = await ghGetFile(path);
    if (existingFile) sha = existingFile.sha;
  } catch (e) { /* ignore, treat as new file */ }
  await ghPutFile(path, base64, message, sha);
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return mb.toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}
