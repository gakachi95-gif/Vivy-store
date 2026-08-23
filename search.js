/**
 * VIVY — search.js
 * Simple, fast client-side search across product names, categories,
 * descriptions and keywords. No external search library needed.
 */

const VivySearch = (function () {
  function normalize(str) {
    return (str || '').toString().toLowerCase();
  }

  function score(product, terms) {
    const haystacks = [
      { text: normalize(product.name), weight: 5 },
      { text: normalize(product.shortDescription), weight: 2 },
      { text: normalize(product.description), weight: 1 },
      { text: normalize(product.category), weight: 3 },
      { text: normalize((product.features || []).join(' ')), weight: 1 },
      { text: normalize(product.productType), weight: 1 },
    ];
    let total = 0;
    terms.forEach((term) => {
      haystacks.forEach((h) => {
        if (h.text.includes(term)) total += h.weight;
      });
    });
    return total;
  }

  function search(products, query) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return products
      .map((p) => ({ product: p, s: score(p, terms) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.product);
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  return { search, debounce };
})();
