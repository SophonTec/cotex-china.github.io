// Read-only source import. Requires unzip and ffmpeg; no npm dependencies.
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const doc = process.argv[2];
const source = process.argv[3];
if (!doc || !source)
  throw new Error(
    "Usage: node scripts/prepare-visual-assets.mjs <requirements.docx> <source-assets-directory>",
  );
const temp = mkdtempSync(join(tmpdir(), "cotex-assets-"));
execFileSync("unzip", ["-j", "-q", resolve(doc), "word/media/*", "-d", temp]);
const destination = "assets/images/visual";
mkdirSync(destination, { recursive: true });
const images = {
  "hero-scarf": "image3.png",
  "hero-women": "image5.png",
  "hero-girls": "image7.png",
  "collection-scarf": "image10.png",
  "collection-underwear": "image11.png",
  "collection-women": "image12.png",
  "collection-girls": "image13.png",
  "banner-scarf": "image18.png",
  "banner-underwear": "image19.png",
  "banner-women": "image20.png",
  "banner-girls": "image21.png",
  "factory-story": "image28.png",
  "business-manufacturing": "image30.jpeg",
  "business-development": "image31.png",
  "business-trade": "image32.png",
  "global-markets": "image33.png",
  "development-pattern": "image35.jpeg",
  "development-product": "image36.png",
  "development-digital": "image37.jpeg",
  "development-visual": "image38.png",
};
function convert(input, output, width) {
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-vf",
    `scale='min(${width},iw)':-2`,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    output,
  ]);
}
for (const [name, file] of Object.entries(images)) {
  for (const width of [800, 1600])
    convert(join(temp, file), `${destination}/${name}-${width}.jpg`, width);
}
// These four files differ from the preceding 4-category source delivery.
for (const [number, extension] of [
  [6, "jpg"],
  [8, "jpg"],
  [17, "png"],
  [20, "jpg"],
]) {
  for (const width of [640, 1200]) {
    convert(
      join(
        source,
        "products-women's underwear",
        `underwear-${number}.${extension}`,
      ),
      `assets/images/products/womens-underwear/underwear-${String(number).padStart(2, "0")}-${width}.jpg`,
      width,
    );
  }
}
console.log(
  `Imported ${Object.keys(images).length} visual assets and four updated products. Original media untouched. Temporary extraction: ${temp}`,
);
// Use a clean opening frame, not the previous transition/double-exposure frame.
execFileSync("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-ss",
  "0",
  "-i",
  "assets/video/cotex-company.mp4",
  "-frames:v",
  "1",
  "-vf",
  "scale=1600:-2",
  "-q:v",
  "3",
  "assets/images/site/company-video-poster.jpg",
]);
