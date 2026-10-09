# v0.4.1 visual source inventory

## Source deliveries

- Specification and embedded artwork: `~/Downloads/CoTeX 网站 - 四个categories版本.docx`
- Products, video and logo: `~/Downloads/产品图片&视频&logo/`
- Previous source inventory: `ASSET_INVENTORY.md` (retained as the historical 4-category record)

The original files remain untouched. No newly generated or externally sourced imagery has been added. Embedded layout screenshots are used as design references, not as flattened replacement webpages; headings, buttons, contact details and navigation remain real HTML.

## Embedded Word artwork mapping

The following paths are inside the DOCX ZIP container under `word/media/`. Optimized files are in `assets/images/visual/`, with `-800.jpg` and `-1600.jpg` variants; source dimensions are never enlarged.

| DOCX image | Website filename stem | Use |
| --- | --- | --- |
| image3.png | hero-scarf | Main hero slide |
| image5.png | hero-women | Women's collection hero slide |
| image7.png | hero-girls | Girls' collection hero slide |
| image10.png | collection-scarf | Home scarf collection |
| image11.png | collection-underwear | Home underwear collection |
| image12.png | collection-women | Home women's clothing collection |
| image13.png | collection-girls | Home girls' clothing collection |
| image18.png | banner-scarf | Scarf category banner |
| image19.png | banner-underwear | Underwear category banner |
| image20.png | banner-women | Women's clothing category banner |
| image21.png | banner-girls | Girls' clothing category banner |
| image28.png | factory-story | Supplied JIHONG factory collage |
| image30.jpeg | business-manufacturing | Manufacturing card |
| image31.png | business-development | Development card |
| image32.png | business-trade | International trade card |
| image33.png | global-markets | Global reach diagram |
| image35.jpeg | development-pattern | Pattern and textile design |
| image36.png | development-product | Product development |
| image37.jpeg | development-digital | Digital design tools |
| image38.png | development-visual | Visual content creation |

Business/development artwork is supplied editorial illustration; it is not presented as independently verified documentary photography of COTEX staff. The factory collage is identified as the supplied JIHONG facilities image. Responsive framing is implemented in CSS without mirroring product prints or logos. The map uses a responsive English HTML label over the source's bilingual Yiwu label; the source image itself is unchanged apart from resizing/compression.

## Product reconciliation

SHA-256 comparison against the preceding delivery found 125 identical source files (123 products, one logo, one complete video) and four changed product files. Product totals remain:

- Women's Scarf: 35
- Women's Underwear: 30
- Women's Clothing: 30
- Girls' Clothing: 32
- Total: 127

The changed files and both website sizes are regenerated from the new delivery:

| New source under `products-women's underwear/` | Website stem |
| --- | --- |
| underwear-6.jpg | underwear-06 |
| underwear-8.jpg | underwear-08 |
| underwear-17.png | underwear-17 |
| underwear-20.jpg | underwear-20 |

The prior full-length optimized corporate video and official logo remain valid because their source files are byte-identical. Their paths and the original video duration are preserved. The website does not upload the 249 MB original video to GitHub.

The video poster is refreshed from the actual opening frame at 0 seconds, replacing the previous crossfade frame; no video content is edited.

## Reproduction

`scripts/prepare-visual-assets.mjs` extracts the specified media to a fresh temporary directory, writes optimized JPEGs using FFmpeg and imports the four updated products. `scripts/build-site.mjs` reads actual JPEG sizes when building galleries. Both scripts operate without npm dependencies. See `README.md` for commands.
