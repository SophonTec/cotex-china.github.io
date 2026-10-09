# CoTeX China Website

Official English-language B2B website for YIWU COTEX IMPORT & EXPORT CO., LTD.

Live site: https://www.cotex-china.com/

## Current release

**v0.4.2 — Homepage V2** implements `CoTeX网站-V2修改.docx` on top of v0.4.1. The previous `v0.4.1`, `4-category` and `Pakistan` Git tags remain unchanged.

- Three distinct editorial hero compositions: left-aligned silk story, right-aligned creative story, and a centered mother/daughter story. Each has a different CTA treatment and subtle animation.
- New COTEX AT A GLANCE overview with four capabilities, supplied fabric artwork, thin dividers and a link to About Us.
- Four full-bleed, gap-free, alternating collections using the corrected approved images, Bodoni Moda and DM Sans. Their English copy remains unchanged.
- The complete About Us implementation is reused on HOME in its existing order, without redesign or summarization. The compact former homepage company/global sections are removed.
- Header, standalone About Us, four product category pages and all 127 products retain their approved content and presentation. Generated subpages only change release metadata/cache keys.
- Contact Us text, address, GPS coordinates, map URLs, telephone and email preserved exactly.
- Responsive layout, reduced-motion support, image lightbox, lazy loading and versioned assets.

This is a trade-oriented presentation site, without retail pricing, shopping cart, checkout or payment features. The 2005 history describes the family business origins, not a claim about the legal incorporation date of COTEX.

## Static deployment and local editing

The deployed site is plain HTML, CSS and JavaScript. GitHub Pages serves the repository root on `main`; there is **no server-side runtime, npm installation or build required on GitHub**. `CNAME` retains the existing custom domain.

For consistent maintenance, a dependency-free local generator creates the committed HTML from shared content:

```bash
node scripts/build-site.mjs
node scripts/test-site.mjs
python3 -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000/. Run the generator after changing `site/` or `VERSION`; do not hand-edit generated pages. Node 20+ is sufficient for generation and validation.

## Routes

| Route | Content |
| --- | --- |
| `/` | Editorial carousel, At a Glance, four collections, complete About Us and Contact Us |
| `/about/` | Corporate film, story, manufacturing, markets and development |
| `/products/womens-scarves/` | Women's Scarf: 35 products |
| `/products/womens-underwear/` | Women's Underwear: 30 products |
| `/products/womens-clothing/` | Women's Clothing: 30 products |
| `/products/girls-clothing/` | Girls' Clothing: 32 products |

Navigation links directly to these six pages; Contact Us links to `/#contact`. Legacy URLs remain as small static redirects with a clickable fallback:

- `/manufacturing/` → `/about/#manufacturing`
- `/development/` → `/about/#development`
- `/products/` → `/#collections`
- `/contact/` → `/#contact`

Only the six content pages are included in `sitemap.xml`.

## Project structure

- `VERSION` — release number, used in page metadata, footer and CSS/JS URLs
- `site/content.mjs` — shared category, carousel, company and timeline copy
- `site/contact.html` — locked common Contact Us section
- `scripts/build-site.mjs` — shared layout, static galleries, redirects and sitemap
- `scripts/prepare-visual-assets.mjs` — reproducible import of supplied DOCX artwork and updated products
- `scripts/prepare-v2-assets.mjs` — V2 approved artwork import and source/output SHA-256 manifest
- `scripts/prepare-home-fonts.mjs` — local WOFF2 fonts and their licenses
- `scripts/test-site.mjs` — local reference, content, version and contact regression checks
- `scripts/test-browser.mjs` — real Firefox responsive and interaction checks
- `css/site.css`, `js/site.js` — presentation, navigation, carousel and lightbox
- `css/home-v2.css`, `js/home-v2.js` — isolated V2 home styling and collection image entrance
- `assets/images/home-v2/` — eight approved V2 images, responsive WebP variants and manifest
- `assets/fonts/` — self-hosted Bodoni Moda, DM Sans, Great Vibes and SIL OFL licenses
- `assets/images/visual/` — optimized artwork supplied in the Word document
- `assets/images/products/` — existing responsive product images
- `assets/images/site/` — official logo and actual corporate-video poster
- `assets/video/cotex-company.mp4` — full 58-second 1080p corporate film
- `VISUAL_ASSETS.md` — v0.4.1 source mapping and import notes
- `HOMEPAGE_V2.md` — current layout, asset mapping, typography and preservation rules
- `ASSET_INVENTORY.md` — historical 4-category source inventory
- `CHANGELOG.md` — release history and verification record

## Source materials and media

Originals are read-only and are not included in Git:

```text
/home/sophon/Downloads/CoTeX 网站 - 四个categories版本.docx
/home/sophon/Downloads/CoTeX网站-V2修改.docx
/home/sophon/Downloads/产品图片&视频&logo/
```

To re-import the visual artwork (requires `unzip` and `ffmpeg`):

```bash
node scripts/prepare-visual-assets.mjs \
  '/home/sophon/Downloads/CoTeX 网站 - 四个categories版本.docx' \
  '/home/sophon/Downloads/产品图片&视频&logo'
node scripts/build-site.mjs
```

To re-import V2 artwork (requires `unzip` and `cwebp`) and fonts (requires `curl`):

```bash
node scripts/prepare-v2-assets.mjs '/home/sophon/Downloads/CoTeX网站-V2修改.docx'
node scripts/prepare-home-fonts.mjs
node scripts/build-site.mjs
```

V2 images are resized/compressed only, never regenerated or mirrored. The design banner's transparency is preserved. All fonts are served from this repository; visitors do not need to connect to Google Fonts. The homepage-only stylesheet does not alter shared header, About, category or footer styling.

The source video and logo are byte-identical to the previous delivery, so their optimized website versions are reused. The complete video is H.264/AAC, 1920×1080, 58.048 seconds, 29,914,442 bytes, with fast-start metadata. Native controls support sound, seeking and fullscreen; no autoplay. `preload="none"` avoids downloading the video until the visitor requests playback.

Product galleries are generated as HTML, so images and full-size links also work without JavaScript. The generator reads actual JPEG dimensions for accurate responsive-image descriptors, including low-resolution originals; it does not upscale them. Image enlargement progressively enhances ordinary image links.

## Interaction and accessibility

The hero advances every six seconds with a 0.8-second crossfade. Its distinct image effects are silk drift, a restrained design/color reveal and a gentle light/forward movement. It pauses on mouse hover, keyboard focus, explicit pause, a hidden browser tab or scrolling out of view. Reduced-motion visitors get manual controls with no autoplay or animation. Mobile users can swipe left/right; arrow keys also navigate. Inactive slides are inert and excluded from accessibility navigation.

Collections have a one-time 1.025× to 1× image entrance, a 12px text fade-in and a 5px CTA arrow hover movement. No page-wide parallax is used. The About Us article retains its existing animation, spacing and heading hierarchy; it is not wrapped in another entrance effect. Contact information is rendered once per page.

The lightbox supports previous/next, left/right arrow keys and Escape, and restores focus on close. Contact links remain underlined, and there is still a blank line before GPS Coordinates. Layout and route checks cover small mobile through wide desktop sizes.

## Browser verification

Start the local server above and `geckodriver --port 4444` in another terminal, then:

```bash
node scripts/test-browser.mjs
```

The test requires Firefox and geckodriver, but no npm packages. It uses exact-width browser frames to bypass Firefox's minimum desktop window width. Screenshots are saved outside the repository to `/tmp/cotex-browser-checks/`. Set `SITE_URL` to test another origin; `WEBDRIVER_URL` and `SCREENSHOT_DIR` are also supported.

## Release workflow

1. Update `VERSION` and `CHANGELOG.md`.
2. Run the generator, static tests and browser checks; inspect the screenshots.
3. Review the diff, then commit the generated pages together with their source files.
4. Create an annotated `vX.Y.Z` tag and push the branch and tag.
5. Verify GitHub Pages reports `built` for the exact commit. Check the public HTML version, representative asset hashes, all content routes and video byte-range responses before announcing publication.

For v0.4.2:

```bash
git push --atomic origin main v0.4.2
gh api repos/SophonTec/cotex-china.github.io/pages/builds/latest
curl -I https://www.cotex-china.com/
```

To roll back, prepare and review a new revert commit on `main`, then push it. Do not rewrite shared branch history or move existing release tags.
