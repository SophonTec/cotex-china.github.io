# CoTeX China Homepage

Official website for CoTeX Import & Export Co., Ltd.

Website: https://www.cotex-china.com/

## Technology and deployment

The site is a static Bootstrap 3 website hosted by GitHub Pages. GitHub Pages publishes the repository root from the `main` branch and serves the custom domain configured in `CNAME`.

There is no build step. To preview the site locally, run:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/.

## Project structure

- `index.html`: Homepage content and section structure.
- `css/`: Site and third-party stylesheets.
- `js/`: Site and third-party JavaScript.
- `img/`: Images and the company-video poster.
- `media/cotex-video.mp4`: Company history and production-capabilities video.
- `CNAME`: GitHub Pages custom-domain configuration.

## Company video

The responsive video player is in the **About Us** section. It uses:

- MP4 video: `media/cotex-video.mp4`
- Poster image: `img/cotex-video-poster.jpg`
- Browser settings: native controls, metadata preloading, and inline mobile playback

For future replacements, use an H.264/AAC MP4, keep the file below GitHub's 100 MB limit, and preserve the existing filenames to avoid changing the page markup. A 16:9 source is recommended.

To prepare an MP4 for progressive web playback without re-encoding:

```bash
ffmpeg -i input.mp4 -c copy -movflags +faststart media/cotex-video.mp4
```

## Publishing

Changes pushed to `main` are published automatically by GitHub Pages:

```bash
git add index.html css/style.css README.md img/ media/
git commit -m "Describe the website update"
git push origin main
```

After pushing, confirm that the latest GitHub Pages build completed and verify the live site at https://www.cotex-china.com/.
