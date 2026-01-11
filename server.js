const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const session = require("express-session");
const cors = require("cors");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(express.json());

app.use(cors({
    origin: "http://127.0.0.1:5500", // frontend
    credentials: true
}));

app.use(session({
    secret: "music_secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false // must be false for Render free
    }
}));

/* ================= DATABASE ================= */
/*
⚠️ IMPORTANT
Local MySQL WILL NOT WORK on Render
This config uses ENV variables
*/

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect(err => {
    if (err) {
        console.error("Database connection failed:", err.message);
    } else {
        console.log("MySQL Connected");
    }
});

/* ================= REGISTER ================= */
app.post("/register", async (req, res) => {
    let { username, email, password } = req.body;

    username = username?.trim();
    email = email?.trim();

    if (!username || username.length < 3) {
        return res.status(400).send("Username must be at least 3 characters");
    }

    if (!email || !email.includes("@")) {
        return res.status(400).send("Enter a valid email address");
    }

    if (!password || password.length < 6) {
        return res.status(400).send("Password must be at least 6 characters");
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
            "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
            [username, email, hashedPassword],
            err => {
                if (err) {
                    if (err.code === "ER_DUP_ENTRY") {
                        return res.status(409).send("Email already registered");
                    }
                    return res.status(500).send("Database error");
                }
                res.send("Registration successful");
            }
        );
    } catch {
        res.status(500).send("Server error");
    }
});

/* ================= LOGIN ================= */
app.post("/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send("All fields are required");
    }

    db.query(
        "SELECT * FROM users WHERE email = ?",
        [email],
        async (err, result) => {
            if (result.length === 0) {
                return res.status(401).send("Invalid email or password");
            }

            const match = await bcrypt.compare(password, result[0].password);
            if (!match) {
                return res.status(401).send("Invalid email or password");
            }

            req.session.user = {
                id: result[0].id,
                username: result[0].username,
                email: result[0].email
            };

            res.send("Login successful");
        }
    );
});

/* ================= AUTH CHECK ================= */
app.get("/auth", (req, res) => {
    if (req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).send("Unauthorized");
    }
});

/* ================= LOGOUT ================= */
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.send("Logged out");
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
