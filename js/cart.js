/* cart.js - shopping cart page */
Store.ready.then(function () {
  'use strict';
  var S = Store, U = UI, $ = U.$;

  function render() {
    var c = S.Cart.lines(), root = $('#cart-root');
    U.initNav();
    $('#order-section').style.display = c.lines.length ? 'block' : 'none';
    if (c.lines.length) updateSummary();
    if (!c.lines.length) {
      root.innerHTML = '<p style="text-align:center;color:#666;">Your cart is empty.</p><p style="text-align:center;"><a class="order-btn" href="Services.html">Browse the Menu</a></p>';
      return;
    }
    root.innerHTML =
      '<div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th>Price</th><th>Quantity</th><th>Total</th><th></th></tr></thead><tbody>' +
      c.lines.map(function (l) {
        return '<tr><td data-label="Item">' + U.esc(l.product.name) + (l.product.available ? '' : ' <span class="badge badge-cancelled">Unavailable</span>') + '</td>' +
          '<td data-label="Price">' + U.money(l.product.price) + '</td>' +
          '<td data-label="Quantity"><input type="number" class="qty" data-id="' + l.product.id + '" value="' + l.qty + '" min="0" max="' + S.CONFIG.MAX_QTY + '"></td>' +
          '<td data-label="Total">' + U.money(l.total) + '</td>' +
          '<td><button class="link-btn danger rm" data-id="' + l.product.id + '" type="button">Remove</button></td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><td colspan="3" class="right"><strong>Subtotal</strong></td><td colspan="2"><strong>' + U.money(c.subtotal) + '</strong></td></tr>' +
      '<tr><td colspan="3" class="right muted">Delivery fee</td><td colspan="2" class="muted">calculated when you order</td></tr></tfoot></table></div>' +
      '<p class="muted sm center">Set a quantity to 0 to remove an item. Free standard delivery on orders above ' + U.money(S.CONFIG.FREE_DELIVERY_OVER) + '.</p>' +
      '<div class="actions"><button class="order-btn alt" id="update-cart" type="button">Update Cart</button><a class="order-btn" href="#order">Proceed to Order</a></div>' +
      '<p class="center"><button class="link-btn danger" id="clear-cart" type="button">Empty cart</button></p>';
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.classList.contains('rm')) { S.Cart.set(t.dataset.id, 0); U.clearAlerts(); U.showAlert('success', 'Item removed.'); render(); }
    else if (t.id === 'update-cart') {
      document.querySelectorAll('.qty').forEach(function (i) { S.Cart.set(i.dataset.id, Number(i.value)); });
      U.clearAlerts(); U.showAlert('success', 'Cart updated.'); render();
    } else if (t.id === 'clear-cart') { S.Cart.clear(); render(); }
  });
  /* ---------- Place Your Order (moved here from the Delivery page) ---------- */
  var user = S.Auth.current(), box = $('#order-box');
  if (!user) {
    box.innerHTML = '<p style="text-align:center;">Please <a href="login.html?next=cart.html%23order">log in</a> or <a href="register.html">create an account</a> to place an order.</p>';
  } else {
    $('#order-form-wrap').style.display = 'block';
    box.style.display = 'none';
    $('#client-name').value = user.name;
  }

  function updateSummary() {
    var cart = S.Cart.lines();
    var v = $('#payment').value;
    $('#card-payment-fields').style.display = (v === 'card' || v === 'debit') ? 'block' : 'none';
    $('#bank-note').style.display = v === 'bank' ? 'block' : 'none';
    var fee = S.Cart.deliveryFee(cart.subtotal, $('#delivery-type').value);
    $('#sum-subtotal').textContent = U.money(cart.subtotal);
    $('#fee').textContent = U.money(fee);
    $('#total').textContent = U.money(cart.subtotal + fee);
  }
  $('#payment').addEventListener('change', updateSummary);
  $('#delivery-type').addEventListener('change', updateSummary);

  $('#order-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var cartNow = S.Cart.lines();
    var d = { name: $('#client-name').value.trim(), type: $('#delivery-type').value, address: $('#address').value.trim(), street: $('#street').value.trim(),
              phone: $('#phone').value.trim(), method: $('#payment').value, notes: $('#notes').value.trim() };
    var err = [];
    if (!cartNow.lines.length) err.push('Your cart is empty.');
    if (cartNow.lines.some(function (l) { return !l.product.available; })) err.push('Please remove unavailable items from your cart first.');
    if (d.name.length < 2 || d.name.length > 100) err.push('Enter your name.');
    if (d.type !== 'standard' && d.type !== 'express') err.push('Choose a delivery speed.');
    if (d.address.length < 3 || d.address.length > 150) err.push('Enter your delivery address / neighborhood.');
    if (d.street.length < 2 || d.street.length > 150) err.push('Enter a street number or landmark.');
    if (!U.validPhone(d.phone)) err.push('Enter a valid phone number.');
    if (!S.PAYMENT_METHODS[d.method]) err.push('Choose a payment method.');
    if (d.notes.length > 500) err.push('Notes are too long (max 500).');
    if (d.method === 'card' || d.method === 'debit') {
      var num = $('#card-number').value.replace(/\D/g, ''), exp = $('#card-expiry').value.trim(), m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(exp), now = new Date();
      if ($('#card-name').value.trim().length < 2) err.push('Enter the cardholder name.');
      if (num.length < 13 || num.length > 19) err.push('Card number must have 13-19 digits.');
      if (!m) err.push('Expiry date must be MM/YY.');
      else if (Number('20' + m[2]) * 100 + Number(m[1]) < now.getFullYear() * 100 + now.getMonth() + 1) err.push('This card has expired.');
      if (!/^\d{3,4}$/.test($('#card-cvv').value)) err.push('CVV must be 3 or 4 digits.');
    }
    if (err.length) return U.showErrors(err);

    /* SIMULATED payment: card details are only checked here in the browser - they are never sent or saved.
       The server saves the order in MySQL and decides the payment status. */
    d.items = cartNow.lines.map(function (l) { return { id: l.product.id, quantity: l.qty }; });
    S.Orders.create(d).then(function (res) {
      S.Cart.clear();
      U.go('orders.html?id=' + res.id + '&new=1');
    }).catch(function (er) { U.showErrors([er.message]); });
  });

  render();
});
