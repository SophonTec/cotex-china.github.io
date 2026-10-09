// Homepage-only progressive enhancement; the shared About animation is untouched.
(function () {
  "use strict";
  document.addEventListener("DOMContentLoaded", function () {
    if (
      !("IntersectionObserver" in window) ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    document.documentElement.classList.add("collection-motion-ready");
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );
    document
      .querySelectorAll("[data-collection-reveal]")
      .forEach(function (section) {
        observer.observe(section);
      });
  });
})();
