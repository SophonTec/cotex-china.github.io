// Import the approved V2 artwork without regeneration, mirroring or retouching.
// Requires unzip and cwebp. Originals remain untouched; alpha is preserved.
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const document = process.argv[2];
if (!document)
  throw new Error("Usage: node scripts/prepare-v2-assets.mjs <V2.docx>");
const temp = mkdtempSync(join(tmpdir(), "cotex-v2-art-"));
execFileSync("unzip", [
  "-j",
  "-q",
  resolve(document),
  "word/media/*",
  "-d",
  temp,
]);
const output = "assets/images/home-v2";
mkdirSync(output, { recursive: true });
const mapping = {
  "hero-art": "image6.png",
  "hero-design": "image7.png",
  "hero-generation": "image8.png",
  "at-a-glance": "image11.png",
  "collection-scarf": "image16.png",
  "collection-underwear": "image17.png",
  "collection-women": "image18.png",
  "collection-girls": "image19.png",
};
const sha256 = (file) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const manifest = {
  document: "CoTeX网站-V2修改.docx",
  documentSHA256: sha256(document),
  assets: [],
};
for (const [stem, filename] of Object.entries(mapping)) {
  const original = join(temp, filename);
  for (const width of [800, 1600]) {
    const file = `${output}/${stem}-${width}.webp`;
    execFileSync("cwebp", [
      "-quiet",
      "-q",
      "86",
      "-m",
      "6",
      "-resize",
      String(width),
      "0",
      original,
      "-o",
      file,
    ]);
    manifest.assets.push({
      source: "word/media/" + filename,
      sourceSHA256: sha256(original),
      file,
      sha256: sha256(file),
    });
  }
}
writeFileSync(
  `${output}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "Imported eight approved V2 images, each at 800px and 1600px, preserving original transparency.",
);
