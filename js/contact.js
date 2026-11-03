/* contact.js - contact form */
Store.ready.then(function () {
  'use strict';
  var S = Store, U = UI, $ = U.$, user = S.Auth.current();
  if (user) { $('#name').value = user.name; $('#email').value = user.email; }
  $('#contact-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var d = { type: 'contact', name: $('#name').value.trim(), email: $('#email').value.trim(), phone: '', orderRef: '', subject: $('#subject').value.trim(), message: $('#message').value.trim() };
    var err = [];
    if (!d.name || d.name.length > 100) err.push('Enter your name.');
    if (!U.validEmail(d.email)) err.push('Enter a valid email address.');
    if (!d.subject || d.subject.length > 150) err.push('Enter a subject.');
    if (d.message.length < 5 || d.message.length > 2000) err.push('Message must be 5-2000 characters.');
    if (err.length) return U.showErrors(err);
    var form = this;
    S.Messages.add(d).then(function () {
      form.reset(); if (user) { $('#name').value = user.name; $('#email').value = user.email; }
      U.clearAlerts(); U.showAlert('success', 'Thank you! Your message was sent. We will reply as soon as possible.');
    }).catch(function (er) { U.showErrors([er.message]); });
  });
});
