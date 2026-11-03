# Ikawa House – HTML / CSS / JavaScript + PHP + MySQL

## Run
1. In the MySQL 8.0 command-line client run `database.sql` (creates the database `coffee_shop`, tables and sample data).
2. Check `db.php` (host, port, user, password) – it was not changed.
3. Put the `site` folder in your PHP server (XAMPP `htdocs`, or run `php -S localhost:8000` inside `site`)
   and open `http://localhost:8000/Home.html`. Do NOT open the HTML files by double-clicking.

## Files
- `api.php` – the only file that talks to MySQL (products, login, orders, messages, reviews, admin actions)
- `db.php`, `register.php` – unchanged
- `js/store.js` – calls `api.php`; the cart is kept in the browser until the order is placed
- `js/cart.js` – cart + "Place Your Order" + simulated payment

## Administrator
`admin@coffee.com` / `Admin@123`; demo customer `customer@coffee.com` / `1234` (change them after the first login). Admin actions are checked on the server.
