<?php

require "db.php";

if ($_SERVER["REQUEST_METHOD"] == "POST") {

    function back($msg) { header("Location: register.html?error=" . urlencode($msg)); exit(); }

    $name = trim($_POST["name"]);
    $email = strtolower(trim($_POST["email"]));
    $phone = trim($_POST["phone"]);
    $password = $_POST["password"];
    $confirm_password = $_POST["confirm_password"];

    if (strlen($name) < 2 || strlen($name) > 100) {
        back("Name must be 2-100 characters.");
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        back("Enter a valid email address.");
    }

    if (strlen($password) < 4) {
        back("Password must be at least 4 characters.");
    }

    if ($password !== $confirm_password) {
        back("Passwords do not match.");
    }

    $check = $conn->prepare(
        "SELECT id FROM users WHERE email = ?"
    );

    $check->execute([$email]);

    if ($check->rowCount() > 0) {
        back("An account with this email already exists.");
    }

    $password_hash = password_hash(
        $password,
        PASSWORD_DEFAULT
    );

    $sql = "INSERT INTO users
            (name, email, phone, password_hash)
            VALUES (?, ?, ?, ?)";

    $stmt = $conn->prepare($sql);

    $stmt->execute([
        $name,
        $email,
        $phone,
        $password_hash
    ]);

    header("Location: login.html?registered=1");
    exit();

} else {
    echo "Please submit the registration form.";
}

?>