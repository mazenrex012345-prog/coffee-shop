/* orders.js - "My Orders" list and single order page (with confirmation) */
Store.ready.then(function () {
  'use strict';
  var S = Store, U = UI, $ = U.$, user = U.requireLogin();
  if (!user) return;
  var params = new URLSearchParams(location.search), id = Number(params.get('id'));
  var root = $('#orders-root');

  if (!id) {
    var list = S.Orders.mine(user.id);
    $('#orders-title').textContent = 'My Orders';
    root.innerHTML = !list.length
      ? '<p style="text-align:center;color:#666;">You have not placed any orders yet.</p><p style="text-align:center;"><a class="order-btn" href="Services.html">Browse the Menu</a></p>'
      : '<div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Date</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody>' +
        list.map(function (o) {
          return '<tr><td data-label="Order">#' + o.id + '</td><td data-label="Date">' + U.esc(U.fmtDate(o.createdAt)) + '</td><td data-label="Total">' + U.money(o.total) +
            '</td><td data-label="Payment">' + U.badge(o.paymentStatus) + '</td><td data-label="Status">' + U.badge(o.status) + '</td><td><a href="orders.html?id=' + o.id + '">View</a></td></tr>';
        }).join('') + '</tbody></table></div>';
    return;
  }

  var o = S.Orders.get(id);
  if (!o || (o.userId !== user.id && !S.Auth.isAdmin())) { root.innerHTML = '<p style="text-align:center;">Order not found. <a href="orders.html">My orders</a></p>'; return; }
  $('#orders-title').textContent = 'Order #' + o.id;
  var banner = '';
  if (params.get('new')) {
    var msg = o.paymentStatus === 'paid' ? '<h2>Payment confirmed!</h2><p>Thank you, ' + U.esc(o.customerName) + '. We received <strong>' + U.money(o.total) + '</strong> (simulated payment). Reference: <strong>' + U.esc(o.paymentRef) + '</strong></p>'
      : o.paymentStatus === 'cash_on_delivery' ? '<h2>Order confirmed!</h2><p>Thank you, ' + U.esc(o.customerName) + '. Please pay <strong>' + U.money(o.total) + '</strong> in cash on delivery.</p>'
      : '<h2>Order received!</h2><p>Thank you, ' + U.esc(o.customerName) + '. Please complete your bank transfer of <strong>' + U.money(o.total) + '</strong>; we will mark the order as paid once it is confirmed.</p>';
    banner = '<div class="confirm"><div class="tick">✔</div>' + msg + '</div>';
  }
  root.innerHTML = banner +
    '<div class="detail-grid"><div class="card left"><h3>Status</h3><p>Order: ' + U.badge(o.status) + '</p><p>Payment: ' + U.badge(o.paymentStatus) + ' <span class="muted sm">(' + U.esc(S.PAYMENT_METHODS[o.paymentMethod] || '') + ')</span></p><p class="muted sm">Placed: ' + U.esc(U.fmtDate(o.createdAt)) + '</p></div>' +
    '<div class="card left"><h3>Delivery</h3><p>' + U.esc(o.customerName) + '<br>' + U.esc(o.phone) + '</p><p>' + U.esc(o.address) + '<br>' + U.esc(o.landmark) + '</p><p class="muted sm">' + (o.deliveryType === 'express' ? 'Express' : 'Standard') + ' delivery</p>' + (o.notes ? '<p class="sm">Notes: ' + U.esc(o.notes) + '</p>' : '') + '</div></div>' +
    '<div class="table-wrap"><table class="table"><thead><tr><th>Item</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead><tbody>' +
    o.items.map(function (i) { return '<tr><td data-label="Item">' + U.esc(i.name) + '</td><td data-label="Price">' + U.money(i.price) + '</td><td data-label="Qty">' + i.quantity + '</td><td data-label="Total">' + U.money(i.price * i.quantity) + '</td></tr>'; }).join('') +
    '</tbody><tfoot><tr><td colspan="3" class="right">Subtotal</td><td>' + U.money(o.subtotal) + '</td></tr><tr><td colspan="3" class="right">Delivery</td><td>' + U.money(o.deliveryFee) + '</td></tr><tr><td colspan="3" class="right"><strong>Total</strong></td><td><strong>' + U.money(o.total) + '</strong></td></tr></tfoot></table></div>' +
    '<p class="center"><a href="orders.html">← My orders</a></p>';
});
