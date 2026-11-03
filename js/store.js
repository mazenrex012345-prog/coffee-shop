/* =====================================================================
   store.js  -  the DATA LAYER of the website.
   Products, users, orders, messages and reviews live in MySQL and are reached
   through api.php. The shopping cart stays in the browser (localStorage) until
   the customer places the order. Pages wait for Store.ready before using data.
   ===================================================================== */
(function (w) {
  'use strict';
  var PREFIX = 'cs_', mem = {};

  function read(key, def) {
    try { var v = localStorage.getItem(PREFIX + key); return v ? JSON.parse(v) : def; }
    catch (e) { return key in mem ? mem[key] : def; }
  }
  function write(key, val) {
    mem[key] = val;
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch (e) {}
  }

  /* ---------------- settings ---------------- */
  var CONFIG = { FREE_DELIVERY_OVER: 10000, STANDARD_FEE: 1000, EXPRESS_EXTRA: 1000, MAX_QTY: 20 };
  var ORDER_STATUSES = ['pending', 'paid', 'preparing', 'delivered', 'cancelled'];
  var PAYMENT_STATUSES = ['unpaid', 'paid', 'cash_on_delivery'];
  var PAYMENT_METHODS = {
    momo: 'Mobile Money (MTN MoMo / Airtel Money)',
    card: 'Visa / Mastercard (Local & International)',
    debit: 'Rwandan Debit Card (SmartCash / RSwitch)',
    bank: 'Local Bank Transfer (BK, I&M, Equity)',
    cod: 'Cash on Delivery'
  };

  /* ---------------- talking to api.php ---------------- */
  function api(action, data) {
    var opt = { credentials: 'same-origin' };
    if (data !== undefined) { opt.method = 'POST'; opt.headers = { 'Content-Type': 'application/json' }; opt.body = JSON.stringify(data); }
    return fetch('api.php?action=' + action, opt).then(function (r) {
      return r.text().then(function (t) {
        var j; try { j = JSON.parse(t); } catch (e) { throw new Error('Cannot reach the server. Open the site through PHP/Apache (http://localhost/...), not by double-clicking the file.'); }
        if (!r.ok || j.error) { var er = new Error(j.error || 'Request failed.'); er.status = r.status; throw er; }
        return j;
      });
    });
  }

  /* the data the visitor is allowed to see (loaded once per page, refreshed after every change) */
  var D = { user: null, categories: [], products: [], reviews: [], orders: [], messages: [] };
  function reload() { return api('bootstrap').then(function (j) { D = j; }); }
  var ready = reload().catch(function (e) { w.addEventListener('DOMContentLoaded', function () { var f = document.createElement('div'); f.className = 'alert alert-error'; f.textContent = e.message; document.body.insertBefore(f, document.body.firstChild); }); });
  function and(p) { return p.then(reload); }

  /* ---------------- Products ---------------- */
  var Products = {
    all: function () { return D.products.slice(); },
    get: function (id) { return D.products.filter(function (p) { return p.id === id; })[0] || null; },
    save: function (p) { return and(api('product_save', p)); },
    remove: function (id) { return and(api('product_delete', { id: id })); },
    categories: function () { return D.categories.slice(); },
    addCategory: function (name) { return and(api('category_add', { name: name })); },
    removeCategory: function (name) { return and(api('category_delete', { name: name })); }
  };

  /* ---------------- Auth (sessions are kept by PHP) ---------------- */
  var Auth = {
    current: function () { return D.user; },
    isAdmin: function () { return !!D.user && D.user.role === 'admin'; },
    login: function (email, password) { return api('login', { email: email, password: password }).then(function (j) { D.user = j.user; return j.user; }); },
    logout: function () { return api('logout', {}).then(function () { D.user = null; }); }
  };

  /* ---------------- Cart ---------------- */
  var Cart = {
    get: function () { return read('cart', {}); },
    count: function () { var c = Cart.get(); return Object.keys(c).reduce(function (n, k) { return n + c[k]; }, 0); },
    set: function (id, qty) {
      var c = Cart.get(); qty = Math.floor(qty);
      if (!(qty > 0)) delete c[id]; else c[id] = Math.min(qty, CONFIG.MAX_QTY);
      write('cart', c);
    },
    add: function (id, qty) { Cart.set(id, (Cart.get()[id] || 0) + (qty || 1)); },
    clear: function () { write('cart', {}); },
    /* returns { lines: [{product, qty, total}], subtotal } - prices always come from the catalogue */
    lines: function () {
      var c = Cart.get(), lines = [], subtotal = 0;
      Object.keys(c).forEach(function (k) {
        var p = Products.get(Number(k));
        if (!p) { Cart.set(k, 0); return; }
        var total = p.price * c[k]; subtotal += total;
        lines.push({ product: p, qty: c[k], total: total });
      });
      return { lines: lines, subtotal: subtotal };
    },
    deliveryFee: function (subtotal, type) {
      var fee = subtotal >= CONFIG.FREE_DELIVERY_OVER ? 0 : CONFIG.STANDARD_FEE;
      return type === 'express' ? fee + CONFIG.EXPRESS_EXTRA : fee;
    }
  };

  /* ---------------- Orders ---------------- */
  var Orders = {
    all: function () { return D.orders.slice(); },
    mine: function (userId) { return D.orders.filter(function (o) { return o.userId === userId; }); },
    get: function (id) { return D.orders.filter(function (o) { return o.id === id; })[0] || null; },
    create: function (o) { return api('order_create', o).then(function (j) { return reload().then(function () { return j; }); }); },
    update: function (id, fields) { return and(api('order_update', { id: id, status: fields.status, paymentStatus: fields.paymentStatus })); }
  };

  /* ---------------- Messages (contact + reports) & Reviews ---------------- */
  var Messages = {
    all: function () { return D.messages.slice(); },
    add: function (m) { return api('message_add', m); },
    remove: function (id) { return and(api('message_delete', { id: id })); }
  };
  var Reviews = {
    all: function () { return D.reviews.slice(); },
    add: function (r) { return api('review_add', r); }
  };

  w.Store = { CONFIG: CONFIG, ORDER_STATUSES: ORDER_STATUSES, PAYMENT_STATUSES: PAYMENT_STATUSES, PAYMENT_METHODS: PAYMENT_METHODS,
              Products: Products, Auth: Auth, Cart: Cart, Orders: Orders, Messages: Messages, Reviews: Reviews, ready: ready };
})(window);
