// Generates committed, dependency-free HTML. GitHub Pages needs no Node runtime.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  categories,
  slides,
  story,
  development,
  about,
  capabilities,
} from "../site/content.mjs";

const version = readFileSync("VERSION", "utf8").trim();
const contact = readFileSync("site/contact.html", "utf8").replaceAll(
  "{{VERSION}}",
  version,
);
export const escape = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
const imageRoot = "/assets/images/visual/";
const url = (slug) => `/products/${slug}/`;
const routes = ["/", "/about/", ...categories.map((c) => url(c.slug))];
const navItems = [
  ["home", "Home", "/"],
  ["about", "About Us", "/about/"],
  ...categories.map((c) => [c.slug, c.name, url(c.slug)]),
  ["contact", "Contact Us", "/#contact"],
];
const arrow = '<span aria-hidden="true">→</span>';
const cta = (text, href, cls = "") =>
  `<a class="button ${cls}" href="${href}">${escape(text)} ${arrow}</a>`;
function visual(
  name,
  alt = "",
  cls = "",
  eager = false,
  sizes = "(max-width: 700px) 100vw, 60vw",
) {
  const [width, height] = jpegSize(`assets/images/visual/${name}-1600.jpg`);
  return `<img class="${cls}" src="${imageRoot}${name}-1600.jpg" srcset="${imageRoot}${name}-800.jpg 800w, ${imageRoot}${name}-1600.jpg ${width}w" sizes="${sizes}" alt="${escape(alt)}" width="${width}" height="${height}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}
function video() {
  return `<video class="company-video" controls playsinline preload="none" poster="/assets/images/site/company-video-poster.jpg?v=${version}" width="1920" height="1080" aria-label="COTEX corporate film"><source src="/assets/video/cotex-company.mp4" type="video/mp4">Your browser cannot play this video. <a href="/assets/video/cotex-company.mp4">Download the COTEX corporate film</a>.</video>`;
}
function globalMap() {
  // English HTML label covers the bilingual source label without altering the supplied artwork.
  return `<figure class="global-map">${visual("global-markets", "From Yiwu to global markets: the Middle East, North Africa, Southeast Asia, Europe and the Americas.", "", false, "(max-width: 700px) 100vw, 1100px")}<span class="map-origin" aria-hidden="true">YIWU<small>CHINA</small></span></figure>`;
}
function head(title, description, route, body, page, extra = "") {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} | COTEX</title>
  <meta name="description" content="${escape(description)}">
  <meta name="version" content="${version}">
  <meta name="theme-color" content="#fbf9f6">
  <link rel="canonical" href="https://www.cotex-china.com${route}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escape(title)} | COTEX">
  <meta property="og:description" content="${escape(description)}">
  <meta property="og:url" content="https://www.cotex-china.com${route}">
  <meta property="og:image" content="https://www.cotex-china.com/assets/images/visual/hero-scarf-1600.jpg">
  <link rel="icon" href="/favicon.png" type="image/png">
  <link rel="stylesheet" href="/css/site.css?v=${version}">
  <script src="/js/site.js?v=${version}" defer></script>
${extra}
</head>
<body data-page="${page}">
  <a class="skip-link" href="#main-content">Skip to content</a>
  <header class="site-header">
    <div class="container header-inner">
      <a class="brand" href="/" aria-label="COTEX Home"><img src="/assets/images/site/cotex-logo.jpg" alt="CoTeX" width="560" height="396"></a>
      <button class="nav-toggle" type="button" data-nav-toggle aria-controls="site-nav" aria-expanded="false">Menu <span aria-hidden="true">☰</span></button>
      <nav class="site-nav" id="site-nav" data-site-nav aria-label="Main navigation">
        ${navItems.map(([key, name, href]) => `<a href="${href}" data-nav="${key}"${key === page ? ' aria-current="page"' : ""}>${escape(name)}</a>`).join("\n        ")}
      </nav>
    </div>
  </header>
  <main id="main-content">${body}</main>
${contact}
</body>
</html>
`;
}
function home() {
  const hero = `<section class="hero home-hero" data-carousel role="region" aria-roledescription="carousel" aria-label="COTEX stories" tabindex="0">
    ${slides
      .map(
        (
          s,
          i,
        ) => `<article class="hero-slide hero-slide--${i + 1}${i === 0 ? " is-active" : ""}" data-slide aria-roledescription="slide" aria-label="${i + 1} of 3"${i ? ' inert aria-hidden="true"' : ""}>
      <div class="hero-art hero-art--${i + 1}">${homeVisual(s.image, i === 0)}</div>
      <div class="container hero-inner"><div class="hero-copy">
        <${i === 0 ? "h1" : "h2"} class="editorial-title"><span class="title-lead">${escape(s.lead)}</span> <span class="title-script">${escape(s.script)}</span></${i === 0 ? "h1" : "h2"}>
        <p class="hero-subtitle">${escape(s.subtitle)}</p>
        <a class="hero-cta hero-cta--${i + 1}" href="${s.href}"><span>${escape(s.cta)}</span><span class="cta-arrow" aria-hidden="true">${s.arrow}</span></a>
      </div></div>
    </article>`,
      )
      .join("")}
    <div class="carousel-controls" hidden>
      <button type="button" data-carousel-prev aria-label="Previous slide">←</button>
      ${slides.map((s, i) => `<button class="carousel-dot" type="button" data-carousel-dot="${i}" aria-label="Show slide ${i + 1}: ${escape(s.title)}" aria-pressed="${i === 0}"><span></span></button>`).join("")}
      <button type="button" data-carousel-next aria-label="Next slide">→</button>
      <button type="button" data-carousel-pause aria-label="Pause slideshow">Ⅱ</button>
    </div>
    <span class="sr-only" data-carousel-status aria-live="off">Slide 1 of 3</span>
  </section>`;
  const glance = `<section class="at-glance" aria-labelledby="glance-title">
    ${homeBackdrop("at-a-glance", "glance-backdrop")}
    <div class="container glance-inner"><div class="glance-intro" data-reveal>
      <p class="eyebrow">COTEX AT A GLANCE</p><h2 id="glance-title">Built on Experience. Connected to the World.</h2>
      <p>Rooted in Yiwu's textile industry, COTEX combines a family business heritage with product development, manufacturing partnerships and international trade expertise.</p>
    </div><div class="capability-grid">${capabilities.map(([title, description, icon]) => `<article class="capability" data-reveal>${capabilityIcon(icon)}<h3>${title}</h3><p>${description}</p></article>`).join("")}</div>
    <a class="editorial-link glance-cta" href="/about/">Discover COTEX <span aria-hidden="true">→</span></a></div>
  </section>`;
  const collections = `<section class="home-collections" id="collections" aria-labelledby="collections-title">
    <div class="collections-heading"><h2 id="collections-title">Our Collections</h2></div>
    ${categories
      .map(
        (
          c,
          i,
        ) => `<article class="collection home-collection collection--${c.image}${i % 2 ? " collection--reverse" : ""}" data-collection-reveal>
      ${homeBackdrop("collection-" + c.image, "collection-backdrop")}
      <div class="container collection-inner"><div class="collection-copy" data-reveal>
        <p class="eyebrow">0${i + 1} / OUR COLLECTIONS</p><h2>${escape(c.name)}</h2>
        <p class="collection-headline">${escape(c.headline)}</p><p>${escape(c.summary)}</p>
        <a class="editorial-link" href="${url(c.slug)}">Explore Collection <span aria-hidden="true">→</span></a>
      </div></div>
    </article>`,
      )
      .join("")}
  </section>`;
  // The complete original About content is shared, not copied or redesigned.
  // Its heading hierarchy is preserved inside its own article on the homepage.
  const company = `<article class="home-company" aria-label="About COTEX">${aboutContent()}</article>`;
  return head(
    "Textiles & Apparel for Women and Girls",
    "Explore COTEX collections of women’s scarves, underwear, clothing and girls’ clothing. A family-run business with a global vision, based in Yiwu, China.",
    "/",
    hero + glance + collections + company,
    "home",
    `<link rel="preload" href="/assets/fonts/great-vibes-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/bodoni-moda-regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/home-v2.css?v=${version}">
  <script src="/js/home-v2.js?v=${version}" defer></script>`,
  );
}
function homeVisual(name, eager = false) {
  return `<img src="/assets/images/home-v2/${name}-1600.webp" srcset="/assets/images/home-v2/${name}-800.webp 800w, /assets/images/home-v2/${name}-1600.webp 1600w" sizes="100vw" alt="" width="1600" height="900" decoding="async" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}>`;
}
function homeBackdrop(name, className) {
  return `<div class="${className}" aria-hidden="true" style="--background-large:url('/assets/images/home-v2/${name}-1600.webp');--background-small:url('/assets/images/home-v2/${name}-800.webp')"></div>`;
}
function capabilityIcon(name) {
  const paths = {
    design:
      '<path d="m7 24 2-7L23 3l6 6-14 14-8 1Z M20 6l6 6 M5 29h24 M9 17l6 6"/>',
    partnership:
      '<path d="m3 13 6-5 7 2 7-2 6 5-5 11-8 5-8-5-5-11Z M9 8l-6 5 5 5 8-8 8 8 M12 21l8 6 M16 17l8 7"/>',
    trade:
      '<circle cx="16" cy="16" r="13"/><ellipse cx="16" cy="16" rx="6" ry="13"/><path d="M3 16h26 M6 8h20 M6 24h20"/>',
    growth:
      '<path d="M16 29V16 M16 22C7 23 3 17 4 10c8-1 13 4 12 12Z M16 16C15 7 21 3 28 4c1 8-4 13-12 12Z M8 29h16"/>',
  };
  return `<svg class="capability-icon" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}
function aboutContent() {
  const intro = `<section class="film-section container"><div class="section-heading"><p class="eyebrow">ABOUT COTEX</p><h1>A Family-Run Business<br>with a Global Vision</h1><p>Textiles connect people and a better life.</p></div>${video()}<div class="film-intro">${about.map((p) => `<p>${escape(p)}</p>`).join("")}</div></section>`;
  const timeline = `<section class="story-section section-tint" id="story"><div class="container"><div class="section-heading" data-reveal><p class="eyebrow">OUR FAMILY JOURNEY</p><h2>Our Story Since 2005</h2><p>From a textile shop in Yiwu to products for international markets.</p></div><ol class="timeline">${story.map(([year, title, text]) => `<li data-reveal><span class="timeline-year">${year}</span><h3>${escape(title)}</h3><p>${escape(text)}</p></li>`).join("")}</ol><p class="story-note">These milestones trace our family’s business and manufacturing journey, which forms the foundation of COTEX today.</p></div></section>`;
  const business = `<section class="business-section container" id="manufacturing"><div class="section-heading" data-reveal><p class="eyebrow">OUR BUSINESS</p><h2>Built on Manufacturing.<br>Connected Through Trade.</h2></div><div class="business-grid">${[
    [
      "Manufacturing",
      "JIHONG and specialized production partners",
      "manufacturing",
      "We coordinate suitable manufacturing resources, production requirements and quality checks for each product category.",
    ],
    [
      "Development",
      "Design, sampling and product coordination",
      "development",
      "From fabrics and patterns to samples and presentation, we help translate product ideas into coordinated collections.",
    ],
    [
      "International Trade",
      "Order management, export and delivery",
      "trade",
      "We connect international buyers with product selection, order follow-up, export documentation and delivery coordination.",
    ],
  ]
    .map(
      ([name, sub, image, text]) =>
        `<article class="business-card" data-reveal>${visual("business-" + image)}<div><h3>${name}</h3><p class="business-subtitle">${sub}</p><p>${text}</p></div></article>`,
    )
    .join(
      "",
    )}</div><figure class="factory-photo">${visual("factory-story", "JIHONG production workshops and factory building", "", false, "(max-width: 700px) 100vw, 1200px")}<figcaption>JIHONG manufacturing facilities · Yiwu, China</figcaption></figure></section>`;
  const global = `<section class="global-section section-tint"><div class="container"><div class="section-heading" data-reveal><p class="eyebrow">OUR GLOBAL REACH</p><h2>Connecting Global Markets</h2><p>Over the years, our business has expanded across international markets, building long-term relationships with customers in the Middle East, North Africa, Southeast Asia, Europe and the Americas.</p></div>${globalMap()}</div></section>`;
  const develop = `<section class="development-section container" id="development"><div class="section-heading" data-reveal><p class="eyebrow">DEVELOPMENT &amp; INNOVATION</p><h2>From Ideas to Products.</h2><p>At COTEX, product development goes beyond sourcing. Working with our creative team and manufacturing partners, we combine textile knowledge, design capabilities and digital tools to support product development for international markets.</p></div><div class="development-grid">${development.map(([title, text, image], i) => `<article class="development-card" data-reveal>${visual("development-" + image)}<div><span class="eyebrow">0${i + 1}</span><h3>${escape(title)}</h3><p>${escape(text)}</p></div></article>`).join("")}</div></section>`;
  return intro + timeline + business + global + develop;
}
function aboutPage() {
  return head(
    "About Us",
    "Discover COTEX’s family business journey, manufacturing partnerships, development capabilities and international trade in textiles and apparel.",
    "/about/",
    aboutContent(),
    "about",
  );
}
// Read actual JPEG dimensions, including source-limited 500px products.
function jpegSize(file) {
  const b = readFileSync(file);
  for (let p = 2; p < b.length; ) {
    if (b[p] !== 0xff) throw new Error(`Invalid JPEG: ${file}`);
    const marker = b[p + 1],
      length = b.readUInt16BE(p + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker))
      return [b.readUInt16BE(p + 7), b.readUInt16BE(p + 5)];
    p += 2 + length;
  }
  throw new Error(`No JPEG dimensions: ${file}`);
}
function gallery(c) {
  return Array.from({ length: c.count }, (_, i) => {
    const number = String(i + 1).padStart(2, "0");
    const path = `/assets/images/products/${c.slug}/${c.prefix}-${number}`;
    const small = jpegSize(`.${path}-640.jpg`),
      large = jpegSize(`.${path}-1200.jpg`);
    const label = escape(`${c.name} ${number}`);
    const srcset =
      small[0] === large[0]
        ? ""
        : ` srcset="${path}-640.jpg?v=${version} ${small[0]}w, ${path}-1200.jpg?v=${version} ${large[0]}w" sizes="(max-width: 700px) 46vw, (max-width: 1000px) 30vw, 290px"`;
    return `<a class="product-card" href="${path}-1200.jpg?v=${version}" data-lightbox data-full="${path}-1200.jpg?v=${version}" data-caption="${label}" aria-label="View larger image: ${label}"><span class="product-card__image"><img src="${path}-640.jpg?v=${version}"${srcset} alt="${label}" width="${small[0]}" height="${small[1]}" loading="lazy" decoding="async"></span><span class="product-card__caption"><span>${label}</span><span aria-hidden="true">＋</span></span></a>`;
  }).join("\n");
}
function categoryPage(c) {
  const banner = `<section class="category-banner category-banner--${c.image}"><div class="category-art">${visual("banner-" + c.image, "", "", true, "100vw")}</div><div class="container category-banner-inner"><div class="category-copy"><p class="eyebrow">${escape(c.name)}</p><h1>${escape(c.title)}</h1><p>${escape(c.tagline)}</p><a class="button" href="#gallery">Explore ${escape(c.short)} <span aria-hidden="true">↓</span></a></div></div></section>`;
  const body = `<section class="catalog-section container" id="gallery" aria-label="${escape(c.name)} products"><p class="category-intro">${escape(c.description)}</p><div class="product-grid">${gallery(c)}</div><p class="catalog-note">Interested in a collection? <a href="#contact">Get in touch with our team</a>.</p><nav class="collection-links" aria-label="Other collections">${categories
    .filter((other) => c.slug !== other.slug)
    .map(
      (other) =>
        `<a href="${url(other.slug)}">${escape(other.name)} ${arrow}</a>`,
    )
    .join("")}</nav></section>`;
  return head(c.name, c.description, url(c.slug), banner + body, c.slug);
}
function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
write("index.html", home());
write("about/index.html", aboutPage());
for (const c of categories)
  write(`products/${c.slug}/index.html`, categoryPage(c));
for (const [path, destination] of [
  ["manufacturing", "/about/#manufacturing"],
  ["development", "/about/#development"],
  ["contact", "/#contact"],
  ["products", "/#collections"],
]) {
  write(
    `${path}/index.html`,
    `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="version" content="${version}"><meta http-equiv="refresh" content="0;url=${destination}"><link rel="canonical" href="https://www.cotex-china.com${destination}"><meta name="robots" content="noindex"><title>Page moved | COTEX</title></head><body><p>This page has moved. <a href="${destination}">Continue to COTEX</a>.</p></body></html>\n`,
  );
}
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((route) => `  <url><loc>https://www.cotex-china.com${route}</loc></url>`).join("\n")}\n</urlset>\n`,
);
console.log(
  `Built COTEX v${version}: ${routes.length} pages and four legacy redirects.`,
);
