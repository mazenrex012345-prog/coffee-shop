/* ui.js - helpers shared by every page: escaping, money, flash messages, navigation, guards */
(function (w) {
  'use strict';
  var S = w.Store;

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return Number(n).toLocaleString('en-US') + ' RWF'; }
  function badge(s) { return '<span class="badge badge-' + esc(s) + '">' + esc(String(s).replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); })) + '</span>'; }
  function fmtDate(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }); }
  function validPhone(p) { return /^\+?[0-9 ]{9,15}$/.test(p); }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
  function $(sel, root) { return (root || document).querySelector(sel); }

  /* flash messages survive a redirect (stored in sessionStorage) */
  function flash(type, msg) {
    try { var l = JSON.parse(sessionStorage.getItem('cs_flash') || '[]'); l.push([type, msg]); sessionStorage.setItem('cs_flash', JSON.stringify(l)); } catch (e) {}
  }
  function showAlert(type, msg) {
    var wrap = $('#flash'); if (!wrap) return;
    var d = document.createElement('div'); d.className = 'alert alert-' + type; d.textContent = msg; wrap.appendChild(d);
    if (type === 'success') setTimeout(function () { d.remove(); }, 6000);
  }
  function showErrors(list) { clearAlerts(); list.forEach(function (m) { showAlert('error', m); }); w.scrollTo({ top: 0, behavior: 'smooth' }); }
  function clearAlerts() { var wrap = $('#flash'); if (wrap) wrap.innerHTML = ''; }

  function go(url) { w.location.href = url; }

  /* guards */
  function requireLogin() {
    if (S.Auth.current()) return S.Auth.current();
    flash('info', 'Please log in to continue.');
    go('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search));
    return null;
  }
  function requireAdmin() {
    var u = requireLogin(); if (!u) return null;
    if (!S.Auth.isAdmin()) {
      document.body.innerHTML = '<section><h2>403 - Access denied</h2><p style="text-align:center">This area is for administrators only. <a href="Home.html">Back to home</a></p></section>';
      return null;
    }
    return u;
  }

  /* navigation: cart badge + login/logout links; flash area */
  function initNav() {
    var nav = $('nav'); if (!nav) return;
    var b = $('#cart-badge'); if (b) { var n = S.Cart.count(); b.textContent = n || ''; b.style.display = n ? 'inline' : 'none'; }
    var slot = $('#auth-links');
    if (slot) {
      var u = S.Auth.current(), h = '';
      if (u) {
        h += '<a href="orders.html">My Orders</a>';
        if (S.Auth.isAdmin()) h += '<a href="admin.html">Admin</a>';
        h += '<a href="#" id="logout-link">Logout</a>';
      } else h += '<a href="login.html">Login</a>';
      slot.innerHTML = h;
      var lo = $('#logout-link'); if (lo) lo.addEventListener('click', function (e) { e.preventDefault(); S.Auth.logout().then(function () { flash('success', 'You have been logged out.'); go('Home.html'); }); });
    }
    if (!$('#flash')) { var f = document.createElement('div'); f.id = 'flash'; f.className = 'flash-wrap'; nav.insertAdjacentElement('afterend', f); }
    try { (JSON.parse(sessionStorage.getItem('cs_flash') || '[]')).forEach(function (m) { showAlert(m[0], m[1]); }); sessionStorage.removeItem('cs_flash'); } catch (e) {}
  }

  /* product card in the site's original card layout */
  function productCard(p, cls) {
    var img = p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : '<div class="no-img">☕</div>';
    var head = cls === 'item'
      ? '<h3>' + esc(p.name) + '</h3><p>' + esc(p.description) + '</p><div class="price">' + money(p.price) + '</div>'
      : '<p>' + esc(p.name) + ' - ' + money(p.price) + '</p><p class="desc">' + esc(p.description) + '</p>';
    var action = p.available
      ? '<p class="stock in">● Available</p><button class="order-btn add-to-cart" data-id="' + p.id + '" type="button">Add to Cart</button>'
      : '<p class="stock out">● Out of stock</p><button class="order-btn" type="button" disabled>Unavailable</button>';
    return '<div class="' + cls + '">' + img + head + action + '</div>';
  }
  /* one delegated click handler for every "Add to Cart" button */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.add-to-cart') : null; if (!btn) return;
    var p = S.Products.get(Number(btn.dataset.id));
    if (!p || !p.available) { showAlert('error', 'This item is currently unavailable.'); return; }
    S.Cart.add(p.id, 1); go('cart.html');
  });

  var AUTH_PAGE = /^(login|register)$/.test(document.body.dataset.page || '');
  /* nobody sees anything before logging in */
  S.ready.then(function () {
    if (!S.Auth.current() && !AUTH_PAGE) { go('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop())); return; }
    document.body.classList.add('authed');
  });
  document.addEventListener('DOMContentLoaded', function () {
    S.ready.then(function () {
      initNav();
      var q = new URLSearchParams(location.search);
      if (q.get('error')) showAlert('error', q.get('error'));
      if (q.get('registered')) showAlert('success', 'Account created. You can now log in.');
    });
  });
  w.UI = { esc: esc, money: money, badge: badge, fmtDate: fmtDate, validPhone: validPhone, validEmail: validEmail, $: $, flash: flash,
           showAlert: showAlert, showErrors: showErrors, clearAlerts: clearAlerts, go: go, requireLogin: requireLogin,
           requireAdmin: requireAdmin, initNav: initNav, productCard: productCard };
})(window);
