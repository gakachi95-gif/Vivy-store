/**
 * VIVY — products.js
 * Central data layer. Every page loads data/products.json through this file.
 * Adding a product to data/products.json automatically makes it available
 * everywhere: home, store, categories, bundles, search and its own product page.
 */

const Vivy = (function () {
  const DATA_URL = 'data/products.json';
  let dataPromise = null;

  function loadData() {
    if (!dataPromise) {
      dataPromise = fetch(DATA_URL)
        .then((res) => {
          if (!res.ok) throw new Error('Could not load product data (' + res.status + ')');
          return res.json();
        })
        .catch((err) => {
          console.error('Vivy: failed to load products.json', err);
          return { categories: [], products: [], freeResources: [], bundles: [] };
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
    return data.freeResources || [];
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
    const symbol = currency === 'USD' ? '$' : currency + ' ';
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
    if (product.price === 0) badges.push('<span class="badge badge-free">Free</span>');
    if (product.salePrice != null && product.salePrice < product.price) {
      const pct = Math.round((1 - product.salePrice / product.price) * 100);
      badges.push(`<span class="badge badge-sale">-${pct}%</span>`);
    }
    if (product.bestSeller) badges.push('<span class="badge badge-best">Best Seller</span>');
    if (product.newProduct) badges.push('<span class="badge badge-new">New</span>');
    return badges.join('');
  }

  function priceHtml(product) {
    if (product.price === 0) {
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

  return {
    getAll, getAllSellable, getFreeResources, getBundles, getCategories, getBySlug,
    getFeatured, getBestSellers, getNewProducts, getByCategory, getCategoryMeta, getRelated,
    formatMoney, starsSvg, categoryName, badgesHtml, priceHtml, productCardHtml, escapeHtml, emptyStateHtml,
  };
})();
