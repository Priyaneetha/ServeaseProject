require("dotenv").config();

const express = require("express");
const session = require("express-session");
const { Pool } = require("pg");

const app = express();

// ==========================
// MIDDLEWARE
// ==========================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "supersecretkey",
  resave: false,
  saveUninitialized: false
}));

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.static("public"));


// ==========================
// DATABASE CONNECTION (NEON)
// ==========================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect()
  .then(() => console.log("Connected to Neon DB"))
  .catch(err => console.error("Neon Connection Error:", err.message));


// ==========================
// CREATE TABLES
// ==========================

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS providers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255),
      service VARCHAR(255),
      location VARCHAR(255),
      phone VARCHAR(50),
      description TEXT,
      owner_id INT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
})();


// ==========================
// AUTH MIDDLEWARE
// ==========================

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin")
    return res.redirect("/login");
  next();
}

function requireProvider(req, res, next) {
  if (!req.session.user || req.session.user.role !== "provider")
    return res.redirect("/login");
  next();
}


// ==========================
// HOME
// ==========================

app.get("/", (req, res) => {
  res.render("index", { user: req.session.user });
});


// ==========================
// REGISTER
// ==========================

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/register", async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role)
    return res.send("All fields required");

  try {
    await pool.query(
      "INSERT INTO users (email,password,role) VALUES ($1,$2,$3)",
      [email, password, role]
    );
    res.redirect("/login");
  } catch (err) {
    console.error(err);
    res.send("User already exists");
  }
});


// ==========================
// LOGIN
// ==========================

app.get("/login", (req, res) => {
  res.render("login", { error: req.query.error });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1 AND password=$2",
      [email, password]
    );

    if (result.rows.length === 0)
      return res.redirect("/login?error=Invalid%20credentials");

    req.session.user = result.rows[0];

    if (result.rows[0].role === "admin")
      return res.redirect("/admin");

    if (result.rows[0].role === "provider")
      return res.redirect("/provider-dashboard");

    res.redirect("/services");

  } catch (err) {
    console.error(err);
    res.send("Database error");
  }
});


// ==========================
// LOGOUT
// ==========================

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});


// ==========================
// SERVICES
// ==========================

app.get("/services", async (req, res) => {

  const search = req.query.search?.trim() || "";
  const location = req.query.location?.trim() || "";

  let sql = "SELECT * FROM providers WHERE status='approved'";
  const params = [];

  if (search !== "") {
    params.push(`%${search}%`);
    sql += ` AND service ILIKE $${params.length}`;
  }

  if (location !== "") {
    params.push(`%${location}%`);
    sql += ` AND location ILIKE $${params.length}`;
  }

  try {
    const result = await pool.query(sql, params);

    res.render("services", {
      providers: result.rows,
      user: req.session.user,
      search,
      location
    });

  } catch (err) {
    console.error(err);
    res.send("Database error");
  }
});


// ==========================
// PROVIDER DASHBOARD
// ==========================

app.get("/provider-dashboard", requireProvider, async (req, res) => {

  try {
    const result = await pool.query(
      "SELECT * FROM providers WHERE owner_id=$1",
      [req.session.user.id]
    );

    res.render("provider-dashboard", {
      listings: result.rows,
      user: req.session.user
    });

  } catch (err) {
    console.error(err);
    res.send("Error loading dashboard");
  }
});


// Submit provider
app.post("/submit-provider", requireProvider, async (req, res) => {

  const { name, service, location, phone, description } = req.body;

  if (!name || !service || !location || !phone)
    return res.send("All fields required");

  try {
    await pool.query(
      `INSERT INTO providers
       (name, service, location, phone, description, owner_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
      [name, service, location, phone, description, req.session.user.id]
    );

    res.redirect("/provider-dashboard");

  } catch (err) {
    console.error(err);
    res.send("Error submitting provider");
  }
});


// ==========================
// ADMIN PANEL
// ==========================

app.get("/admin", requireAdmin, async (req, res) => {

  try {
    const result = await pool.query(
      "SELECT * FROM providers WHERE status='pending'"
    );

    res.render("admin", {
      providers: result.rows,
      user: req.session.user
    });

  } catch (err) {
    console.error(err);
    res.send("Error loading admin panel");
  }
});


// Approve
app.post("/approve/:id", requireAdmin, async (req, res) => {
  await pool.query(
    "UPDATE providers SET status='approved' WHERE id=$1",
    [req.params.id]
  );
  res.redirect("/admin");
});


// Reject
app.post("/reject/:id", requireAdmin, async (req, res) => {
  await pool.query(
    "DELETE FROM providers WHERE id=$1",
    [req.params.id]
  );
  res.redirect("/admin");
});


// ==========================
// START SERVER
// ==========================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});