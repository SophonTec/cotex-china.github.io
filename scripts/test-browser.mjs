// Start a static server on 8000 and geckodriver on 4444 before running.
// Uses WebDriver directly, with no npm/browser automation dependencies.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { categories } from "../site/content.mjs";
const server = process.env.SITE_URL || "http://localhost:8000";
const driver = process.env.WEBDRIVER_URL || "http://localhost:4444";
const output = process.env.SCREENSHOT_DIR || "/tmp/cotex-browser-checks";
mkdirSync(output, { recursive: true });
let session;
async function request(path, data, method) {
  const response = await fetch(
    driver + (session ? "/session/" + session : "") + path,
    {
      method: method || (data ? "POST" : "GET"),
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    },
  );
  const json = await response.json();
  if (json.value?.error) throw new Error(JSON.stringify(json.value));
  return json.value;
}
const run = (script, args = []) => request("/execute/sync", { script, args });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const get = (css) => request("/element", { using: "css selector", value: css });
const elementID = (e) => e["element-6066-11e4-a52e-4f735466cecf"];
const click = async (css) =>
  request("/element/" + elementID(await get(css)) + "/click", {});
let frame;
async function viewport(width, route = "/", height = 1000) {
  await request("/frame", { id: null });
  await request("/url", { url: "about:blank" });
  await request("/window/rect", {
    width: Math.max(width + 40, 550),
    height: height + 140,
  });
  // Firefox desktop enforces a minimum outer width. A real browsing context in
  // a fixed-width iframe tests exact 320/360/390 CSS-pixel media queries.
  await run(
    `document.body.style.margin='0';var f=document.createElement('iframe');f.style.cssText='display:block;border:0;width:'+arguments[0]+'px;height:'+arguments[1]+'px';f.src=arguments[2];document.body.append(f);`,
    [width, height, server + route],
  );
  frame = await get("iframe");
  await request("/frame", { id: frame });
  await wait(1050);
  assert.equal(await run("return innerWidth"), width, "Exact viewport");
  await run(
    `window.__errors=[];addEventListener('error',e=>window.__errors.push(e.message));`,
  );
}
async function screenshot(name) {
  await request("/frame", { id: null });
  const base64 = await request("/element/" + elementID(frame) + "/screenshot");
  writeFileSync(`${output}/${name}.png`, Buffer.from(base64, "base64"));
  await request("/frame", { id: frame });
}
async function layout() {
  const result = await run(
    `return {width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,broken:Array.from(document.images).filter(i=>i.complete&&!i.naturalWidth&&i.getAttribute('src')).map(i=>i.src),errors:window.__errors}`,
  );
  assert.ok(result.scroll <= result.width + 1, JSON.stringify(result));
  assert.deepEqual(result.broken, []);
  assert.deepEqual(result.errors, []);
}
async function scrollAll() {
  await run(
    `document.querySelectorAll('img[loading="lazy"]').forEach(i=>i.loading='eager');document.querySelectorAll('[data-reveal]').forEach(e=>e.classList.add('is-visible'));`,
  );
  await wait(300);
  await layout();
}
try {
  const result = await request("/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "firefox",
        "moz:firefoxOptions": {
          args: ["-headless"],
          prefs: { "ui.prefersReducedMotion": 0 },
        },
      },
    },
  });
  session = result.sessionId;
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await viewport(width);
    await scrollAll();
    if ([390, 1440].includes(width)) await screenshot(`home-${width}`);
    for (let i = 0; i < 3; i++) {
      if (i) {
        await click("[data-carousel-next]");
        await wait(850);
      }
      assert.equal(
        await run(
          'return document.querySelectorAll("[data-slide].is-active").length',
        ),
        1,
      );
      const bounds = await run(
        `var r=document.querySelector('.hero').getBoundingClientRect(),c=document.querySelector('.is-active .hero-copy').getBoundingClientRect();return {ok:c.top>=r.top-1&&c.bottom<=r.bottom+1};`,
      );
      assert.ok(bounds.ok, `Slide ${i + 1} fits at ${width}px`);
      if (width === 390 && i) await screenshot(`home-390-slide-${i + 1}`);
    }
    if (width < 1000) {
      await click("[data-nav-toggle]");
      assert.equal(
        await run(
          'return document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded")',
        ),
        "true",
      );
      await click('[data-nav="contact"]');
      assert.equal(
        await run(
          'return document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded")',
        ),
        "false",
      );
      await wait(700);
    }
    await run(
      `document.querySelector('#contact').scrollIntoView({behavior:'instant'});`,
    );
    await wait(100);
    const underline = await run(
      `return [...document.querySelectorAll('.contact-card a:not(.button)')].every(a=>getComputedStyle(a).textDecorationLine.includes('underline'));`,
    );
    assert.ok(underline);
    if (width === 390 || width === 1440) await screenshot(`contact-${width}`);
    await layout();
    console.log(`PASS home and contact ${width}px`);
  }
  for (const route of [
    "/about/",
    ...categories.map((c) => `/products/${c.slug}/`),
  ]) {
    for (const width of [390, 1440]) {
      await viewport(width, route);
      await scrollAll();
      await screenshot(
        `${route.split("/").filter(Boolean).join("-")}-${width}`,
      );
      if (route.startsWith("/products")) {
        const category = categories.find((c) => route.includes(c.slug));
        assert.equal(
          await run(
            'return document.querySelectorAll("[data-lightbox]").length',
          ),
          category.count,
        );
        await click("[data-lightbox]");
        assert.equal(
          await run('return document.querySelector("dialog").open'),
          true,
        );
        await click(".lightbox__next");
        assert.match(
          await run(
            'return document.querySelector(".lightbox__caption").textContent',
          ),
          /2 of/,
        );
        await request("/actions", {
          actions: [
            {
              type: "key",
              id: "keyboard",
              actions: [
                { type: "keyDown", value: "\uE012" },
                { type: "keyUp", value: "\uE012" },
                { type: "keyDown", value: "\uE00C" },
                { type: "keyUp", value: "\uE00C" },
              ],
            },
          ],
        });
        assert.equal(
          await run('return document.querySelector("dialog").open'),
          false,
        );
        assert.equal(
          await run(
            'return document.querySelector(".lightbox img").hasAttribute("src")',
          ),
          false,
        );
      }
      console.log(`PASS ${route} ${width}px`);
    }
  }
  await viewport(1440);
  // Move the pointer out of the carousel and clear focus before checking timing.
  await request("/actions", {
    actions: [
      {
        type: "pointer",
        id: "mouse",
        parameters: { pointerType: "mouse" },
        actions: [{ type: "pointerMove", duration: 0, x: 5, y: 5 }],
      },
    ],
  });
  const before = await run(
    'return document.querySelector("[data-carousel-status]").textContent',
  );
  await wait(6200);
  assert.notEqual(
    await run(
      'return document.querySelector("[data-carousel-status]").textContent',
    ),
    before,
    "Autoplay advances",
  );
  await click("[data-carousel-pause]");
  const paused = await run(
    'return document.querySelector("[data-carousel-status]").textContent',
  );
  await request("/actions", {
    actions: [
      {
        type: "pointer",
        id: "mouse",
        actions: [{ type: "pointerMove", duration: 0, x: 5, y: 5 }],
      },
    ],
  });
  await wait(6200);
  assert.equal(
    await run(
      'return document.querySelector("[data-carousel-status]").textContent',
    ),
    paused,
    "Explicit pause holds",
  );
  await run(
    `var v=document.querySelector('video');v.muted=true;v.play().catch(e=>window.__errors.push(e.message));`,
  );
  await wait(3500);
  const video = await run(
    'var v=document.querySelector("video");return {time:v.currentTime,duration:v.duration,error:v.error?.message,controls:v.controls,autoplay:v.autoplay};',
  );
  assert.ok(video.time > 0, JSON.stringify(video));
  assert.ok(video.duration > 57 && video.duration < 60);
  assert.equal(video.controls, true);
  assert.equal(video.autoplay, false);
  console.log(
    "PASS carousel autoplay/pause and complete corporate video playback",
  );

  // Inspect the lower editorial sections as well as the first screen.
  for (const width of [390, 1440]) {
    await viewport(width);
    await scrollAll();
    for (const selector of [
      ".collection--underwear",
      ".collection--women",
      ".collection--girls",
      ".home-about",
    ]) {
      await run(
        'document.querySelector(arguments[0]).scrollIntoView({behavior:"instant"})',
        [selector],
      );
      await wait(150);
      await screenshot(selector.slice(1) + "-" + width);
    }
    await viewport(width, "/about/");
    await scrollAll();
    for (const selector of [
      ".story-section",
      ".business-section",
      ".global-section",
      ".development-section",
    ]) {
      await run(
        'document.querySelector(arguments[0]).scrollIntoView({behavior:"instant"})',
        [selector],
      );
      await wait(150);
      await screenshot(selector.slice(1) + "-" + width);
      await layout();
    }
  }
  await viewport(390);
  // Exercise the swipe handler with deterministic touch coordinates.
  const swipeBefore = await run(
    'return document.querySelector("[data-carousel-status]").textContent',
  );
  await run(
    `var root=document.querySelector('[data-carousel]');for(var item of [['touchstart','touches',300],['touchend','changedTouches',100]]){var e=new Event(item[0]);Object.defineProperty(e,item[1],{value:[{clientX:item[2],clientY:200}]});root.dispatchEvent(e);}`,
  );
  assert.notEqual(
    await run(
      'return document.querySelector("[data-carousel-status]").textContent',
    ),
    swipeBefore,
  );
  assert.equal(
    await run(
      'return document.querySelector("[data-carousel-pause]").getAttribute("aria-label")',
    ),
    "Resume slideshow",
  );
  await run('document.querySelector("[data-carousel]").focus()');
  await request("/actions", {
    actions: [
      {
        type: "key",
        id: "keyboard",
        actions: [
          { type: "keyDown", value: "\uE012" },
          { type: "keyUp", value: "\uE012" },
        ],
      },
    ],
  });
  assert.equal(
    await run(
      'return document.querySelector("[data-carousel-status]").textContent',
    ),
    swipeBefore,
  );
  assert.equal(
    await run(
      'return [...document.querySelectorAll("[data-slide]")].filter(s=>s.inert).length',
    ),
    2,
  );
  await click("[data-nav-toggle]");
  await request("/actions", {
    actions: [
      {
        type: "key",
        id: "keyboard",
        actions: [
          { type: "keyDown", value: "\uE00C" },
          { type: "keyUp", value: "\uE00C" },
        ],
      },
    ],
  });
  assert.equal(
    await run('return document.activeElement.hasAttribute("data-nav-toggle")'),
    true,
  );
  assert.equal(
    await run(
      'return document.querySelector("[data-nav-toggle]").getAttribute("aria-expanded")',
    ),
    "false",
  );
  console.log(
    "PASS swipe handler, keyboard carousel, inactive slides and mobile menu Escape",
  );

  for (const [route, destination] of [
    ["/manufacturing/", "/about/#manufacturing"],
    ["/development/", "/about/#development"],
    ["/contact/", "/#contact"],
    ["/products/", "/#collections"],
  ]) {
    await viewport(1024, route);
    assert.equal(
      await run("return location.pathname+location.hash"),
      destination,
    );
  }
  console.log("PASS legacy URL redirects in browser");

  await request("", null, "DELETE");
  session = undefined;
  const reducedSession = await request("/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "firefox",
        "moz:firefoxOptions": {
          args: ["-headless"],
          prefs: { "ui.prefersReducedMotion": 1 },
        },
      },
    },
  });
  session = reducedSession.sessionId;
  await viewport(390);
  assert.equal(
    await run('return matchMedia("(prefers-reduced-motion:reduce)").matches'),
    true,
  );
  await wait(6200);
  assert.equal(
    await run(
      'return document.querySelector("[data-carousel-status]").textContent',
    ),
    "Slide 1 of 3",
  );
  assert.equal(
    await run(
      'return getComputedStyle(document.querySelector(".is-active .hero-art img")).animationName',
    ),
    "none",
  );
  await click("[data-carousel-next]");
  assert.equal(
    await run(
      'return document.querySelector("[data-carousel-status]").textContent',
    ),
    "Slide 2 of 3",
  );
  console.log(
    "PASS reduced-motion: no autoplay or animation, manual navigation works",
  );

  await request("", null, "DELETE");
  session = undefined;
  const noScript = await request("/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "firefox",
        "moz:firefoxOptions": {
          args: ["-headless"],
          prefs: { "javascript.enabled": false },
        },
      },
    },
  });
  session = noScript.sessionId;
  await viewport(390, "/products/womens-scarves/");
  assert.equal(
    await run('return document.documentElement.classList.contains("js-ready")'),
    false,
  );
  assert.equal(
    await run(
      'return getComputedStyle(document.querySelector(".site-nav")).display',
    ),
    "flex",
  );
  assert.equal(
    await run('return document.querySelectorAll("[data-lightbox]").length'),
    35,
  );
  await layout();
  console.log("PASS no-JavaScript navigation and static product gallery");
  console.log(`Screenshots: ${output}`);
} finally {
  if (session) await request("", null, "DELETE");
}
