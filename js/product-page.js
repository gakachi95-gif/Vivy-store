/**
 * VIVY — product-page.js
 * Reads ?slug= from the URL, loads that product from products.json and
 * renders the entire product page. If the slug doesn't match any product,
 * a "Product Not Found" state is shown instead.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const root = document.getElementById('product-root');
  const notFoundEl = document.getElementById('product-not-found');

  if (!slug) {
    showNotFound();
    return;
  }

  const [product, categories] = await Promise.all([Vivy.getBySlug(slug), Vivy.getCategories()]);

  if (!product) {
    showNotFound();
    return;
  }

  renderProduct(product, categories);

  function showNotFound() {
    if (root) root.style.display = 'none';
    if (notFoundEl) notFoundEl.style.display = 'block';
    document.title = 'Product Not Found | Vivy';
  }
});

function renderProduct(product, categories) {
  const root = document.getElementById('product-root');
  const notFoundEl = document.getElementById('product-not-found');
  if (notFoundEl) notFoundEl.style.display = 'none';
  if (root) root.style.display = 'block';

  const currentUrl = window.location.origin + window.location.pathname + '?slug=' + encodeURIComponent(product.slug);
  const catName = Vivy.categoryName(product.category, categories);

  /* ---- Document head: title/meta/OG (see README for GitHub Pages OG limitations) ---- */
  document.title = product.seoTitle || `${product.name} | Vivy`;
  setMeta('description', product.seoDescription || product.shortDescription);
  setMeta('og:title', product.seoTitle || product.name, true);
  setMeta('og:description', product.seoDescription || product.shortDescription, true);
  setMeta('og:image', window.location.origin + '/' + product.image, true);
  setMeta('og:url', currentUrl, true);
  setMeta('og:type', 'product', true);
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', product.seoTitle || product.name);
  setMeta('twitter:description', product.seoDescription || product.shortDescription);
  setMeta('twitter:image', window.location.origin + '/' + product.image);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', currentUrl);

  /* ---- Structured data (JSON-LD) ---- */
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.shortDescription,
    image: window.location.origin + '/' + product.image,
    brand: { '@type': 'Brand', name: 'Vivy' },
    offers: {
      '@type': 'Offer',
      url: currentUrl,
      priceCurrency: product.currency,
      price: product.salePrice != null ? product.salePrice : product.price,
      availability: 'https://schema.org/InStock',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
    },
  });
  document.head.appendChild(ld);

  /* ---- Breadcrumb ---- */
  const breadcrumb = document.getElementById('product-breadcrumb');
  if (breadcrumb) {
    breadcrumb.innerHTML = `
      <a href="index.html">Home</a><span class="sep">/</span>
      <a href="store.html">Store</a><span class="sep">/</span>
      <a href="categories.html?category=${encodeURIComponent(product.category)}">${Vivy.escapeHtml(catName)}</a><span class="sep">/</span>
      <span class="current">${Vivy.escapeHtml(product.name)}</span>`;
  }

  /* ---- Gallery ---- */
  const gallery = product.gallery && product.gallery.length ? product.gallery : [product.image];
  const galleryMain = document.getElementById('gallery-main-img');
  const galleryThumbs = document.getElementById('gallery-thumbs');
  if (galleryMain) {
    galleryMain.src = gallery[0];
    galleryMain.alt = product.name + ' — cover image';
  }
  if (galleryThumbs) {
    galleryThumbs.innerHTML = gallery
      .map(
        (src, i) => `<button type="button" class="${i === 0 ? 'is-active' : ''}" data-thumb="${i}" aria-label="Show image ${i + 1}">
        <img src="${src}" alt="" loading="lazy"></button>`
      )
      .join('');
    galleryThumbs.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.thumb);
        galleryMain.src = gallery[i];
        galleryThumbs.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
      });
    });
  }

  /* ---- Info column ---- */
  setText('product-category', catName);
  setText('product-name', product.name);
  setHtml('product-rating-stars', Vivy.starsSvg(product.rating, 17));
  setText('product-rating-num', product.rating);
  setText('product-review-count', `(${product.reviewCount} reviews)`);
  setText('product-lede', product.description);

  const priceBlock = document.getElementById('product-price-block');
  if (priceBlock) {
    if (Vivy.isFree(product)) {
      priceBlock.innerHTML = `<div class="price-ticket"><span class="price-free" style="font-size:1.6rem;">Free</span></div>`;
    } else if (product.salePrice != null && product.salePrice < product.price) {
      const pct = Math.round((1 - product.salePrice / product.price) * 100);
      priceBlock.innerHTML = `<div class="price-ticket">
        <span class="price-current">${Vivy.formatMoney(product.salePrice, product.currency)}</span>
        <span class="price-original">${Vivy.formatMoney(product.price, product.currency)}</span>
        <span class="discount">Save ${pct}%</span>
      </div>`;
    } else {
      priceBlock.innerHTML = `<div class="price-ticket"><span class="price-current">${Vivy.formatMoney(product.price, product.currency)}</span></div>`;
    }
  }

  /* ---- Mini facts ---- */
  const factsEl = document.getElementById('product-mini-facts');
  if (factsEl) {
    const facts = [
      ['Format', product.format],
      ['Pages / Files', product.pages],
      ['File Size', product.fileSize],
      ['Delivery', 'Instant digital download'],
    ];
    factsEl.innerHTML = facts
      .map(([label, value]) => `<div class="mini-fact"><div class="mf-label">${label}</div><div class="mf-value">${Vivy.escapeHtml(value || '—')}</div></div>`)
      .join('');
  }

  /* ---- CTAs ---- */
  const buyBtn = document.getElementById('product-buy-btn');
  const cartBtn = document.getElementById('product-cart-btn');
  const stickyBar = document.getElementById('sticky-cta');
  const stickyPrice = document.getElementById('sticky-cta-price');
  const stickyBuy = document.getElementById('sticky-cta-buy');

  const priceLabel = Vivy.isFree(product) ? 'Free' : Vivy.formatMoney(product.salePrice != null ? product.salePrice : product.price, product.currency);
  if (stickyPrice) stickyPrice.textContent = priceLabel;

  /*
   * FREE vs PAID are two completely separate flows on purpose (see the
   * $32 bug writeup): a free product must never touch the shopping cart
   * or checkout.html, so there is no shared code path a stale cart item
   * could ever leak into.
   */
  const goFreeDownload = async (btn) => {
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Preparing your download…';
    try {
      const res = await fetch(Vivy.apiBase + '/api/free-download/' + encodeURIComponent(product.slug));
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.downloadUrl) {
        throw new Error(data.message || 'This item is not available as a free download right now.');
      }
      window.location.href = data.downloadUrl;
    } catch (err) {
      btn.textContent = original;
      btn.disabled = false;
      showBuyError(err.message || "Couldn't start your free download. Please try again.");
    }
  };
  const goCheckout = () => {
    VivyCart.addItem(product.slug, 1);
    window.location.href = 'checkout.html?slug=' + encodeURIComponent(product.slug);
  };
  const addToCart = (btn) => {
    VivyCart.addItem(product.slug, 1);
    const original = btn.textContent;
    btn.textContent = 'Added to Cart';
    setTimeout(() => (btn.textContent = original), 1600);
  };
  function showBuyError(message) {
    let el = document.getElementById('product-buy-error');
    if (!el) {
      el = document.createElement('p');
      el.id = 'product-buy-error';
      el.style.cssText = 'color:#a53a29;font-size:0.86rem;margin-top:10px;';
      const row = document.getElementById('product-cta-row');
      if (row) row.insertAdjacentElement('afterend', el);
    }
    el.textContent = message;
  }

  const isFreeProduct = Vivy.isFree(product);

  if (buyBtn) {
    buyBtn.textContent = isFreeProduct ? 'Get Free Resource' : 'Get Instant Access';
    buyBtn.addEventListener('click', () => (isFreeProduct ? goFreeDownload(buyBtn) : goCheckout()));
  }
  if (cartBtn) {
    if (isFreeProduct) {
      cartBtn.style.display = 'none';
    } else {
      cartBtn.addEventListener('click', () => addToCart(cartBtn));
    }
  }
  if (stickyBuy) stickyBuy.addEventListener('click', () => (isFreeProduct ? goFreeDownload(stickyBuy) : goCheckout()));
  if (stickyBar) {
    window.addEventListener('scroll', () => {
      const trigger = document.getElementById('product-cta-row');
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      stickyBar.classList.toggle('is-visible', rect.bottom < 0);
    });
  }

  /* ---- Copy link + share ---- */
  const copyBtn = document.getElementById('copy-link-btn');
  const toast = document.getElementById('copy-toast');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => vivyCopyToClipboard(currentUrl, toast, 'Product link copied!'));
  }
  wireShare('share-whatsapp', `https://wa.me/?text=${encodeURIComponent(product.name + ' — ' + currentUrl)}`);
  wireShare('share-facebook', `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`);
  wireShare('share-x', `https://twitter.com/intent/tweet?text=${encodeURIComponent(product.name)}&url=${encodeURIComponent(currentUrl)}`);
  wireShare('share-telegram', `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(product.name)}`);
  wireShare('share-email', `mailto:?subject=${encodeURIComponent('Check out ' + product.name)}&body=${encodeURIComponent(product.shortDescription + '\n\n' + currentUrl)}`);

  /* ---- What's included ---- */
  setListHtml('included-list', product.whatsIncluded, (item) => `
    <div class="included-item"><svg class="icon" width="20" height="20"><use href="assets/icons/sprite.svg#icon-file"></use></svg><span>${Vivy.escapeHtml(item)}</span></div>`);

  /* ---- Features / What you'll get ---- */
  setListHtml('features-list', product.features, (item) => `
    <div class="feature-item"><span class="fi-icon"><svg class="icon" width="18" height="18"><use href="assets/icons/sprite.svg#icon-check"></use></svg></span><p style="color:var(--color-ink);">${Vivy.escapeHtml(item)}</p></div>`);

  /* ---- Who it's for / requirements ---- */
  setText('product-who-for', product.whoItsFor);
  setText('product-requirements', product.requirements);

  /* ---- FAQ ---- */
  const faqData = buildProductFaq(product);
  setListHtml('product-faq-list', faqData, (item, i) => `
    <div class="faq-item">
      <button class="faq-question" id="pfaq-btn-${i}" aria-expanded="false" aria-controls="pfaq-a-${i}">
        <span>${Vivy.escapeHtml(item.q)}</span>
        <svg class="icon" width="20" height="20"><use href="assets/icons/sprite.svg#icon-plus"></use></svg>
      </button>
      <div class="faq-answer" id="pfaq-a-${i}"><p>${Vivy.escapeHtml(item.a)}</p></div>
    </div>`);
  initFaqAccordions();

  /* ---- Related products ---- */
  Vivy.getRelated(product, 4).then((related) => {
    const relEl = document.getElementById('related-products');
    if (!relEl) return;
    if (!related.length) {
      relEl.closest('.product-section').style.display = 'none';
      return;
    }
    relEl.innerHTML = related.map((p) => Vivy.productCardHtml(p, [])).join('');
    Vivy.getCategories().then((cats) => {
      relEl.innerHTML = related.map((p) => Vivy.productCardHtml(p, cats)).join('');
    });
  });
}

function buildProductFaq(product) {
  return [
    { q: 'How do I receive this product?', a: 'After a successful purchase, digital delivery information will be provided by Vivy\'s checkout and payment system so you can access your files.' },
    { q: `What format is ${product.name} delivered in?`, a: `This product is delivered as: ${product.format}.` },
    { q: 'Can I use this on my phone?', a: 'Yes. Vivy products are designed to be accessible from supported mobile devices as well as desktop.' },
    { q: 'What if I need help after buying?', a: 'You can reach out any time through the Vivy Contact page and we\'ll help you out.' },
    { q: 'Do you offer refunds?', a: 'Please see Vivy\'s Refund Policy for full details on eligibility and how to request one.' },
  ];
}

function wireShare(id, url) {
  const el = document.getElementById(id);
  if (el) el.setAttribute('href', url);
}

function setMeta(name, content, isProperty) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content || '');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || '';
}
function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html || '';
}
function setListHtml(id, items, template) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = items.map(template).join('');
    }
