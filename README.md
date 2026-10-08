# CoTeX China Website

Official English-language B2B website for YIWU COTEX IMPORT & EXPORT CO., LTD.

Live site: https://www.cotex-china.com/

## Current release

The **4-category** release is a multi-page static website centered on four product categories:

1. Women's Scarves
2. Women's Underwear
3. Women's Clothing
4. Girls' Clothing

The site is designed for international buyers and company verification. It intentionally has no retail pricing, cart, checkout or payment functionality.

## Technology and deployment

- Static HTML, CSS and vanilla JavaScript
- No build step or package installation
- Hosted with GitHub Pages from the repository root on the main branch
- Custom domain configured by CNAME
- Automatic Pages deployment after a push to main

To preview locally:

~~~bash
python3 -m http.server 8000
~~~

Then open http://localhost:8000/.

## Routes

- / — Homepage and featured products
- /products/ — Product category overview
- /products/womens-scarves/ — 35 product references
- /products/womens-underwear/ — 30 product references
- /products/womens-clothing/ — 30 product references
- /products/girls-clothing/ — 32 product references
- /about/ — Company story, timeline and corporate video
- /manufacturing/ — Manufacturing model, process and facility photos
- /development/ — Product development capabilities
- /contact/ — Company contact entry page with the complete Contact Us footer

## Project structure

- index.html — Homepage
- products/ — Product overview and four category pages
- about/, manufacturing/, development/, contact/ — Company pages
- css/site.css — Current responsive visual system
- js/catalog.js — Product data mapping and gallery rendering
- js/site.js — Navigation and accessible lightbox behavior
- assets/images/products/ — Responsive 640px and 1200px product images
- assets/images/manufacturing/ — Optimized factory images
- assets/images/site/ — Official logo and video poster
- assets/video/cotex-company.mp4 — Complete 1080p corporate video
- ASSET_INVENTORY.md — Source asset inventory, counts, dimensions and paths
- scripts/generate-asset-inventory.sh — Reproducible asset inventory generator
- sitemap.xml, robots.txt — Search-engine discovery

## Product image conventions

Each source product is represented by two optimized JPEG files:

- *-640.jpg for grid thumbnails and smaller screens
- *-1200.jpg for larger screens and the lightbox

The four category counts in js/catalog.js must match the files in assets/images/products/. Product cards use native lazy loading and responsive srcset values.

## Corporate video

The supplied 4K source was preserved outside the repository and converted to a complete 1080p H.264/AAC MP4 suitable for GitHub Pages. The website version is below GitHub's 100 MB per-file limit and uses fast-start metadata for progressive playback.

The player uses:

- assets/video/cotex-company.mp4
- assets/images/site/company-video-poster.jpg
- Native controls, metadata preloading and inline mobile playback

## Contact information

The complete Contact Us information is intentionally repeated in the footer of every page and must remain exact. Preserve:

- Company and office names
- Full Yiwu address
- GPS coordinates
- Baidu Maps URL
- Telephone text and tel: link
- Email text and mailto: link
- “Send an Email” button text

## Source assets

The original materials remain unchanged in:

~~~text
/home/sophon/Downloads/cotex-WEBSITE
~~~

Run the inventory script after any source asset change:

~~~bash
scripts/generate-asset-inventory.sh /home/sophon/Downloads/cotex-WEBSITE > ASSET_INVENTORY.md
~~~

## Publishing

~~~bash
git add .
git commit -m "Describe the website update"
git push origin main
~~~

After pushing, verify the latest GitHub Pages build and check the live HTML, CSS, representative images, video byte-range requests and all internal routes.
