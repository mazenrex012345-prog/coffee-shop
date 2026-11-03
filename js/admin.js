/* admin.js - administrator dashboard: products, categories, orders, messages */
Store.ready.then(function () {
  'use strict';
  var S = Store, U = UI, $ = U.$;
  if (!U.requireAdmin()) return;
  var root = $('#admin-root'), tab = (location.hash || '#dashboard').slice(1);

  function tabs() {
    document.querySelectorAll('.admin-bar a').forEach(function (a) { a.style.fontWeight = a.getAttribute('href') === '#' + tab ? '800' : '600'; });
  }
  function opts(list, sel) { return list.map(function (x) { return '<option value="' + U.esc(x) + '"' + (x === sel ? ' selected' : '') + '>' + U.esc(x.replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); })) + '</option>'; }).join(''); }

  /* ---------- dashboard ---------- */
  function dashboard() {
    var orders = S.Orders.all(), revenue = orders.filter(function (o) { return o.paymentStatus === 'paid' && o.status !== 'cancelled'; }).reduce(function (n, o) { return n + o.total; }, 0);
    var stats = [['Products', S.Products.all().length], ['Orders', orders.length], ['Pending orders', orders.filter(function (o) { return o.status === 'pending'; }).length],
                 ['Messages', S.Messages.all().length], ['Revenue paid (RWF)', revenue.toLocaleString('en-US')]];
    root.innerHTML = '<h2>Administrator Dashboard</h2><div class="stat-grid">' + stats.map(function (s) { return '<div class="stat"><div class="num">' + s[1] + '</div><div>' + s[0] + '</div></div>'; }).join('') + '</div><h3>Recent orders</h3>' + orderTable(orders.slice(0, 8));
  }

  /* ---------- products ---------- */
  function products() {
    var list = S.Products.all().slice().reverse();
    root.innerHTML = '<h2>Products</h2><p class="right-link"><button class="order-btn" id="add-product" type="button">+ Add product</button></p><div id="product-form-area"></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Image</th><th>Name</th><th>Category</th><th>Price</th><th>Available</th><th>Featured</th><th>Actions</th></tr></thead><tbody>' +
      list.map(function (p) {
        return '<tr><td data-label="Image">' + (p.image ? '<img class="thumb" src="' + U.esc(p.image) + '" alt="">' : '') + '</td><td data-label="Name">' + U.esc(p.name) + '</td><td data-label="Category">' + U.esc(p.category || '-') + '</td>' +
          '<td data-label="Price">' + U.money(p.price) + '</td><td data-label="Available">' + (p.available ? 'Yes' : '<span class="badge badge-cancelled">No</span>') + '</td><td data-label="Featured">' + (p.featured ? '★' : '') + '</td>' +
          '<td class="nowrap"><button class="link-btn edit-p" data-id="' + p.id + '" type="button">Edit</button> · <button class="link-btn danger del-p" data-id="' + p.id + '" type="button">Delete</button></td></tr>';
      }).join('') + (list.length ? '' : '<tr><td colspan="7" class="center muted">No products yet.</td></tr>') + '</tbody></table></div>';
  }
  function productForm(p) {
    p = p || { name: '', category: '', description: '', price: '', image: '', available: true, featured: false };
    $('#product-form-area').innerHTML =
      '<form id="product-form"><h3 style="margin-top:0">' + (p.id ? 'Edit' : 'Add') + ' product</h3>' +
      '<label for="p-name">Name:</label><input type="text" id="p-name" maxlength="100" value="' + U.esc(p.name) + '" required>' +
      '<label for="p-cat">Category:</label><select id="p-cat" required><option value="">-- choose --</option>' + opts(S.Products.categories(), p.category) + '</select>' +
      '<label for="p-desc">Description:</label><textarea id="p-desc" rows="3" maxlength="500" required>' + U.esc(p.description) + '</textarea>' +
      '<label for="p-price">Price (RWF):</label><input type="number" id="p-price" min="1" step="1" value="' + U.esc(p.price) + '" required>' +
      '<label for="p-img">Image URL:</label><input type="text" id="p-img" maxlength="500" placeholder="https://..." value="' + U.esc(/^data:/.test(p.image) ? '' : p.image) + '">' +
      '<label for="p-file">...or choose an image file (max 300 KB):</label><input type="file" id="p-file" accept="image/*">' +
      (p.image ? '<p><img class="thumb big" src="' + U.esc(p.image) + '" alt="Current image"></p>' : '') +
      '<label class="check"><input type="checkbox" id="p-avail"' + (p.available ? ' checked' : '') + '> Available</label>' +
      '<label class="check"><input type="checkbox" id="p-feat"' + (p.featured ? ' checked' : '') + '> Featured on the home page</label>' +
      '<button class="order-btn full" type="submit">Save</button><p class="center"><a href="#products" id="cancel-p">Cancel</a></p></form>';
    $('#product-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var d = { id: p.id, name: $('#p-name').value.trim(), category: $('#p-cat').value, description: $('#p-desc').value.trim(), price: Number($('#p-price').value),
                image: $('#p-img').value.trim() || p.image, available: $('#p-avail').checked, featured: $('#p-feat').checked };
      var err = [], file = $('#p-file').files[0];
      if (d.name.length < 2 || d.name.length > 100) err.push('Name must be 2-100 characters.');
      if (!d.category) err.push('Choose a category.');
      if (d.description.length < 5 || d.description.length > 500) err.push('Description must be 5-500 characters.');
      if (!(Number.isInteger(d.price) && d.price >= 1 && d.price <= 10000000)) err.push('Price must be a whole number in RWF.');
      if ($('#p-img').value.trim() && !/^https?:\/\//i.test(d.image)) err.push('Image URL must start with http:// or https://');
      if (file && (file.size > 300 * 1024 || !/^image\//.test(file.type))) err.push('Image file must be an image of at most 300 KB.');
      if (err.length) return U.showErrors(err);
      function save() { S.Products.save(d).then(function () { U.clearAlerts(); U.showAlert('success', 'Product saved.'); products(); }).catch(function (er) { U.showErrors([er.message]); }); }
      if (file) { var r = new FileReader(); r.onload = function () { d.image = r.result; save(); }; r.readAsDataURL(file); } else save();
    });
  }

  /* ---------- categories ---------- */
  function categories() {
    var cats = S.Products.categories(), prods = S.Products.all();
    root.innerHTML = '<h2>Categories</h2><form id="cat-form" class="filter-bar"><input type="text" id="cat-name" maxlength="60" placeholder="New category name" required><button class="order-btn" type="submit">Add</button></form>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Name</th><th>Products</th><th>Actions</th></tr></thead><tbody>' +
      cats.map(function (c) { return '<tr><td data-label="Name">' + U.esc(c) + '</td><td data-label="Products">' + prods.filter(function (p) { return p.category === c; }).length + '</td><td><button class="link-btn danger del-c" data-name="' + U.esc(c) + '" type="button">Delete</button></td></tr>'; }).join('') + '</tbody></table></div>';
    $('#cat-form').addEventListener('submit', function (e) {
      e.preventDefault(); var n = $('#cat-name').value.trim();
      if (n.length < 2 || n.length > 60) return U.showErrors(['Category name must be 2-60 characters.']);
      S.Products.addCategory(n).then(categories).catch(function (er) { U.showErrors([er.message]); });
    });
  }

  /* ---------- orders ---------- */
  function orderTable(list) {
    return '<div class="table-wrap"><table class="table"><thead><tr><th>#</th><th>Customer</th><th>Phone</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th><th></th></tr></thead><tbody>' +
      list.map(function (o) {
        return '<tr><td data-label="#">' + o.id + '</td><td data-label="Customer">' + U.esc(o.customerName) + '</td><td data-label="Phone">' + U.esc(o.phone) + '</td><td data-label="Total">' + U.money(o.total) + '</td>' +
          '<td data-label="Payment">' + U.badge(o.paymentStatus) + '</td><td data-label="Status">' + U.badge(o.status) + '</td><td data-label="Date">' + U.esc(U.fmtDate(o.createdAt)) + '</td><td><a href="#order-' + o.id + '">View / Update</a></td></tr>';
      }).join('') + (list.length ? '' : '<tr><td colspan="8" class="center muted">No orders yet.</td></tr>') + '</tbody></table></div>';
  }
  function orders() {
    root.innerHTML = '<h2>Customer Orders</h2><form class="filter-bar" onsubmit="return false"><select id="o-filter"><option value="">All statuses</option>' + opts(S.ORDER_STATUSES, '') + '</select></form><div id="o-list"></div>';
    function draw() { var f = $('#o-filter').value; $('#o-list').innerHTML = orderTable(S.Orders.all().filter(function (o) { return !f || o.status === f; })); }
    $('#o-filter').addEventListener('change', draw); draw();
  }
  function orderDetail(id) {
    var o = S.Orders.get(id); if (!o) { location.hash = '#orders'; return; }
    root.innerHTML = '<h2>Order #' + o.id + '</h2><div class="detail-grid"><div class="card left"><h3>Customer</h3><p>' + U.esc(o.customerName) + '<br>' + U.esc(o.phone) + '</p><p>' + U.esc(o.address) + '<br>' + U.esc(o.landmark) + '</p><p class="muted sm">' + U.esc(o.deliveryType) + ' delivery · ' + U.esc(U.fmtDate(o.createdAt)) + '</p>' + (o.notes ? '<p class="sm">Notes: ' + U.esc(o.notes) + '</p>' : '') + '</div>' +
      '<form id="o-form" class="card left flat"><h3>Update</h3><p class="sm muted">Payment method: ' + U.esc(S.PAYMENT_METHODS[o.paymentMethod] || '-') + (o.paymentRef ? ' · Ref ' + U.esc(o.paymentRef) : '') + '</p>' +
      '<label for="o-status">Order status:</label><select id="o-status">' + opts(S.ORDER_STATUSES, o.status) + '</select><label for="o-pay">Payment status:</label><select id="o-pay">' + opts(S.PAYMENT_STATUSES, o.paymentStatus) + '</select><button class="order-btn full" type="submit">Save changes</button></form></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead><tbody>' + o.items.map(function (i) { return '<tr><td data-label="Item">' + U.esc(i.name) + '</td><td data-label="Price">' + U.money(i.price) + '</td><td data-label="Qty">' + i.quantity + '</td><td data-label="Total">' + U.money(i.price * i.quantity) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="3" class="right">Subtotal</td><td>' + U.money(o.subtotal) + '</td></tr><tr><td colspan="3" class="right">Delivery</td><td>' + U.money(o.deliveryFee) + '</td></tr><tr><td colspan="3" class="right"><strong>Total</strong></td><td><strong>' + U.money(o.total) + '</strong></td></tr></tfoot></table></div><p class="center"><a href="#orders">← All orders</a></p>';
    $('#o-form').addEventListener('submit', function (e) {
      e.preventDefault(); var s = $('#o-status').value, p = $('#o-pay').value;
      if (S.ORDER_STATUSES.indexOf(s) < 0 || S.PAYMENT_STATUSES.indexOf(p) < 0) return U.showErrors(['Invalid status.']);
      S.Orders.update(o.id, { status: s, paymentStatus: p }).then(function () { U.clearAlerts(); U.showAlert('success', 'Order #' + o.id + ' updated.'); }).catch(function (er) { U.showErrors([er.message]); });
    });
  }

  /* ---------- messages ---------- */
  function messages() {
    var l = S.Messages.all();
    root.innerHTML = '<h2>Messages &amp; Reports</h2>' + (l.map(function (m) {
      return '<div class="card left msg"><div class="msg-head"><strong>' + U.esc(m.subject) + '</strong><span class="badge ' + (m.type === 'report' ? 'badge-cancelled' : 'badge-paid') + '">' + U.esc(m.type) + '</span><span class="muted sm">' + U.esc(U.fmtDate(m.createdAt)) + '</span></div>' +
        '<p class="sm muted">From: ' + U.esc(m.name) + (m.email ? ' · ' + U.esc(m.email) : '') + (m.phone ? ' · ' + U.esc(m.phone) : '') + (m.orderRef ? ' · Order ' + U.esc(m.orderRef) : '') + '</p><p>' + U.esc(m.message).replace(/\n/g, '<br>') + '</p>' +
        '<button class="link-btn danger del-m" data-id="' + m.id + '" type="button">Delete</button></div>';
    }).join('') || '<p class="center muted">No messages yet.</p>');
  }

  /* ---------- routing + clicks ---------- */
  function route() {
    tab = (location.hash || '#dashboard').slice(1); U.clearAlerts(); tabs();
    var m = /^order-(\d+)$/.exec(tab);
    if (m) return orderDetail(Number(m[1]));
    ({ dashboard: dashboard, products: products, categories: categories, orders: orders, messages: messages }[tab] || dashboard)();
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'add-product') productForm();
    else if (t.classList.contains('edit-p')) { productForm(S.Products.get(Number(t.dataset.id))); $('#product-form-area').scrollIntoView(); }
    else if (t.classList.contains('del-p')) { if (confirm('Delete this product?')) { S.Products.remove(Number(t.dataset.id)).then(products).catch(function (er) { U.showErrors([er.message]); }); } }
    else if (t.classList.contains('del-c')) {
      var n = t.dataset.name; if (S.Products.all().some(function (p) { return p.category === n; })) U.showErrors(['Move or delete the products in this category first.']);
      else if (confirm('Delete this category?')) { S.Products.removeCategory(n).then(categories).catch(function (er) { U.showErrors([er.message]); }); }
    } else if (t.classList.contains('del-m')) { if (confirm('Delete this message?')) { S.Messages.remove(Number(t.dataset.id)).then(messages).catch(function (er) { U.showErrors([er.message]); }); } }
    else if (t.id === 'cancel-p') { e.preventDefault(); $('#product-form-area').innerHTML = ''; }
  });
  window.addEventListener('hashchange', route);
  route();
});
