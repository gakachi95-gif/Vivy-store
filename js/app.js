/**
 * VIVY — app.js
 * Shared behavior used on every page: mobile menu, header search overlay,
 * cart count badge, newsletter form, footer year, and small utilities.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initSearchOverlay();
  initCartBadge();
  initNewsletterForms();
  initFooterYear();
  initFaqAccordions();
});

/* ---------------- Mobile menu ---------------- */
function initMobileMenu() {
  const toggle = document.querySelector('[data-mobile-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  const closeBtn = document.querySelector('[data-mobile-close]');
  if (!toggle || !menu) return;

  const open = () => {
    menu.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    const firstLink = menu.querySelector('a');
    if (firstLink) firstLink.focus();
  };
  const close = () => {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    toggle.focus();
  };

  toggle.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) close();
  });
}

/* ---------------- Search overlay ---------------- */
function initSearchOverlay() {
  const openBtns = document.querySelectorAll('[data-search-open]');
  const overlay = document.querySelector('[data-search-overlay]');
  const closeBtn = document.querySelector('[data-search-close]');
  const input = document.querySelector('[data-search-input]');
  const resultsBox = document.querySelector('[data-search-results]');
  if (!overlay || !input || !resultsBox) return;

  const open = () => {
    overlay.classList.add('is-open');
    setTimeout(() => input.focus(), 50);
  };
  const close = () => {
    overlay.classList.remove('is-open');
  };

  openBtns.forEach((btn) => btn.addEventListener('click', open));
  if (closeBtn) closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
    if ((e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k')) && !overlay.classList.contains('is-open')) {
      const activeTag = document.activeElement && document.activeElement.tagName;
      if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        e.preventDefault();
        open();
      }
    }
  });

  let allProducts = [];
  let categories = [];
  Vivy.getAllSellable().then((p) => (allProducts = p));
  Vivy.getCategories().then((c) => (categories = c));

  const runSearch = VivySearch.debounce((query) => {
    if (!query.trim()) {
      resultsBox.innerHTML = '';
      return;
    }
    const matches = VivySearch.search(allProducts, query).slice(0, 8);
    if (!matches.length) {
      resultsBox.innerHTML = Vivy.emptyStateHtml({ title: 'No products found', desc: `We couldn't find anything for "${Vivy.escapeHtml(query)}".` });
      return;
    }
    resultsBox.innerHTML = matches
      .map(
        (p) => `
      <a class="search-result-item" href="product.html?slug=${encodeURIComponent(p.slug)}">
        <img src="${p.image}" alt="" loading="lazy">
        <span>
          <span class="sr-name">${Vivy.escapeHtml(p.name)}</span><br>
          <span class="sr-cat">${Vivy.escapeHtml(Vivy.categoryName(p.category, categories))}</span>
        </span>
        <span class="sr-price">${Vivy.formatMoney(p.salePrice != null ? p.salePrice : p.price, p.currency)}</span>
      </a>`
      )
      .join('');
  }, 180);

  input.addEventListener('input', (e) => runSearch(e.target.value));
}

/* ---------------- Cart badge ---------------- */
function initCartBadge() {
  const badges = document.querySelectorAll('[data-cart-count]');
  const update = () => {
    const count = VivyCart.getCount();
    badges.forEach((b) => {
      b.textContent = count;
      b.style.display = count > 0 ? 'flex' : 'none';
    });
  };
  update();
  document.addEventListener('vivy:cart-updated', update);
  window.addEventListener('storage', (e) => {
    if (e.key === VivyCart.STORAGE_KEY) update();
  });
}

/* ---------------- Newsletter ---------------- */
function initNewsletterForms() {
  document.querySelectorAll('[data-newsletter-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = form.querySelector('input[type="email"]');
      const status = form.parentElement.querySelector('[data-newsletter-status]') || form.querySelector('[data-newsletter-status]');
      if (!emailInput || !emailInput.value) return;
      /*
        NOTE FOR VIVY: This form is frontend-ready but not yet connected to an
        email service. To activate it, connect an email provider that supports
        client-side form submission (e.g. Mailchimp, ConvertKit, Brevo) by
        replacing this handler with that provider's form action/endpoint, or
        by posting to a small serverless function. No secret API keys should
        ever be placed in this file.
      */
      if (status) {
        status.textContent = `Thanks! We'll send updates to ${emailInput.value}.`;
        status.style.color = 'var(--color-teal)';
      }
      form.reset();
    });
  });
}

/* ---------------- Footer year ---------------- */
function initFooterYear() {
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

/* ---------------- FAQ accordions (works for any .faq-item on the page) ---------------- */
function initFaqAccordions() {
  document.querySelectorAll('.faq-item').forEach((item) => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', item.classList.contains('is-open'));
    });
  });
}

/* ---------------- Small shared utility: copy to clipboard with toast ---------------- */
function vivyCopyToClipboard(text, toastEl, message) {
  const showToast = () => {
    if (!toastEl) return;
    toastEl.querySelector('[data-toast-text]').textContent = message || 'Copied!';
    toastEl.classList.add('is-visible');
    clearTimeout(toastEl._hideTimer);
    toastEl._hideTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 2400);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(showToast).catch(() => fallbackCopy(text, showToast));
  } else {
    fallbackCopy(text, showToast);
  }
}

function fallbackCopy(text, cb) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    cb();
  } catch (e) {
    console.warn('Vivy: copy failed', e);
  }
  document.body.removeChild(ta);
}
