(function () {
  "use strict";

  function initNavigation() {
    document.documentElement.classList.add("js-ready");
    var toggle = document.querySelector("[data-nav-toggle]");
    var nav = document.querySelector("[data-site-nav]");
    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var isOpen = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
      });

      nav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
        });
      });

      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && nav.classList.contains("is-open")) {
          nav.classList.remove("is-open");
          toggle.setAttribute("aria-expanded", "false");
          toggle.focus();
        }
      });
    }

    var activePage = document.body.dataset.page;
    if (activePage) {
      var activeLink = document.querySelector(
        '[data-nav="' + activePage + '"]',
      );
      if (activeLink) {
        activeLink.setAttribute("aria-current", "page");
      }
    }
  }

  function initCopyrightYear() {
    document.querySelectorAll("[data-current-year]").forEach(function (node) {
      node.textContent = new Date().getFullYear();
    });
  }

  function createLightbox() {
    var dialog = document.createElement("dialog");
    dialog.className = "lightbox";
    dialog.setAttribute("aria-label", "Product image viewer");
    dialog.innerHTML = [
      '<div class="lightbox__stage">',
      '  <div class="lightbox__media"><img alt=""></div>',
      '  <div class="lightbox__caption" aria-live="polite"></div>',
      "</div>",
      '<button class="lightbox__button lightbox__close" type="button" aria-label="Close image viewer">×</button>',
      '<button class="lightbox__button lightbox__prev" type="button" aria-label="Previous image">←</button>',
      '<button class="lightbox__button lightbox__next" type="button" aria-label="Next image">→</button>',
    ].join("");
    document.body.appendChild(dialog);
    return dialog;
  }

  function initLightbox() {
    if (!document.querySelector("[data-lightbox]")) return;
    var dialog = createLightbox();
    var image = dialog.querySelector("img");
    var caption = dialog.querySelector(".lightbox__caption");
    var currentIndex = 0;
    var items = [];

    function availableItems() {
      return Array.from(document.querySelectorAll("[data-lightbox]")).filter(
        function (item) {
          return !item.hidden;
        },
      );
    }

    function showItem(index) {
      items = availableItems();
      if (!items.length) {
        return;
      }
      currentIndex = (index + items.length) % items.length;
      var item = items[currentIndex];
      image.src = item.dataset.full;
      image.alt = item.dataset.caption;
      caption.textContent =
        item.dataset.caption +
        " · " +
        (currentIndex + 1) +
        " of " +
        items.length;
    }

    document.addEventListener("click", function (event) {
      var trigger = event.target.closest("[data-lightbox]");
      if (!trigger) {
        return;
      }
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        typeof dialog.showModal !== "function"
      )
        return;
      event.preventDefault();
      items = availableItems();
      showItem(items.indexOf(trigger));
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
        document.body.classList.add("modal-open");
      }
    });

    dialog
      .querySelector(".lightbox__close")
      .addEventListener("click", function () {
        dialog.close();
      });
    dialog
      .querySelector(".lightbox__prev")
      .addEventListener("click", function () {
        showItem(currentIndex - 1);
      });
    dialog
      .querySelector(".lightbox__next")
      .addEventListener("click", function () {
        showItem(currentIndex + 1);
      });

    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    dialog.addEventListener("close", function () {
      document.body.classList.remove("modal-open");
      image.removeAttribute("src");
    });

    dialog.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showItem(currentIndex - 1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showItem(currentIndex + 1);
      }
    });
  }

  function initCarousel() {
    var root = document.querySelector("[data-carousel]");
    if (!root) return;
    var slides = Array.from(root.querySelectorAll("[data-slide]"));
    var dots = Array.from(root.querySelectorAll("[data-carousel-dot]"));
    var pause = root.querySelector("[data-carousel-pause]");
    var status = root.querySelector("[data-carousel-status]");
    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    var index = 0,
      timer = null,
      remaining = 6000,
      started = 0;
    var manual = reduced.matches,
      hover = false,
      focus = false,
      visible = true;
    root.querySelector(".carousel-controls").hidden = false;
    root.classList.add("carousel-ready");

    function stopTimer() {
      if (timer !== null) {
        clearTimeout(timer);
        remaining = Math.max(0, remaining - (performance.now() - started));
        timer = null;
      }
    }
    function update() {
      var stopped =
        manual ||
        hover ||
        focus ||
        document.hidden ||
        !visible ||
        reduced.matches;
      root.classList.toggle("carousel-paused", stopped);
      status.setAttribute("aria-live", stopped ? "polite" : "off");
      var resumable = manual || focus;
      pause.textContent = resumable ? "▶" : "Ⅱ";
      pause.setAttribute(
        "aria-label",
        resumable ? "Resume slideshow" : "Pause slideshow",
      );
      if (stopped) stopTimer();
      else if (timer === null) {
        started = performance.now();
        timer = setTimeout(function () {
          timer = null;
          show(index + 1);
        }, remaining);
      }
    }
    function show(next) {
      stopTimer();
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        slide.classList.toggle("is-active", i === index);
        slide.inert = i !== index;
        slide.setAttribute("aria-hidden", String(i !== index));
        dots[i].setAttribute("aria-pressed", String(i === index));
      });
      status.textContent = "Slide " + (index + 1) + " of " + slides.length;
      remaining = 6000;
      update();
    }
    dots.forEach(function (dot, i) {
      dot.addEventListener("click", function () {
        if (i !== index) show(i);
      });
    });
    root
      .querySelector("[data-carousel-prev]")
      .addEventListener("click", function () {
        show(index - 1);
      });
    root
      .querySelector("[data-carousel-next]")
      .addEventListener("click", function () {
        show(index + 1);
      });
    pause.addEventListener("click", function () {
      if (manual || focus) {
        manual = false;
        focus = false;
      } else manual = true;
      update();
    });
    root.addEventListener("pointerenter", function (event) {
      if (event.pointerType === "mouse") {
        hover = true;
        update();
      }
    });
    root.addEventListener("pointerleave", function () {
      hover = false;
      update();
    });
    root.addEventListener("focusin", function (event) {
      if (event.target.matches(":focus-visible")) {
        focus = true;
        update();
      }
    });
    root.addEventListener("focusout", function (event) {
      if (!root.contains(event.relatedTarget)) {
        focus = false;
        update();
      }
    });
    root.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        manual = true;
        show(index + (event.key === "ArrowLeft" ? -1 : 1));
      }
    });
    var touch = null;
    root.addEventListener(
      "touchstart",
      function (event) {
        if (event.touches.length === 1)
          touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        else touch = null;
      },
      { passive: true },
    );
    root.addEventListener(
      "touchend",
      function (event) {
        if (!touch || !event.changedTouches.length) return;
        var dx = event.changedTouches[0].clientX - touch.x;
        var dy = event.changedTouches[0].clientY - touch.y;
        if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          manual = true;
          show(index + (dx < 0 ? 1 : -1));
        }
        touch = null;
      },
      { passive: true },
    );
    root.addEventListener("touchcancel", function () {
      touch = null;
    });
    document.addEventListener("visibilitychange", update);
    reduced.addEventListener("change", function () {
      manual = reduced.matches;
      update();
    });
    // Reduced-motion visitors use the manual arrows; never silently re-enable motion.
    if (reduced.matches) {
      pause.hidden = true;
    }
    reduced.addEventListener("change", function () {
      pause.hidden = reduced.matches;
    });
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          visible =
            entries[0].isIntersecting && entries[0].intersectionRatio >= 0.15;
          update();
        },
        { threshold: 0.15 },
      ).observe(root);
    }
    update();
  }

  function initReveal() {
    if (
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    var nodes = document.querySelectorAll("[data-reveal]");
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    document.documentElement.classList.add("reveal-ready");
    nodes.forEach(function (node) {
      observer.observe(node);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNavigation();
    initCopyrightYear();
    initLightbox();
    initCarousel();
    initReveal();
  });
})();
