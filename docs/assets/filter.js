(function () {
  var results = document.getElementById('f-results');
  var count = document.getElementById('f-count');
  if (!results || typeof RECIPES === 'undefined') return;

  var search = document.getElementById('f-search');
  var location = document.getElementById('f-location');
  var meal = document.getElementById('f-meal');
  var method = document.getElementById('f-method');
  var nutFree = document.getElementById('f-nutfree');
  var eggFree = document.getElementById('f-eggfree');
  var veg = document.getElementById('f-veg');

  function isYes(s) {
    return /^yes/i.test((s || '').trim());
  }
  function isVeg(diet) {
    return /vegetarian|vegan/i.test(diet || '');
  }

  function render() {
    var q = search.value.trim().toLowerCase();
    var matches = RECIPES.filter(function (r) {
      if (location.value && r.location !== location.value) return false;
      if (meal.value && r.meal !== meal.value) return false;
      if (method.value && r.method !== method.value) return false;
      if (nutFree.checked && !isYes(r.nutFree)) return false;
      if (eggFree.checked && !isYes(r.eggFree)) return false;
      if (veg.checked && !isVeg(r.diet)) return false;
      if (q && r.title.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    count.textContent = matches.length + ' of ' + RECIPES.length + ' recipes';

    results.innerHTML = matches.map(function (r) {
      var tags = [r.meal, r.course, r.diet, r.method].filter(Boolean).join(' · ');
      return '<a class="recipe-card" href="' + r.url + '">' +
        '<span class="rc-badge">' + r.location + '</span>' +
        '<span class="rc-title">' + escapeHtml(r.title) + '</span>' +
        '<span class="rc-tags">' + escapeHtml(tags) + '</span>' +
        '</a>';
    }).join('');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  [search, location, meal, method, nutFree, eggFree, veg].forEach(function (el) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  render();
})();
