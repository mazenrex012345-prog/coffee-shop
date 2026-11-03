/* home.js - best sellers, customer reviews and the report form */
Store.ready.then(function () {
  'use strict';
  var S = Store, U = UI, $ = U.$;

  /* best sellers */
  var feat = S.Products.all().filter(function (p) { return p.featured && p.available; }).slice(0, 6);
  if (!feat.length) feat = S.Products.all().filter(function (p) { return p.available; }).slice(0, 3);
  $('#featured-items').innerHTML = feat.length ? feat.map(function (p) { return U.productCard(p, 'item'); }).join('')
    : '<p style="text-align:center;color:#666;">Products will appear here once added by the administrator.</p>';

  /* reviews (the two original testimonials show until customers add their own) */
  var reviews = S.Reviews.all().slice(0, 6);
  if (!reviews.length) reviews = [
    { name: 'Uwase M.', rating: 0, comment: 'The best iced latte in Kicukiro! It arrives ice-cold and fresh every single time.' },
    { name: 'Jean Claude K.', rating: 0, comment: 'Super fast delivery to our office in Kigali. The club sandwich is a lifesaver during lunch breaks.' }
  ];
  $('#review-grid').innerHTML = reviews.map(function (r) {
    var stars = r.rating ? '<div class="stars">' + '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) + '</div>' : '';
    return '<div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">' + stars +
      '<p style="font-style: italic; color: #555;">"' + U.esc(r.comment) + '"</p>' +
      '<strong style="color: var(--primary-color); display: block; margin-top: 10px;">- ' + U.esc(r.name) + '</strong></div>';
  }).join('');

  var user = S.Auth.current();
  if (user) {
    $('#review-form').style.display = 'block';
    $('#review-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var rating = Number($('#rating').value), comment = $('#comment').value.trim();
      if (!(rating >= 1 && rating <= 5) || comment.length < 5 || comment.length > 500) return U.showErrors(['Please give a rating (1-5) and a comment of 5-500 characters.']);
      S.Reviews.add({ rating: rating, comment: comment }).then(function () {
        U.flash('success', 'Thank you for your review!'); location.reload();
      }).catch(function (er) { U.showErrors([er.message]); });
    });
    $('#report-name').value = user.name;
  } else {
    $('#review-login').style.display = 'block';
  }

  /* report form */
  $('#report-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var typeSel = $('#report-type'), d = {
      type: 'report', name: $('#report-name').value.trim(), phone: $('#report-phone').value.trim(), orderRef: $('#order-id').value.trim(),
      subject: typeSel.options[typeSel.selectedIndex].text, message: $('#report-details').value.trim()
    };
    var err = [];
    if (!d.name || d.name.length > 100) err.push('Enter your name.');
    if (!U.validPhone(d.phone)) err.push('Enter a valid phone number.');
    if (d.message.length < 10 || d.message.length > 2000) err.push('Describe the problem (10-2000 characters).');
    if (d.orderRef.length > 30) err.push('Order ID is too long.');
    if (err.length) return U.showErrors(err);
    var form = this;
    S.Messages.add(d).then(function () {
      form.reset(); if (user) $('#report-name').value = user.name;
      U.clearAlerts(); U.showAlert('success', 'Your report was submitted. We will contact you shortly.');
    }).catch(function (er) { U.showErrors([er.message]); });
  });
});
