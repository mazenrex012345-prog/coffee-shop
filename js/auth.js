/* auth.js - login and registration */
Store.ready.then(function () {
  'use strict';
  var S = Store, U = UI, $ = U.$, page = document.body.dataset.page;
  if (S.Auth.current()) U.go('Home.html');

  if (page === 'login') {
    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      S.Auth.login($('#email').value.trim().toLowerCase(), $('#password').value).then(function (u) {
        U.flash('success', 'Welcome back, ' + u.name + '!');
        var next = new URLSearchParams(location.search).get('next');
        // only follow simple page names (no external redirects)
        if (next && /^[A-Za-z0-9_\-]+\.html(\?[A-Za-z0-9=&_\-]*)?(#[A-Za-z0-9_\-]*)?$/.test(next)) U.go(next);
        else U.go(u.role === 'admin' ? 'admin.html' : 'Home.html');
      }).catch(function (err) { U.showErrors([err.message]); });
    });
  }
});
