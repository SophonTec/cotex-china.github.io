# Homepage V2 — v0.4.3

Requirements: `~/Downloads/CoTeX网站-V2修改.docx`, including its 12 embedded spreadsheet tables and approved artwork. The final layout corrections take precedence over the earlier CTA-position suggestions in the first table. Each section's “do not modify other modules” restriction is applied to that section; the complete document authorizes all four homepage changes.

The v0.4.3 follow-up, “COTEX HOME — Our Collections Width & Image Cropping Fix”, supersedes the original shallow collection height limits only. It does not redesign any other module or alter the approved copy, typography, text alignment, CTA styles or image files.

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

## Collection sizing and image fitting — v0.4.3

The previous image containers were already full-width. The excessive crop came from the shallow desktop height cap and the fixed 420px/390px breakpoint overrides, not from the 1280px text safe area.

- Desktop/tablet: `height: auto`, `aspect-ratio: 16 / 9`, and `min-height: clamp(440px, 42vw, 680px)`. The clamp is a **minimum**, not a 680px maximum. A 680px cap at 1920px would still crop roughly 37% of a 16:9 image's height. The final near-16:9 sizing deliberately grows taller to retain the product subjects and negative space.
- `background-size: cover` remains appropriate because the container now closely matches the source proportions. The four originals vary slightly from exact 16:9, so a sub-1% desktop crop remains; there is no stretching, mirroring, image editing or artificial side fill.
- Per-image desktop positioning: scarf right/top, underwear left/center, women's clothing right/center, girls' clothing left/center. Product/text sides remain right/left, left/right, right/left, left/right.
- Below 768px: the existing stacked layout stays in place. Image height is `max(310px, 56.25vw)`, with the text offset and existing bottom blend following that height. Scarf uses `86% center`; underwear and girls use left/center; women's clothing uses right/center. Narrow phones may crop negative space horizontally, while keeping the key products and source image height visible.
- Text still uses the original centered safe area up to 1280px, with unchanged widths, fonts, alignment and CTA styling. No borders, separators, cards, white gaps or outer margins were introduced.

Measured Firefox results (viewport width includes a 12px desktop-style scrollbar in the test frame):

| Viewport | Collection/image area height | Minimum source height retained | Minimum source width retained |
| --- | --- | --- | --- |
| 1280px | 713.25px | 99.67% | 100% |
| 1440px | 803.25px | 99.67% | 100% |
| 1920px | 1073.25px | 99.67% | 100% |
| 390px phone | 310px image, then text | 100% | 68.74% |
| 767px stacked | 431.44px image, then text | 100% | 98.66% |

All four sections were visually compared with source `image16.png` through `image19.png` at 1280px, 1440px, 1920px and 390px. The full desktop compositions are visible, including the scarf's head covering, underwear straps and product grouping, women's collars and folded top, and the girls' outfit and shoes. Mobile prioritizes these products over unused negative space. Automated checks additionally cover 320px, 768px and 1024px, text safe areas, gap-free adjacency and horizontal overflow.

Runtime changes in this patch are confined to collection sizing/positioning rules in `css/home-v2.css`. Generated HTML changes only the version number and asset cache keys; the new cache key ensures visitors request the corrected stylesheet.

## Typography

- Bodoni Moda Regular: editorial serif titles.
- Bodoni Moda Italic: collection taglines.
- DM Sans Regular/Medium: labels, descriptions and CTAs.
- Great Vibes: the shared artistic calligraphy family, restricted to hero emphasis.

Latin WOFF2 files are self-hosted under `assets/fonts/`, with three included SIL Open Font License files. Font source URLs are pinned in `scripts/prepare-home-fonts.mjs`. These font families are applied only inside the three new homepage sections, never globally to the pre-existing company or catalog pages.

## Responsive and interaction checks

`scripts/test-browser.mjs` checks real Firefox browsing contexts at 320, 360, 390, 768, 1024, 1280, 1440 and 1920 CSS pixels. The dedicated collection fitting checks also include 767px, immediately before the stacked-layout breakpoint. V2 checks include exact full-bleed collection edges, zero inter-section gaps, alternating text positions, overview/collection heights, local fonts and hero text boundaries. Collection checks measure the source crop and mobile product bounding areas and save `collection-fitting.json` plus screenshots outside the repository. Existing carousel, mobile navigation, swipe handler, lightbox, video, reduced-motion, no-JavaScript and legacy URL checks are retained.

The corporate content has its own original heading hierarchy inside the homepage article. It is not rewritten to make its visual structure resemble the new editorial sections. Any future company-content update should be made in the shared builder/content data, not independently in generated HOME and About HTML.
