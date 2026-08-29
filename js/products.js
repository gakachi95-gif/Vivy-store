/**
 * VIVY — products.js
 * Central data layer. Every page loads data/products.json through this file.
 * Adding a product to data/products.json automatically makes it available
 * everywhere: home, store, categories, bundles, search and its own product page.
 */

const Vivy = (function () {
  // Single place to configure the backend. checkout.html and admin.html both
  // reuse this value (Vivy.apiBase) instead of hardcoding it a second time.
  const API_BASE = 'https://vivyp.onrender.com';
  const DATA_URL = 'data/products.json'; // offline/fallback copy, bundled in this repo
  let dataPromise = null;

  function normalizeCatalog(data) {
    data = data || {};
    if (!Array.isArray(data.products)) data.products = [];
    if (!Array.isArray(data.categories)) data.categories = [];
    if (!Array.isArray(data.freeResources)) data.freeResources = [];
    if (!Array.isArray(data.bundles)) data.bundles = [];
    // Defensive numeric coercion: a SQL "numeric" column (very common for
    // money columns) is returned as a STRING by most DB drivers, e.g.
    // "0.00" instead of 0. Left alone, `product.price === 0` would be
    // false for a genuinely free product. Normalize once, here, so every
    // other function in this app can safely assume price/salePrice are
    // real numbers (or null).
    const coerce = (p) => {
      p.price = typeof p.price === 'string' ? parseFloat(p.price) : p.price;
      if (typeof p.price !== 'number' || isNaN(p.price)) p.price = 0;
      if (p.salePrice != null) {
        p.salePrice = typeof p.salePrice === 'string' ? parseFloat(p.salePrice) : p.salePrice;
        if (isNaN(p.salePrice)) p.salePrice = null;
      }
      return p;
    };
    data.products = data.products.map(coerce);
    data.freeResources = data.freeResources.map(coerce);
    return data;
  }

  function loadStaticFallback() {
    return fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error('Could not load fallback product data (' + res.status + ')');
        return res.json();
      })
      .catch((err) => {
        console.error('Vivy: fallback product data also failed to load', err);
        return {};
      })
      .then(normalizeCatalog);
  }

  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(API_BASE + '/api/catalog', { headers: { Accept: 'application/json' } })
        .then((res) => {
          if (!res.ok) throw new Error('Backend returned ' + res.status);
          return res.json();
        })
        .then(normalizeCatalog)
        .catch((err) => {
          // The store must keep working even if the backend is briefly down,
          // sleeping (Render free tier), or not yet updated with the new
          // /api/catalog route — fall back to the last-published static copy.
          console.warn('Vivy: backend catalog unavailable, using bundled data/products.json fallback', err);
          return loadStaticFallback();
        });
    }
    return dataPromise;
  }

  async function getAll() {
    const data = await loadData();
    return data.products || [];
  }

  async function getFreeResources() {
    const data = await loadData();
    const listed = data.freeResources || [];
    const zeroPriceProducts = (data.products || []).filter((p) => isFree(p));
    const seen = new Set(listed.map((p) => p.slug));
    const merged = listed.concat(zeroPriceProducts.filter((p) => !seen.has(p.slug)));
    return merged;
  }

  async function getBundles() {
    const data = await loadData();
    return data.bundles || [];
  }

  async function getCategories() {
    const data = await loadData();
    return data.categories || [];
  }

  async function getAllSellable() {
    const [products, free] = await Promise.all([getAll(), getFreeResources()]);
    return products.concat(free);
  }

  async function getBySlug(slug) {
    const all = await getAllSellable();
    return all.find((p) => p.slug === slug) || null;
  }

  async function getFeatured() {
    const all = await getAll();
    return all.filter((p) => p.featured);
  }

  async function getBestSellers() {
    const all = await getAll();
    return all.filter((p) => p.bestSeller);
  }

  async function getNewProducts() {
    const all = await getAll();
    return all.filter((p) => p.newProduct);
  }

  async function getByCategory(categoryId) {
    const all = await getAll();
    return all.filter((p) => p.category === categoryId);
  }

  async function getCategoryMeta(categoryId) {
    const cats = await getCategories();
    return cats.find((c) => c.id === categoryId) || null;
  }

  async function getRelated(product, limit) {
    limit = limit || 4;
    const all = await getAll();
    const sameCategory = all.filter((p) => p.category === product.category && p.slug !== product.slug);
    if (sameCategory.length >= limit) return sameCategory.slice(0, limit);
    const rest = all.filter((p) => p.category !== product.category && p.slug !== product.slug);
    return sameCategory.concat(rest).slice(0, limit);
  }

  function formatMoney(amount, currency) {
    currency = currency || 'USD';
    const symbols = { USD: '$', NGN: '\u20a6', GBP: '\u00a3', EUR: '\u20ac' };
    const symbol = symbols[currency] || currency + ' ';
    if (amount === 0) return 'Free';
    return symbol + Number(amount).toFixed(amount % 1 === 0 ? 0 : 2);
  }

  function starsSvg(rating, size) {
    size = size || 14;
    const full = Math.round(rating);
    let out = '';
    for (let i = 1; i <= 5; i++) {
      out += `<svg class="icon" width="${size}" height="${size}"><use href="assets/icons/sprite.svg#${i <= full ? 'icon-star' : 'icon-star-outline'}"></use></svg>`;
    }
    return out;
  }

  function categoryName(categoryId, categories) {
    const cat = categories.find((c) => c.id === categoryId);
    return cat ? cat.name : categoryId;
  }

  function badgesHtml(product) {
    const badges = [];
    if (isFree(product)) badges.push('<span class="badge badge-free">Free</span>');
    if (product.salePrice != null && product.salePrice < product.price) {
      const pct = Math.round((1 - product.salePrice / product.price) * 100);
      badges.push(`<span class="badge badge-sale">-${pct}%</span>`);
    }
    if (product.bestSeller) badges.push('<span class="badge badge-best">Best Seller</span>');
    if (product.newProduct) badges.push('<span class="badge badge-new">New</span>');
    return badges.join('');
  }

  function priceHtml(product) {
    if (isFree(product)) {
      return '<span class="price-free">Free</span>';
    }
    if (product.salePrice != null && product.salePrice < product.price) {
      return `<span class="price-group"><span class="price-current">${formatMoney(product.salePrice, product.currency)}</span><span class="price-original">${formatMoney(product.price, product.currency)}</span></span>`;
    }
    return `<span class="price-group"><span class="price-current">${formatMoney(product.price, product.currency)}</span></span>`;
  }

  function productCardHtml(product, categories) {
    categories = categories || [];
    const catName = categoryName(product.category, categories);
    const img = product.image || 'assets/images/gallery-placeholder-1.svg';
    return `
    <article class="product-card">
      <a class="product-card-link" href="product.html?slug=${encodeURIComponent(product.slug)}" aria-label="View ${escapeHtml(product.name)}"></a>
      <div class="product-media">
        <div class="product-badges">${badgesHtml(product)}</div>
        <img src="${img}" alt="${escapeHtml(product.name)} cover image" loading="lazy" width="600" height="600" onerror="this.src='assets/images/gallery-placeholder-1.svg'">
      </div>
      <div class="product-body">
        <span class="product-cat">${escapeHtml(catName)}</span>
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <p class="product-desc">${escapeHtml(product.shortDescription)}</p>
        <div class="product-rating">${starsSvg(product.rating, 13)}<span>${product.rating} (${product.reviewCount})</span></div>
        <div class="product-price-row">${priceHtml(product)}</div>
        <a class="btn btn-outline btn-sm btn-block product-view-btn" href="product.html?slug=${encodeURIComponent(product.slug)}">View Product</a>
      </div>
    </article>`;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function emptyStateHtml(opts) {
    opts = opts || {};
    const icon = opts.icon || 'icon-search';
    const title = opts.title || 'No products found';
    const desc = opts.desc || "Try a different search term or clear your filters.";
    const actionHtml = opts.actionHtml || '';
    return `
    <div class="empty-state fade-in">
      <div class="icon-wrap"><svg class="icon" width="36" height="36"><use href="assets/icons/sprite.svg#${icon}"></use></svg></div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(desc)}</p>
      ${actionHtml}
    </div>`;
  }

  /**
   * Explicit, type-safe "is this product free?" check — never relies on
   * JS truthiness (price 0 is falsy but must still count as free; price
   * strings like "0.00" must also count as free).
   */
  function isFree(product) {
    if (!product) return false;
    const raw = product.salePrice != null ? product.salePrice : product.price;
    const n = typeof raw === 'string' ? parseFloat(raw) : raw;
    return typeof n === 'number' && !isNaN(n) && n <= 0;
  }

  return {
    apiBase: API_BASE,
    getAll, getAllSellable, getFreeResources, getBundles, getCategories, getBySlug,
    getFeatured, getBestSellers, getNewProducts, getByCategory, getCategoryMeta, getRelated,
    formatMoney, starsSvg, categoryName, badgesHtml, priceHtml, productCardHtml, escapeHtml, emptyStateHtml,
    isFree,
  };
})();
