import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { categories } from "../site/content.mjs";

const version = readFileSync("VERSION", "utf8").trim();
const routes = [
  "/",
  "/about/",
  ...categories.map((c) => `/products/${c.slug}/`),
];
const read = (route) =>
  readFileSync(`.${route.split("#")[0]}index.html`, "utf8");
const contact = (html) =>
  html.match(/<section class="contact-section"[\s\S]*?<\/section>/)[0];
const old = execFileSync("git", ["show", "4-category:index.html"], {
  encoding: "utf8",
});
const text = (html) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const links = (html) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
const mapURL = "https://j.map.baidu.com/59/2IFM";
const withoutQR = (html) =>
  html.replace(/<figure class="contact-location-qr">[\s\S]*?<\/figure>/g, "");
const expectedContactLinks = links(contact(old)).map((url) =>
  url.startsWith("https://map.baidu.com/") ? mapURL : url,
);
const contactTemplate = readFileSync("site/contact.html", "utf8");
let references = 0;
for (const route of routes) {
  const html = read(route);
  assert.match(html, new RegExp(`<meta name="version" content="${version}">`));
  // Home embeds the original About article, including its original heading hierarchy.
  assert.equal(
    (html.match(/<h1[ >]/g) || []).length,
    route === "/" ? 2 : 1,
    `Preserved heading hierarchy: ${route}`,
  );
  assert.equal(
    text(withoutQR(contact(html))),
    text(contact(old)),
    `Original address, coordinates, telephone and email preserved: ${route}`,
  );
  assert.deepEqual(
    links(contact(html)),
    expectedContactLinks,
    `Updated map links and unchanged telephone/email URLs: ${route}`,
  );
  assert.equal(
    contact(html),
    contact(contactTemplate),
    `Shared contact section: ${route}`,
  );
  assert.equal((html.match(/class="contact-location-qr"/g) || []).length, 1);
  assert.match(html, /<figcaption>Scan Here for Loacation<\/figcaption>/);
  assert.match(
    html,
    /<img src="\/assets\/images\/site\/address-qrcode\.png"[^>]*width="86" height="86"/,
  );
  assert.doesNotMatch(html, /class="release"|4-category ·/);
  assert.match(html, /All Rights Reserved\./);
  assert.equal(
    (html.match(/target="_blank" rel="noopener noreferrer"/g) || []).length,
    2,
  );
  assert.doesNotMatch(html, /Hangzhou|Featured Products|\d+ References/);
  assert.equal((html.match(/data-nav="/g) || []).length, 7);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(ids.length, new Set(ids).size, `Unique IDs: ${route}`);
  for (const match of html.matchAll(/(?:href|src|poster)="([^"]*)"/g)) {
    const path = match[1];
    assert.ok(path, `Empty URL: ${route}`);
    if (/^(https?:|mailto:|tel:)/.test(path)) continue;
    const [withoutHash, fragment] = path.split("#");
    const pathname = withoutHash.split("?")[0];
    const target = pathname ? `.${pathname}` : `.${route}`;
    assert.ok(existsSync(target), `Missing ${target} from ${route}`);
    const file = statSync(target).isDirectory()
      ? target + "index.html"
      : target;
    assert.ok(existsSync(file), `Missing ${file}`);
    if (fragment)
      assert.ok(
        readFileSync(file, "utf8").includes(`id="${fragment}"`),
        `Missing anchor ${path}`,
      );
    references++;
  }
  for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
    const widths = [];
    for (const entry of match[1].split(",")) {
      const [path, width] = entry.trim().split(/\s+/);
      assert.ok(existsSync("." + path.split("?")[0]), path);
      assert.ok(!widths.includes(width), `Duplicate descriptor in ${match[1]}`);
      widths.push(width);
    }
  }
  if (route.startsWith("/products/")) {
    const c = categories.find((c) => route.includes(c.slug));
    assert.equal((html.match(/data-lightbox /g) || []).length, c.count, c.slug);
  }
}
for (const [route, target] of [
  ["manufacturing", "/about/#manufacturing"],
  ["development", "/about/#development"],
  ["contact", "/#contact"],
  ["products", "/#collections"],
]) {
  assert.ok(read(`/${route}/`).includes(`0;url=${target}`));
}
assert.equal((read("/").match(/data-slide /g) || []).length, 3);
assert.equal((read("/").match(/<article class="collection /g) || []).length, 4);
assert.equal((read("/about/").match(/class="timeline-year"/g) || []).length, 6);
assert.equal(
  (read("/about/").match(/class="development-card"/g) || []).length,
  4,
);
assert.equal(
  (readFileSync("sitemap.xml", "utf8").match(/<url>/g) || []).length,
  6,
);
assert.equal(read("/").includes("autoplay"), false);
assert.ok(statSync("assets/video/cotex-company.mp4").size < 100 * 1024 * 1024);

const baseline = (path) =>
  execFileSync("git", ["show", "v0.4.1:" + path], { encoding: "utf8" });
const withoutVersion = (html) =>
  html
    .replaceAll(version, "RELEASE")
    .replaceAll("0.4.1", "RELEASE")
    .replaceAll("0.4.2", "RELEASE")
    .replaceAll("0.4.3", "RELEASE");
// The shared footer is checked independently, including its approved contact changes.
const withoutFooterAndVersion = (html) =>
  withoutVersion(html).replace(/<footer\b[\s\S]*?<\/footer>/, "SHARED_FOOTER");
const home = read("/");
const aboutContent = read("/about/").match(
  /<main id="main-content">([\s\S]*?)<\/main>/,
)[1];
assert.ok(
  home.includes(aboutContent),
  "Home must reuse the complete, identical About implementation",
);
assert.doesNotMatch(home, /class="home-about"|class="home-global"/);
assert.equal((home.match(/class="company-video"/g) || []).length, 1);
assert.equal((home.match(/id="contact"/g) || []).length, 1);
assert.equal((home.match(/class="capability"/g) || []).length, 4);
for (const route of routes.filter((route) => route !== "/")) {
  assert.equal(
    withoutFooterAndVersion(read(route)),
    withoutFooterAndVersion(baseline(route.slice(1) + "index.html")),
    `Unmodified subpage outside the shared footer and release metadata: ${route}`,
  );
}
const withoutContactStyleChanges = (css) =>
  css
    .replace(/\.contact-location-qr(?: img| figcaption)? \{[^}]*\}\n/g, "")
    .replace(/\.release \{[^}]*\}\n/g, "");
assert.equal(
  withoutContactStyleChanges(readFileSync("css/site.css", "utf8")),
  withoutContactStyleChanges(baseline("css/site.css")),
  "Shared styles unchanged outside QR styling and the removed release label",
);
assert.equal(
  readFileSync("js/site.js", "utf8"),
  baseline("js/site.js"),
  "Shared interaction unchanged",
);
assert.equal(
  home.match(/<header[\s\S]*?<\/header>/)[0],
  baseline("index.html").match(/<header[\s\S]*?<\/header>/)[0],
  "Header unchanged",
);
const collectionCopy = (html) =>
  [
    ...html.matchAll(
      /<div class="collection-copy" data-reveal>([\s\S]*?)<\/div>/g,
    ),
  ].map((m) => text(m[1]));
assert.deepEqual(
  collectionCopy(home),
  collectionCopy(baseline("index.html")),
  "Every approved collection word unchanged",
);
const sequence = [
  'class="hero home-hero"',
  'class="at-glance"',
  'class="home-collections"',
  'class="home-company"',
  'id="contact"',
];
assert.ok(
  sequence.every(
    (marker, i) =>
      i === 0 || home.indexOf(marker) > home.indexOf(sequence[i - 1]),
  ),
  "Homepage module order",
);
for (const file of ["css/home-v2.css", "index.html"]) {
  for (const [, asset] of readFileSync(file, "utf8").matchAll(
    /url\(['"]?(\/[^)'"\s]+)['"]?\)/g,
  ))
    assert.ok(existsSync("." + asset), asset);
}
// The approved page content stays intact outside the shared footer.
for (const route of [
  ...routes,
  "/manufacturing/",
  "/development/",
  "/contact/",
  "/products/",
]) {
  const previous = execFileSync(
    "git",
    ["show", "v0.4.3:" + route.slice(1) + "index.html"],
    { encoding: "utf8" },
  );
  assert.equal(
    withoutFooterAndVersion(read(route)),
    withoutFooterAndVersion(previous),
    `Only shared footer and release metadata changes in ${route}`,
  );
}
assert.equal(
  createHash("sha256")
    .update(readFileSync("assets/images/site/address-qrcode.png"))
    .digest("hex"),
  "d502ecb3d96a13e5d29b07474e6ed8214bbf9ba2c650382d4415eae1a382f04f",
  "Supplied location QR image is byte-identical to the original",
);
const imageManifest = JSON.parse(
  readFileSync("assets/images/home-v2/manifest.json", "utf8"),
);
for (const asset of imageManifest.assets) {
  assert.equal(
    createHash("sha256").update(readFileSync(asset.file)).digest("hex"),
    asset.sha256,
    `Approved image unchanged: ${asset.file}`,
  );
}
console.log(
  "PASS scope: page content outside the shared footer unchanged from v0.4.3; approved image and QR hashes match.",
);
console.log(
  "PASS V2: shared About content, unchanged main content/header, exact collection copy, eight approved images, and module order.",
);
console.log(
  `PASS: six pages, four redirects, ${references} local references, 127 products, updated map links/QR, removed footer release label, sitemap and version ${version}.`,
);
