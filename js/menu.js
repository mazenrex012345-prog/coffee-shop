/* menu.js - the catalogue: categories, search, filter and sort */
Store.ready.then(function () {
  'use strict';
  var S = Store, U = UI, $ = U.$;
  var emoji = { 'Hot Drinks': '☕ ', 'Cold Drinks': '🍹 ', 'Snacks & Desserts': '🍰 ' };

  var catSel = $('#f-category');
  S.Products.categories().forEach(function (c) { catSel.insertAdjacentHTML('beforeend', '<option value="' + U.esc(c) + '">' + U.esc(c) + '</option>'); });

  function render() {
    var q = $('#f-q').value.trim().toLowerCase(), cat = catSel.value, sort = $('#f-sort').value, onlyAvail = $('#f-avail').checked;
    var list = S.Products.all().filter(function (p) {
      return (!q || (p.name + ' ' + p.description).toLowerCase().indexOf(q) !== -1) && (!cat || p.category === cat) && (!onlyAvail || p.available);
    });
    if (sort === 'price_asc') list.sort(function (a, b) { return a.price - b.price; });
    else if (sort === 'price_desc') list.sort(function (a, b) { return b.price - a.price; });
    else if (sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name); });

    var groups = [];
    if (sort) groups.push({ title: 'Results', items: list });
    else S.Products.categories().concat(['']).forEach(function (c) {
      var items = list.filter(function (p) { return (p.category || '') === c; });
      if (items.length) groups.push({ title: c || 'Other', items: items });
    });
    $('#menu-root').innerHTML = groups.length ? groups.map(function (g, i) {
      return '<h3 style="color: var(--secondary-color); border-bottom: 2px solid var(--accent-color); padding-bottom: 8px; margin-bottom: 25px;">' + U.esc((emoji[g.title] || '') + g.title) + '</h3>' +
             '<div class="services-grid" style="margin-bottom: 50px;">' + g.items.map(function (p) { return U.productCard(p, 'service'); }).join('') + '</div>';
    }).join('') : '<p style="text-align:center;color:#666;">No items match your search.</p>';
    $('#f-reset').style.display = (q || cat || sort || onlyAvail) ? 'inline' : 'none';
  }
  ['input', 'change'].forEach(function (ev) { $('#filter-bar').addEventListener(ev, render); });
  $('#filter-bar').addEventListener('submit', function (e) { e.preventDefault(); });
  $('#f-reset').addEventListener('click', function (e) { e.preventDefault(); $('#filter-bar').reset(); render(); });
  render();
});