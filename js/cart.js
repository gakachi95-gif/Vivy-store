/**
 * VIVY — cart.js
 * A frontend shopping cart persisted in localStorage.
 * Cart items are stored as { slug, quantity }. Full product details are
 * looked up from products.json at render time, so the cart stays in sync
 * even if prices change later.
 */

const VivyCart = (function () {
  const STORAGE_KEY = 'vivy_cart_v1';

  function read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Vivy: could not read cart from localStorage', e);
      return [];
    }
  }

  function write(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Vivy: could not save cart to localStorage', e);
    }
    document.dispatchEvent(new CustomEvent('vivy:cart-updated', { detail: { items } }));
  }

  function getItems() {
    return read();
  }

  function addItem(slug, quantity) {
    quantity = quantity || 1;
    const items = read();
    const existing = items.find((i) => i.slug === slug);
    if (existing) {
      existing.quantity += quantity;
    } else {
      items.push({ slug, quantity });
    }
    write(items);
    return items;
  }

  function removeItem(slug) {
    const items = read().filter((i) => i.slug !== slug);
    write(items);
    return items;
  }

  function setQuantity(slug, quantity) {
    let items = read();
    if (quantity <= 0) {
      items = items.filter((i) => i.slug !== slug);
    } else {
      const existing = items.find((i) => i.slug === slug);
      if (existing) existing.quantity = quantity;
    }
    write(items);
    return items;
  }

  function clear() {
    write([]);
  }

  function getCount() {
    return read().reduce((sum, i) => sum + i.quantity, 0);
  }

  async function getDetailedItems() {
    const items = read();
    if (!items.length) return [];
    const all = await Vivy.getAllSellable();
    return items
      .map((i) => {
        const product = all.find((p) => p.slug === i.slug);
        if (!product) return null;
        const unitPrice = product.salePrice != null ? product.salePrice : product.price;
        return { product, quantity: i.quantity, unitPrice, lineTotal: unitPrice * i.quantity };
      })
      .filter(Boolean);
  }

  async function getSubtotal() {
    const detailed = await getDetailedItems();
    return detailed.reduce((sum, i) => sum + i.lineTotal, 0);
  }

  return { getItems, addItem, removeItem, setQuantity, clear, getCount, getDetailedItems, getSubtotal, STORAGE_KEY };
})();
