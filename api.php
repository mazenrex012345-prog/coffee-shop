<?php
/* api.php - Ikawa House API */
require "db.php";

session_set_cookie_params([
    "httponly" => true,
    "samesite" => "Lax"
]);
session_start();

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

const FREE_DELIVERY_OVER = 10000;
const STANDARD_FEE = 1000;
const EXPRESS_EXTRA = 1000;
const MAX_QTY = 20;

const ORDER_STATUSES = [
    "pending", "paid", "preparing", "delivered", "cancelled"
];

const PAYMENT_STATUSES = [
    "unpaid", "paid", "cash_on_delivery"
];

const PAYMENT_METHODS = [
    "momo", "card", "debit", "bank", "cod"
];

function out($data, $code = 200) {
    http_response_code($code);
    echo json_encode(
        $data,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
    );
    exit;
}

function fail($msg, $code = 400) {
    out(["error" => $msg], $code);
}

function iso($ts) {
    return date("c", strtotime($ts));
}

function len($s) {
    return mb_strlen($s, "UTF-8");
}

function me() {
    global $conn;

    if (empty($_SESSION["uid"])) return null;

    $st = $conn->prepare(
        "SELECT id, name, email, role FROM users WHERE id = ?"
    );
    $st->execute([$_SESSION["uid"]]);

    $u = $st->fetch(PDO::FETCH_ASSOC);

    if (!$u) {
        unset($_SESSION["uid"]);
        return null;
    }

    $u["id"] = (int)$u["id"];
    return $u;
}

function requireUser() {
    $u = me();

    if (!$u) {
        fail("Please log in to continue.", 401);
    }

    return $u;
}

function requireAdmin() {
    $u = requireUser();

    if ($u["role"] !== "admin") {
        fail("Administrators only.", 403);
    }

    return $u;
}

function body() {
    $raw = file_get_contents("php://input");
    $d = json_decode($raw, true);

    return is_array($d) ? $d : [];
}

function str($d, $k) {
    return isset($d[$k]) && is_scalar($d[$k])
        ? trim((string)$d[$k])
        : "";
}

function loadOrders($where, $params) {
    global $conn;

    $st = $conn->prepare(
        "SELECT * FROM orders $where ORDER BY id DESC"
    );
    $st->execute($params);

    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    if (!$rows) return [];

    $ids = array_map(
        function ($r) {
            return (int)$r["id"];
        },
        $rows
    );

    $in = implode(",", array_fill(0, count($ids), "?"));

    $it = $conn->prepare(
        "SELECT order_id, product_id, product_name, price, quantity
         FROM order_items
         WHERE order_id IN ($in)
         ORDER BY id"
    );
    $it->execute($ids);

    $items = [];

    foreach ($it->fetchAll(PDO::FETCH_ASSOC) as $i) {
        $items[$i["order_id"]][] = [
            "productId" => $i["product_id"] === null
                ? null
                : (int)$i["product_id"],
            "name" => $i["product_name"],
            "price" => (int)$i["price"],
            "quantity" => (int)$i["quantity"]
        ];
    }

    return array_map(function ($o) use ($items) {
        return [
            "id" => (int)$o["id"],
            "userId" => (int)$o["user_id"],
            "customerName" => $o["customer_name"],
            "phone" => $o["phone"],
            "address" => $o["address"],
            "landmark" => $o["landmark"],
            "deliveryType" => $o["delivery_type"],
            "notes" => $o["notes"],
            "items" => $items[$o["id"]] ?? [],
            "subtotal" => (int)$o["subtotal"],
            "deliveryFee" => (int)$o["delivery_fee"],
            "total" => (int)$o["total"],
            "paymentMethod" => $o["payment_method"],
            "paymentStatus" => $o["payment_status"],
            "paymentRef" => $o["payment_ref"],
            "status" => $o["status"],
            "createdAt" => iso($o["created_at"])
        ];
    }, $rows);
}

$action = $_GET["action"] ?? "";
$isPost = $_SERVER["REQUEST_METHOD"] === "POST";

if (
    $isPost &&
    stripos($_SERVER["CONTENT_TYPE"] ?? "", "application/json") !== 0
) {
    fail("Bad request.", 415);
}

$d = $isPost ? body() : [];

try {
    switch ($action) {

        /* ---------- Bootstrap ---------- */

        case "bootstrap":

            $user = me();

            if (!$user) {
                out([
                    "user" => null,
                    "categories" => [],
                    "products" => [],
                    "reviews" => [],
                    "orders" => [],
                    "messages" => []
                ]);
            }

            $cats = $conn->query(
                "SELECT name FROM categories ORDER BY id"
            )->fetchAll(PDO::FETCH_COLUMN);

            $products = array_map(function ($p) {
                return [
                    "id" => (int)$p["id"],
                    "name" => $p["name"],
                    "category" => $p["category"] ?? "",
                    "price" => (int)$p["price"],
                    "featured" => (bool)$p["is_featured"],
                    "available" => (bool)$p["is_available"],
                    "description" => $p["description"],
                    "image" => $p["image"] ?? ""
                ];
            }, $conn->query(
                "SELECT p.*, c.name AS category
                 FROM products p
                 LEFT JOIN categories c ON c.id = p.category_id
                 ORDER BY p.id"
            )->fetchAll(PDO::FETCH_ASSOC));

            $reviews = array_map(function ($r) {
                return [
                    "id" => (int)$r["id"],
                    "userId" => (int)$r["user_id"],
                    "name" => $r["name"],
                    "rating" => (int)$r["rating"],
                    "comment" => $r["comment"],
                    "createdAt" => iso($r["created_at"])
                ];
            }, $conn->query(
                "SELECT * FROM reviews ORDER BY id DESC LIMIT 50"
            )->fetchAll(PDO::FETCH_ASSOC));

            $orders = $user["role"] === "admin"
                ? loadOrders("", [])
                : loadOrders("WHERE user_id = ?", [$user["id"]]);

            $messages = [];

            if ($user["role"] === "admin") {
                $messages = array_map(function ($m) {
                    return [
                        "id" => (int)$m["id"],
                        "type" => $m["type"],
                        "name" => $m["name"],
                        "email" => $m["email"],
                        "phone" => $m["phone"],
                        "orderRef" => $m["order_ref"],
                        "subject" => $m["subject"],
                        "message" => $m["message"],
                        "createdAt" => iso($m["created_at"])
                    ];
                }, $conn->query(
                    "SELECT * FROM messages ORDER BY id DESC"
                )->fetchAll(PDO::FETCH_ASSOC));
            }

            out([
                "user" => $user,
                "categories" => $cats,
                "products" => $products,
                "reviews" => $reviews,
                "orders" => $orders,
                "messages" => $messages
            ]);

        /* ---------- Login ---------- */

        case "login":

            $email = strtolower(str($d, "email"));
            $pass = isset($d["password"])
                ? (string)$d["password"]
                : "";

            $st = $conn->prepare(
                "SELECT id, password_hash FROM users WHERE email = ?"
            );
            $st->execute([$email]);

            $u = $st->fetch(PDO::FETCH_ASSOC);

            if (
                !$u ||
                !password_verify($pass, $u["password_hash"])
            ) {
                fail("Incorrect email or password.", 401);
            }

            session_regenerate_id(true);
            $_SESSION["uid"] = (int)$u["id"];

            out(["user" => me()]);

        /* ---------- Logout ---------- */

        case "logout":

            $_SESSION = [];
            session_destroy();

            out(["ok" => true]);

        /* ---------- Create Order ---------- */

        case "order_create":

            $u = requireUser();

            // اسم العميل من الحساب المسجل
            $name = $u["name"];

            $type = str($d, "type");
            $addr = str($d, "address");
            $street = str($d, "street");
            $phone = str($d, "phone");
            $method = str($d, "method");
            $notes = str($d, "notes");

            $err = [];

            if (len($name) < 2 || len($name) > 100)
                $err[] = "Enter your name.";

            if (!in_array($type, ["standard", "express"], true))
                $err[] = "Choose a delivery speed.";

            if (len($addr) < 3 || len($addr) > 150)
                $err[] = "Enter your delivery address.";

            if (len($street) < 2 || len($street) > 150)
                $err[] = "Enter a street number or landmark.";

            if (!preg_match('/^\+?[0-9 ]{9,15}$/', $phone))
                $err[] = "Enter a valid phone number.";

            if (!in_array($method, PAYMENT_METHODS, true))
                $err[] = "Choose a payment method.";

            if (len($notes) > 500)
                $err[] = "Notes are too long.";

            $lines = isset($d["items"]) && is_array($d["items"])
                ? $d["items"]
                : [];

            if (!$lines) $err[] = "Your cart is empty.";

            if ($err) {
                out([
                    "error" => implode(" ", $err),
                    "errors" => $err
                ], 422);
            }

            $subtotal = 0;
            $rows = [];

            $get = $conn->prepare(
                "SELECT id, name, price, is_available
                 FROM products WHERE id = ?"
            );

            foreach ($lines as $l) {
                $qty = (int)($l["quantity"] ?? 0);

                $get->execute([(int)($l["id"] ?? 0)]);
                $p = $get->fetch(PDO::FETCH_ASSOC);

                if (!$p || $qty < 1)
                    fail("An item in your cart no longer exists.", 422);

                if (!(int)$p["is_available"])
                    fail($p["name"] . " is unavailable.", 422);

                $qty = min($qty, MAX_QTY);

                $subtotal += (int)$p["price"] * $qty;

                $rows[] = [
                    (int)$p["id"],
                    $p["name"],
                    (int)$p["price"],
                    $qty
                ];
            }

            $fee = $subtotal >= FREE_DELIVERY_OVER
                ? 0
                : STANDARD_FEE;

            if ($type === "express")
                $fee += EXPRESS_EXTRA;

            if ($method === "cod") {
                $payStatus = "cash_on_delivery";
                $status = "pending";
            } elseif ($method === "bank") {
                $payStatus = "unpaid";
                $status = "pending";
            } else {
                $payStatus = "paid";
                $status = "paid";
            }

            $ref = $payStatus === "paid"
                ? strtoupper(substr($method, 0, 3)) . "-" .
                  strtoupper(bin2hex(random_bytes(4)))
                : "";

            $conn->beginTransaction();

            $conn->prepare(
                "INSERT INTO orders
                (user_id, customer_name, phone, address, landmark,
                 delivery_type, notes, subtotal, delivery_fee, total,
                 payment_method, payment_status, payment_ref, status)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            )->execute([
                $u["id"], $name, $phone, $addr, $street, $type,
                $notes, $subtotal, $fee, $subtotal + $fee,
                $method, $payStatus, $ref, $status
            ]);

            $oid = (int)$conn->lastInsertId();

            $ins = $conn->prepare(
                "INSERT INTO order_items
                (order_id, product_id, product_name, price, quantity)
                VALUES (?,?,?,?,?)"
            );

            foreach ($rows as $r)
                $ins->execute([$oid, $r[0], $r[1], $r[2], $r[3]]);

            $conn->commit();

            out(["id" => $oid]);

        /* ---------- Update Order ---------- */

        case "order_update":

            requireAdmin();

            $status = str($d, "status");
            $pay = str($d, "paymentStatus");

            if (
                !in_array($status, ORDER_STATUSES, true) ||
                !in_array($pay, PAYMENT_STATUSES, true)
            ) {
                fail("Invalid status.");
            }

            $conn->prepare(
                "UPDATE orders SET status = ?, payment_status = ? WHERE id = ?"
            )->execute([
                $status,
                $pay,
                (int)($d["id"] ?? 0)
            ]);

            out(["ok" => true]);

        /* ---------- Save Product ---------- */

        case "product_save":

            requireAdmin();

            $id = (int)($d["id"] ?? 0);
            $name = str($d, "name");
            $cat = str($d, "category");
            $desc = str($d, "description");
            $price = $d["price"] ?? null;
            $img = str($d, "image");

            $err = [];

            if (len($name) < 2 || len($name) > 100)
                $err[] = "Name must be 2-100 characters.";

            if (len($desc) < 5 || len($desc) > 500)
                $err[] = "Description must be 5-500 characters.";

            if (!is_int($price) || $price < 1 || $price > 10000000)
                $err[] = "Price must be a whole number.";

            if (
                $img !== "" &&
                !(preg_match('#^https?://#i', $img) && len($img) <= 500) &&
                !(preg_match('#^data:image/#', $img) && strlen($img) <= 450000)
            ) {
                $err[] = "Invalid image.";
            }

            $c = $conn->prepare(
                "SELECT id FROM categories WHERE name = ?"
            );
            $c->execute([$cat]);

            $catId = $c->fetchColumn();

            if (!$catId) $err[] = "Choose a category.";

            if ($err) {
                out([
                    "error" => implode(" ", $err),
                    "errors" => $err
                ], 422);
            }

            $vals = [
                $catId,
                $name,
                $desc,
                $price,
                !empty($d["available"]) ? 1 : 0,
                !empty($d["featured"]) ? 1 : 0,
                $img
            ];

            if ($id) {
                $vals[] = $id;

                $conn->prepare(
                    "UPDATE products SET
                    category_id=?, name=?, description=?, price=?,
                    is_available=?, is_featured=?, image=?
                    WHERE id=?"
                )->execute($vals);
            } else {
                $conn->prepare(
                    "INSERT INTO products
                    (category_id, name, description, price,
                     is_available, is_featured, image)
                    VALUES (?,?,?,?,?,?,?)"
                )->execute($vals);
            }

            out(["ok" => true]);

        /* ---------- Delete Product ---------- */

        case "product_delete":

            requireAdmin();

            $conn->prepare(
                "DELETE FROM products WHERE id = ?"
            )->execute([(int)($d["id"] ?? 0)]);

            out(["ok" => true]);

        /* ---------- Add Category ---------- */

        case "category_add":

            requireAdmin();

            $n = str($d, "name");

            if (len($n) < 2 || len($n) > 60)
                fail("Category name must be 2-60 characters.");

            $x = $conn->prepare(
                "SELECT id FROM categories WHERE name = ?"
            );
            $x->execute([$n]);

            if (!$x->fetchColumn()) {
                $conn->prepare(
                    "INSERT INTO categories (name) VALUES (?)"
                )->execute([$n]);
            }

            out(["ok" => true]);

        /* ---------- Delete Category ---------- */

        case "category_delete":

            requireAdmin();

            $n = str($d, "name");

            $c = $conn->prepare(
                "SELECT COUNT(*) FROM products p
                 JOIN categories c ON c.id = p.category_id
                 WHERE c.name = ?"
            );
            $c->execute([$n]);

            if ($c->fetchColumn() > 0)
                fail("Move or delete products in this category first.");

            $conn->prepare(
                "DELETE FROM categories WHERE name = ?"
            )->execute([$n]);

            out(["ok" => true]);

        /* ---------- Add Message ---------- */

        case "message_add":

            requireUser();

            $type = str($d, "type") === "report"
                ? "report"
                : "contact";

            $name = str($d, "name");
            $email = str($d, "email");
            $phone = str($d, "phone");
            $ref = str($d, "orderRef");
            $subj = str($d, "subject");
            $msg = str($d, "message");

            if ($name === "" || len($name) > 100)
                fail("Enter your name.");

            if (
                $email !== "" &&
                (!filter_var($email, FILTER_VALIDATE_EMAIL) || len($email) > 150)
            ) {
                fail("Enter a valid email address.");
            }

            if (
                $phone !== "" &&
                !preg_match('/^\+?[0-9 ]{9,15}$/', $phone)
            ) {
                fail("Enter a valid phone number.");
            }

            if ($subj === "" || len($subj) > 150)
                fail("Enter a subject.");

            if (len($msg) < 5 || len($msg) > 2000)
                fail("Message must be 5-2000 characters.");

            if (len($ref) > 30)
                fail("Order ID is too long.");

            $conn->prepare(
                "INSERT INTO messages
                (type, name, email, phone, order_ref, subject, message)
                VALUES (?,?,?,?,?,?,?)"
            )->execute([
                $type, $name, $email, $phone, $ref, $subj, $msg
            ]);

            out(["ok" => true]);

        /* ---------- Delete Message ---------- */

        case "message_delete":

            requireAdmin();

            $conn->prepare(
                "DELETE FROM messages WHERE id = ?"
            )->execute([(int)($d["id"] ?? 0)]);

            out(["ok" => true]);

        /* ---------- Add Review ---------- */

        case "review_add":

            $u = requireUser();

            $rating = (int)($d["rating"] ?? 0);
            $comment = str($d, "comment");

            if (
                $rating < 1 || $rating > 5 ||
                len($comment) < 5 || len($comment) > 500
            ) {
                fail("Please give a rating (1-5) and a comment.");
            }

            $conn->prepare(
                "INSERT INTO reviews (user_id, name, rating, comment)
                 VALUES (?,?,?,?)"
            )->execute([
                $u["id"], $u["name"], $rating, $comment
            ]);

            out(["ok" => true]);

        default:
            fail("Unknown action.", 404);
    }

} catch (PDOException $e) {

    if ($conn->inTransaction())
        $conn->rollBack();

    fail("Database error. Please check your database tables and columns.", 500);

} catch (Throwable $e) {

    if ($conn->inTransaction())
        $conn->rollBack();

    fail("Server error. Please try again.", 500);
}
?>