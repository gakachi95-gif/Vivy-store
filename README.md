# Vivy — Digital Products Store

Learn. Apply. Build. Grow.

A complete, static, production-ready frontend for **Vivy**, a single-brand digital products store. Built with plain HTML5, CSS3 and vanilla JavaScript so it can be hosted for free on **GitHub Pages** — no server, no build step, no Node.js required to run the site.

This README is written so you can manage the whole store from an Android phone using GitHub's mobile web editor or the GitHub app.

---

## 1. What's included

```
/
├── index.html              Homepage
├── store.html               All products, search, filters, sorting
├── product.html              Single product page (reads ?slug=... from the URL)
├── categories.html          Category browsing (reads ?category=... from the URL)
├── bundles.html              Bundle offers
├── free-resources.html      Free products
├── cart.html                 Shopping cart (localStorage)
├── checkout.html             Checkout form (frontend only — see Section 6)
├── about.html
├── contact.html
├── faq.html
├── privacy.html
├── terms.html
├── refund-policy.html
├── css/style.css             All styling, driven by CSS variables
├── js/
│   ├── products.js           Loads data/products.json, renders product cards
│   ├── cart.js                localStorage shopping cart logic
│   ├── search.js              Search matching logic
│   ├── product-page.js        Renders the single product page from the URL slug
│   └── app.js                  Shared UI: nav, mobile menu, search overlay, newsletter
├── data/products.json        ⭐ THE FILE YOU EDIT TO ADD/CHANGE PRODUCTS
├── assets/images/            Placeholder product images (SVG) — replace anytime
├── assets/icons/sprite.svg   All UI icons in one SVG file
├── robots.txt
├── sitemap.xml
└── README.md                  This file
```

Every page pulls its content from `data/products.json` at load time using `fetch()`. There is no build step — you edit the JSON, save, and the live site updates.

---

## 2. How to add a new product (from your phone)

1. Open `data/products.json` in GitHub's editor (tap the pencil icon on the file page).
2. Find any existing product object inside the `"products"` array (the block that starts with `{` and ends with `}`).
3. Copy that whole block and paste it right before the closing `]` of the `"products"` array. Add a comma after the previous product's closing `}`.
4. Edit these fields on your new block:

| Field | What to do |
|---|---|
| `id` | Give it the next number, e.g. `"009"` |
| `slug` | A short, lowercase, dash-separated name, e.g. `"instagram-growth-guide"`. This becomes the shareable URL: `product.html?slug=instagram-growth-guide` |
| `name` | Full product name |
| `shortDescription` / `description` | Short card text and full sales-page text |
| `price` | Normal price, a number, e.g. `19` |
| `salePrice` | Discounted price, or `null` if there's no discount |
| `category` | Must match one of the category `id` values listed at the top of `products.json` (e.g. `"ai-automation"`) |
| `image` / `gallery` | Paths to images inside `assets/images/`. Upload a JPG/PNG from your phone with that exact filename, or keep a placeholder for now |
| `featured` | `true` to show it in the homepage "Featured Products" section |
| `bestSeller` | `true` to show a "Best Seller" badge |
| `newProduct` | `true` to show a "New" badge |
| `downloadUrl` / `checkoutUrl` | Leave as the placeholder until a real payment/delivery backend is connected (see Section 6) |
| `seoTitle` / `seoDescription` | Used for the page `<title>` and meta description on that product's page |

5. Save (commit) the file.
6. Add the new product's URL to `sitemap.xml`: copy one `<url>...</url>` block that contains `product.html?slug=`, paste it before `</urlset>`, and change the `slug=` value and `<lastmod>` date.
7. That's it — the product now appears automatically in the store, its category page, search, and has its own working, shareable URL.

**You should not need to touch any HTML file to add a product.**

### Uploading a product image from your phone
- In GitHub's app or mobile site, go to `assets/images/`, tap "Add file → Upload files", and pick a photo from your phone.
- Use a square-ish image (roughly 600×600 or larger) for best results.
- Reference the exact uploaded filename in the product's `image` field in `products.json`.

---

## 3. How every product gets its own shareable URL

Every product page is `product.html`. It reads the `slug` from the page URL's query string (`?slug=...`) using JavaScript, looks that slug up in `data/products.json`, and renders that one product. For example:

```
yourdomain.com/product.html?slug=ai-content-kit
```

loads only the AI Content Creator Kit. If the slug doesn't match any product, the page shows a **"Product Not Found"** message with a button back to the store, instead of a broken page.

This is a single dynamic page, not one HTML file per product — which keeps the project easy to manage while still giving every product a real, permanent, copy-and-paste-able URL. Each product page also has a **Copy Product Link** button (copies the exact current URL) and share buttons for WhatsApp, Facebook, X, Telegram and Email — all of which use that same exact URL, so it's safe to promote individual products on social media.

---

## 4. Deploying to GitHub Pages

1. Push/upload this whole folder to a GitHub repository (public or private, Pages works with both on paid plans; public repos get Pages free).
2. In the repository, go to **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch".
4. Choose your branch (e.g. `main`) and the root folder (`/`).
5. Save. GitHub will give you a URL like `https://yourusername.github.io/your-repo/`.
6. Open that URL — the store should load exactly as tested.

### Connecting a custom domain
1. Buy a domain from any registrar.
2. In your DNS settings, add a `CNAME` record pointing to `yourusername.github.io` (for a subdomain like `store.yourdomain.com`), or `A` records pointing to GitHub Pages' IP addresses (for an apex/root domain — GitHub's Pages documentation lists the current IPs).
3. In **Settings → Pages** in your repo, enter your custom domain in the "Custom domain" field and save. GitHub will create a `CNAME` file in your repo automatically.
4. Wait for DNS to propagate (can take up to 24-48 hours) and enable "Enforce HTTPS" once available.

The site uses relative paths everywhere (`css/style.css`, `data/products.json`, etc.) — no hard-coded `localhost` or domain — so it works the same whether it's hosted at a GitHub Pages subpath or a custom domain. The one place you should update your real domain is the `<link rel="canonical">`/Open Graph URLs and `sitemap.xml`/`robots.txt`, which currently use the placeholder `https://vivy.example.com` — do a find-and-replace for that string once you know your final domain.

### Testing locally before you deploy
Because this site loads `data/products.json` with `fetch()`, opening `index.html` directly from your file system (`file://...`) will **not** work in most browsers — `fetch()` of local files is blocked for security reasons. To test locally on a computer, run a simple local server from the project folder, for example:

```
python3 -m http.server 8000
```

then open `http://localhost:8000`. On GitHub Pages this is a non-issue since the site is served over `https://`.

---

## 5. Important: Open Graph / social preview images on GitHub Pages

Product pages set their `og:title`, `og:description`, `og:image` and `og:url` tags **with JavaScript**, after the page loads, using the data in `products.json`. This works correctly for real users who click a link and view the page in a browser.

**The limitation:** most social platforms (Facebook, WhatsApp, X/Twitter, Telegram, etc.) generate their link-preview cards using a bot that reads the page's raw HTML **without running JavaScript**. Since `product.html` starts as one generic template before JavaScript fills it in, a share-preview bot may show generic Vivy branding instead of that specific product's title/image, even though the link itself correctly opens the right product for a human visitor.

**Practical ways to improve this on a free static host:**
- **Simplest:** keep the generic Vivy preview image/description for all shared links (already configured as a sensible fallback in every page's `<head>`), and rely on the page content itself (which loads correctly) to sell the specific product once someone clicks through.
- **Better, still static:** generate a small, separate static HTML "snapshot" per product (for example during your own local build step, or by hand for key products) with that product's specific meta tags hard-coded, and link to that snapshot from social posts instead of the dynamic `product.html?slug=...` URL. This is more setup but gives every shared product its own accurate preview card.
- **Most robust:** if you later add any backend (see Section 6), have it pre-render or proxy product pages with correct meta tags server-side before a bot requests them. This is the standard solution larger stores use, and is straightforward to add later without changing how customers use the site today.

---

## 6. Payments, security, and digital delivery — please read

This is a **frontend-only** static project, as requested. A few things are true about static sites that this README states plainly rather than pretending otherwise:

- **No secret keys are anywhere in this codebase.** There is nowhere here that could safely hold a payment secret key, and none should ever be added to any `.js` file, since anything in this repository (and anything shipped to a visitor's browser) is publicly visible.
- **Payment is not processed by this site.** The `checkout.html` page collects name, email, country and shows an order summary, and is built so a real payment step can be added — but submitting the form does **not** charge anyone or fake a "payment successful" state. It explains this openly to the person checking out.
- **GitHub Pages cannot securely verify a payment or protect private files.** A static host has no server-side code, so it cannot confirm with a payment provider that money actually changed hands, and it cannot gate a download link behind a real check. Any "protection" implemented purely in frontend JavaScript can be bypassed by anyone who opens their browser's developer tools.

### What you'll need to add later for real sales
1. **A lightweight backend or serverless function** (e.g. a Cloudflare Worker, Netlify/Vercel serverless function, or a small server you run) that holds your payment provider's **secret** key.
2. **Checkout flow:** `checkout.html` collects the customer's non-secret details and the cart contents, then redirects to your payment provider's secure hosted checkout (Flutterwave, Paystack, etc. all support this) with the order amount and a reference ID.
3. **Verification:** after payment, the provider redirects back to your site with a transaction reference. Your backend verifies that reference **server-to-server** with the provider's API using the secret key — never trust a reference that only appears in the URL or in frontend JavaScript.
4. **Delivery:** only after that server-side verification succeeds should your backend email the customer their real download link, or reveal one on a confirmation page.
5. Until step 1-4 exists, `downloadUrl` and `checkoutUrl` in `products.json` are intentionally left as placeholders (`#placeholder-secure-download`, `#placeholder-checkout`) so nothing in this project pretends to deliver a file it can't actually protect.

This same reasoning applies to: **customer accounts** (not built — there's no secure place to store passwords in a static site), **email delivery** (the newsletter and contact forms are frontend-ready but need a connected email/form service — see the comments in `js/app.js` and `contact.html`), and **order verification** (must happen server-side, never in the browser).

---

## 7. Design system

All colors, fonts and spacing are controlled from CSS custom properties at the top of `css/style.css` (`:root { ... }`). To re-theme the whole site, change values like:

```css
--color-primary: #5B4EF4;   /* Vivy Violet — buttons, links, accents */
--color-coral: #FF6B57;     /* secondary accent, sale badges */
--color-amber: #F5A623;     /* best seller badge, highlights */
--color-teal: #14B8A6;      /* success/growth accents */
--color-bg: #F6F6FB;        /* page background */
```

Fonts: **Fraunces** (display/headlines), **Inter** (body text), **JetBrains Mono** (prices, labels, badges) — loaded from Google Fonts in `style.css`.

---

## 8. Accessibility & performance notes

- Semantic HTML throughout (`header`, `nav`, `main`, `footer`, proper heading order).
- Visible keyboard focus states, a "Skip to content" link, `aria-live` regions for dynamic search/filter results, and `aria-expanded`/`aria-current` used where relevant.
- Images use `loading="lazy"` (except above-the-fold hero art) and graceful `onerror` fallbacks.
- No frontend framework or build tooling — just a handful of small, dependency-free JavaScript files, so there is very little to download and parse.
- `prefers-reduced-motion` is respected — animations are disabled for users who request it.

---

## 9. Known, honest limitations (by design)

- Search, filtering and sorting are all client-side, which is fast for a catalog of this size but would need a real search service if the catalog grows very large.
- The cart is per-browser (localStorage), not per-account — there are no accounts.
- Newsletter and contact forms need an external form/email service connected (see inline code comments) — they don't silently pretend to send anything right now beyond a local confirmation message.
- Open Graph previews for individual products are correct for real visitors but may show generic branding in some link-preview bots — see Section 5.
- Product images are placeholder SVG graphics — replace them with real photos/mockups in `assets/images/` whenever you're ready; nothing else needs to change.

---

Built for **Vivy** — a single-brand, single-seller digital products store. Not a marketplace: no seller accounts, no vendor dashboards, no commissions.
