// Self-hosted Latin WOFF2 fonts from Google Fonts; licenses travel with the fonts.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const dir = "assets/fonts";
mkdirSync(dir, { recursive: true });
const files = {
  "bodoni-moda-regular.woff2":
    "https://fonts.gstatic.com/s/bodonimoda/v28/aFT67PxzY382XsXX63LUYL6GYFcan6NJrKp-VPjfJMShrpsGFUt8oU7a8Id4tA.woff2",
  "bodoni-moda-italic.woff2":
    "https://fonts.gstatic.com/s/bodonimoda/v28/aFT07PxzY382XsXX63LUYJSPUqb0pL6OQqxrZLnVbvZedvJtj-V7tIaZKMNItnDI.woff2",
  "dm-sans-latin.woff2":
    "https://fonts.gstatic.com/s/dmsans/v17/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K4.woff2",
  "great-vibes-latin.woff2":
    "https://fonts.gstatic.com/s/greatvibes/v21/RWmMoKWR9v4ksMfaWd_JN9XFiaQ.woff2",
  "Bodoni-Moda-OFL.txt":
    "https://raw.githubusercontent.com/google/fonts/main/ofl/bodonimoda/OFL.txt",
  "DM-Sans-OFL.txt":
    "https://raw.githubusercontent.com/google/fonts/main/ofl/dmsans/OFL.txt",
  "Great-Vibes-OFL.txt":
    "https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/OFL.txt",
};
for (const [name, url] of Object.entries(files)) {
  execFileSync("curl", [
    "-fLsS",
    "--retry",
    "2",
    "--max-time",
    "30",
    url,
    "-o",
    `${dir}/${name}`,
  ]);
  if (name.endsWith(".txt")) {
    // Normalize whitespace only; preserve the complete upstream license text.
    const license = readFileSync(`${dir}/${name}`, "utf8")
      .replace(/\r\n/g, "\n")
      .replace(/[\t ]+$/gm, "");
    writeFileSync(`${dir}/${name}`, license);
  }
}
console.log(
  "Downloaded four local WOFF2 files and their three SIL Open Font Licenses.",
);
