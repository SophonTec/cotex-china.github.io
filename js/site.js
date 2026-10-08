(function () {
  'use strict';

  function initNavigation() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.querySelector('[data-site-nav]');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var isOpen = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(isOpen));
      });

      nav.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
          nav.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }

    var activePage = document.body.dataset.page;
    if (activePage) {
      var activeLink = document.querySelector('[data-nav="' + activePage + '"]');
      if (activeLink) {
        activeLink.setAttribute('aria-current', 'page');
      }
    }
  }

  function initCopyrightYear() {
    document.querySelectorAll('[data-current-year]').forEach(function (node) {
      node.textContent = new Date().getFullYear();
    });
  }

  function createLightbox() {
    var dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', 'Product image viewer');
    dialog.innerHTML = [
      '<div class="lightbox__stage">',
      '  <div class="lightbox__media"><img src="" alt=""></div>',
      '  <div class="lightbox__caption" aria-live="polite"></div>',
      '</div>',
      '<button class="lightbox__button lightbox__close" type="button" aria-label="Close image viewer">×</button>',
      '<button class="lightbox__button lightbox__prev" type="button" aria-label="Previous image">←</button>',
      '<button class="lightbox__button lightbox__next" type="button" aria-label="Next image">→</button>'
    ].join('');
    document.body.appendChild(dialog);
    return dialog;
  }

  function initLightbox() {
    var dialog = createLightbox();
    var image = dialog.querySelector('img');
    var caption = dialog.querySelector('.lightbox__caption');
    var currentIndex = 0;
    var items = [];

    function availableItems() {
      return Array.from(document.querySelectorAll('[data-lightbox]')).filter(function (item) {
        return !item.hidden;
      });
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
      caption.textContent = item.dataset.caption + ' · ' + (currentIndex + 1) + ' of ' + items.length;
    }

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-lightbox]');
      if (!trigger) {
        return;
      }
      items = availableItems();
      showItem(items.indexOf(trigger));
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
        document.body.classList.add('modal-open');
      }
    });

    dialog.querySelector('.lightbox__close').addEventListener('click', function () {
      dialog.close();
    });
    dialog.querySelector('.lightbox__prev').addEventListener('click', function () {
      showItem(currentIndex - 1);
    });
    dialog.querySelector('.lightbox__next').addEventListener('click', function () {
      showItem(currentIndex + 1);
    });

    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    dialog.addEventListener('close', function () {
      document.body.classList.remove('modal-open');
      image.src = '';
    });

    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        showItem(currentIndex - 1);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        showItem(currentIndex + 1);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNavigation();
    initCopyrightYear();
    initLightbox();
  });
}());
