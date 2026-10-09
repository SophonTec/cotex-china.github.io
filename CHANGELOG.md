# Changelog

## v0.4.1 — 4-category Visual Refresh — 2026-10-09

- Implemented the supplied four-category Word design, including its embedded layout tables and artwork.
- Added a three-slide, six-second carousel with pause, hover/focus handling, swipe, keyboard navigation and reduced-motion support.
- Replaced the homepage's featured-product/process sections with four alternating collection panels and a compact company/video/global-reach area.
- Added individual category banners, preserved all 127 product images and imported four revised underwear images.
- Consolidated manufacturing, development, family history and global markets under About Us. Preserved the corporate film in full.
- Kept old routes as static redirects and preserved Contact Us copy and every destination URL exactly.
- Added shared source templates, deterministic static generation, accurate image dimensions, version metadata, release footer and regression checks.
- Kept the previous `4-category` and `Pakistan` tags unchanged.

### Verification

- Static checks: six content pages, four legacy redirects, 127 products, local resource/anchor checks, one primary heading per page, exact Contact Us text and URL regression against `4-category`.
- Firefox checks passed at exact 320, 360, 390, 768, 1024 and 1440 CSS-pixel widths: responsive layout, carousel, navigation, image lightbox, contact link underlines and full corporate video playback.
- Additional checks passed for the swipe handler, keyboard navigation, inactive-slide isolation, reduced-motion behavior, all four legacy redirects and no-JavaScript mobile navigation/product galleries. See `scripts/test-browser.mjs` for the reproducible checks.

## 4-category

Original four-category static website redesign. Retained as the pre-refresh Git release tag.

## Pakistan

Earlier corporate website snapshot. Retained as its original Git release tag.
