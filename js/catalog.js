(function () {
  'use strict';

  var categories = {
    'womens-scarves': {
      name: "Women's Scarves",
      count: 35,
      directory: 'womens-scarves',
      prefix: 'scarves'
    },
    'womens-underwear': {
      name: "Women's Underwear",
      count: 30,
      directory: 'womens-underwear',
      prefix: 'underwear'
    },
    'womens-clothing': {
      name: "Women's Clothing",
      count: 30,
      directory: 'womens-clothing',
      prefix: 'womens-clothing'
    },
    'girls-clothing': {
      name: "Girls' Clothing",
      count: 32,
      directory: 'girls-clothing',
      prefix: 'girls-clothing'
    }
  };

  var categoryOrder = [
    'womens-scarves',
    'womens-underwear',
    'womens-clothing',
    'girls-clothing'
  ];

  function pad(number) {
    return String(number).padStart(2, '0');
  }

  function imagePath(categoryKey, number, width) {
    var category = categories[categoryKey];
    return '/assets/images/products/' + category.directory + '/' + category.prefix + '-' + pad(number) + '-' + width + '.jpg';
  }

  function productLabel(categoryKey, number) {
    return categories[categoryKey].name + ' ' + pad(number);
  }

  function createProductCard(categoryKey, number, eager) {
    var label = productLabel(categoryKey, number);
    var card = document.createElement('button');
    card.className = 'product-card';
    card.type = 'button';
    card.dataset.lightbox = '';
    card.dataset.category = categoryKey;
    card.dataset.full = imagePath(categoryKey, number, 1200);
    card.dataset.caption = label;
    card.setAttribute('aria-label', 'View larger image: ' + label);

    var imageWrap = document.createElement('span');
    imageWrap.className = 'product-card__image';

    var image = document.createElement('img');
    image.src = imagePath(categoryKey, number, 640);
    image.srcset = imagePath(categoryKey, number, 640) + ' 640w, ' + imagePath(categoryKey, number, 1200) + ' 1200w';
    image.sizes = '(max-width: 520px) calc(100vw - 28px), (max-width: 780px) 50vw, (max-width: 1050px) 33vw, 295px';
    image.alt = label;
    image.width = 640;
    image.height = 800;
    image.decoding = 'async';
    image.loading = eager ? 'eager' : 'lazy';
    if (eager) {
      image.fetchPriority = 'high';
    }

    var caption = document.createElement('span');
    caption.className = 'product-card__caption';
    caption.innerHTML = '<span class="product-card__name">' + label + '</span><span class="product-card__zoom" aria-hidden="true">＋</span>';

    imageWrap.appendChild(image);
    card.appendChild(imageWrap);
    card.appendChild(caption);
    return card;
  }

  function renderCategoryGallery() {
    var grid = document.querySelector('[data-category-gallery]');
    if (!grid) {
      return;
    }

    var categoryKey = grid.dataset.categoryGallery;
    var category = categories[categoryKey];
    if (!category) {
      return;
    }

    var fragment = document.createDocumentFragment();
    for (var number = 1; number <= category.count; number += 1) {
      fragment.appendChild(createProductCard(categoryKey, number, number <= 4));
    }
    grid.appendChild(fragment);

    var count = document.querySelector('[data-product-count]');
    if (count) {
      count.textContent = category.count + ' products';
    }
  }

  function renderFeaturedProducts() {
    var grid = document.querySelector('[data-featured-products]');
    if (!grid) {
      return;
    }

    var fragment = document.createDocumentFragment();
    categoryOrder.forEach(function (categoryKey) {
      for (var number = 1; number <= 5; number += 1) {
        fragment.appendChild(createProductCard(categoryKey, number, categoryKey === 'womens-scarves' && number <= 4));
      }
    });
    grid.appendChild(fragment);

    document.querySelectorAll('[data-product-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        var filter = button.dataset.productFilter;
        document.querySelectorAll('[data-product-filter]').forEach(function (item) {
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
        });
        grid.querySelectorAll('.product-card').forEach(function (card) {
          card.hidden = filter !== 'all' && card.dataset.category !== filter;
        });
      });
    });
  }

  window.CoTexCatalog = {
    categories: categories,
    order: categoryOrder,
    imagePath: imagePath
  };

  document.addEventListener('DOMContentLoaded', function () {
    renderCategoryGallery();
    renderFeaturedProducts();
  });
}());
