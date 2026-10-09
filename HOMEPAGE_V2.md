# Homepage V2 — v0.4.2

Requirements: `~/Downloads/CoTeX网站-V2修改.docx`, including its 12 embedded spreadsheet tables and approved artwork. The final layout corrections take precedence over the earlier CTA-position suggestions in the first table. Each section's “do not modify other modules” restriction is applied to that section; the complete document authorizes all four homepage changes.

## Homepage sequence

Header → Editorial Hero → COTEX AT A GLANCE → Our Collections → complete About Us article → Contact Us → footer.

## Preservation contract

- `css/site.css`, `js/site.js` and `site/contact.html` remain unchanged from v0.4.1.
- Header HTML is unchanged. The standalone About Us and product category HTML only changes version metadata, footer version and asset cache keys.
- All approved collection headings, taglines, descriptions and CTA wording remain identical.
- `aboutContent()` in `scripts/build-site.mjs` is the single implementation used by both HOME and `/about/`. Its full HTML is reused, including the original heading hierarchy, images, video, timeline, card layouts, animations and internal IDs. The enclosing homepage article creates no duplicate IDs, header or footer.
- HOME includes one video player, one company-history sequence and one Contact Us section. The former compact About COTEX/Our Global Reach pair is no longer rendered.
- `/about/`, `/about/#story`, legacy route redirects and all category URLs remain available.
- `scripts/test-site.mjs` compares these invariants against Git tag `v0.4.1` and the locked contact section against `4-category`.

## Approved image mapping

Images are extracted from `word/media/` inside the V2 DOCX and converted to 800px/1600px WebP. `assets/images/home-v2/manifest.json` records source-document, original-image and output SHA-256 hashes. No AI generation, mirroring, retouching or composited text is applied. The supplied transparency in image7 is preserved.

| DOCX image | Filename stem | Placement |
| --- | --- | --- |
| image6.png | hero-art | Banner 1: flowing silk, left typography |
| image7.png | hero-design | Banner 2: design process, right typography |
| image8.png | hero-generation | Banner 3: mother/daughter, centered lower typography |
| image11.png | at-a-glance | Overview: neutral center, fabric edges |
| image16.png | collection-scarf | Product right, text left |
| image17.png | collection-underwear | Product left, text right |
| image18.png | collection-women | Corrected product right, text left |
| image19.png | collection-girls | Corrected product left, text right |

The hero uses editable HTML headings and links. Responsive framing and soft CSS gradients keep titles legible without covering the mother/daughter faces or their joined hands. The second banner uses the source's transparent edges and a soft fade to balance the design process on the left with typography on the right; there are no hard split panels.

Collection backdrops cover the entire browser content width (`width: 100%`, not overflow-prone `100vw`) with `background-size: cover`. A separate centered 1280px safe content region contains text, without a separate image panel. On phones the product picture sits above the text, using a continuous warm neutral tone and a small soft edge blend.

## Typography

- Bodoni Moda Regular: editorial serif titles.
- Bodoni Moda Italic: collection taglines.
- DM Sans Regular/Medium: labels, descriptions and CTAs.
- Great Vibes: the shared artistic calligraphy family, restricted to hero emphasis.

Latin WOFF2 files are self-hosted under `assets/fonts/`, with three included SIL Open Font License files. Font source URLs are pinned in `scripts/prepare-home-fonts.mjs`. These font families are applied only inside the three new homepage sections, never globally to the pre-existing company or catalog pages.

## Responsive and interaction checks

`scripts/test-browser.mjs` checks real Firefox browsing contexts at 320, 360, 390, 768, 1024, 1440 and 1920 CSS pixels. V2 checks include exact full-bleed collection edges, zero inter-section gaps, alternating text positions, overview/collection heights, local fonts and hero text boundaries. Existing carousel, mobile navigation, swipe handler, lightbox, video, reduced-motion, no-JavaScript and legacy URL checks are retained.

The corporate content has its own original heading hierarchy inside the homepage article. It is not rewritten to make its visual structure resemble the new editorial sections. Any future company-content update should be made in the shared builder/content data, not independently in generated HOME and About HTML.
