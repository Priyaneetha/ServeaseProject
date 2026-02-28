const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");

const app = express();

// ==========================
// MIDDLEWARE
// ==========================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: "supersecretkey",
  resave: false,
  saveUninitialized: false
}));

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.static("public"));


// ==========================
// DATABASE CONNECTION
// ==========================

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "student",
  database: "serviceconnect"
});

db.connect(err => {
  if (err) {
    console.error("MySQL Connection Error:", err.message);
  } else {
    console.log("MySQL Connected");

    const userTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('user','provider','admin') DEFAULT 'user'
      ) ENGINE=InnoDB
    `;

    const providerTable = `
      CREATE TABLE IF NOT EXISTS providers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        service VARCHAR(255),
        location VARCHAR(255),
        phone VARCHAR(50),
        description TEXT,
        owner_id INT,
        status ENUM('pending','approved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `;

    db.query(userTable);
    db.query(providerTable);
  }
});


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

app.post("/register", (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role)
    return res.send("All fields required");

  db.query(
    "INSERT INTO users (email,password,role) VALUES (?,?,?)",
    [email, password, role],
    (err) => {
      if (err) return res.send("User already exists");
      res.redirect("/login");
    }
  );
});


// ==========================
// LOGIN
// ==========================

app.get("/login", (req, res) => {
  res.render("login", { error: req.query.error });
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email=? AND password=?",
    [email, password],
    (err, result) => {

      if (err) return res.send("Database error");

      if (!result || result.length === 0)
        return res.redirect("/login?error=Invalid%20credentials");

      req.session.user = result[0];

      if (result[0].role === "admin")
        return res.redirect("/admin");

      if (result[0].role === "provider")
        return res.redirect("/provider-dashboard");

      res.redirect("/services");
    }
  );
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
// SERVICES (PUBLIC)
// ==========================

app.get("/services", (req, res) => {

  const search = req.query.search ? req.query.search.trim() : "";
  const location = req.query.location ? req.query.location.trim() : "";

  let sql = "SELECT * FROM providers WHERE status='approved'";
  const params = [];

  // Filter by service name
  if (search !== "") {
    sql += " AND service LIKE ?";
    params.push(`%${search}%`);
  }

  // Filter by location
  if (location !== "") {
    sql += " AND location LIKE ?";
    params.push(`%${location}%`);
  }

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error(err);
      return res.send("Database error");
    }

    res.render("services", {
      providers: results,
      user: req.session.user,
      search,
      location
    });
  });
});


// ==========================
// PROVIDER DASHBOARD
// ==========================

app.get("/provider-dashboard", requireProvider, (req, res) => {

  db.query(
    "SELECT * FROM providers WHERE owner_id=?",
    [req.session.user.id],
    (err, results) => {

      if (err) return res.send("Error loading dashboard");

      res.render("provider-dashboard", {
        listings: results,
        user: req.session.user
      });
    }
  );
});


// Submit provider listing
app.post("/submit-provider", requireProvider, (req, res) => {

  const { name, service, location, phone, description } = req.body;

  if (!name || !service || !location || !phone)
    return res.send("All fields required");

  db.query(
    `INSERT INTO providers 
     (name, service, location, phone, description, owner_id, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [name, service, location, phone, description, req.session.user.id],
    (err) => {
      if (err) return res.send("Error submitting provider");
      res.redirect("/provider-dashboard");
    }
  );
});


// ==========================
// ADMIN PANEL
// ==========================

app.get("/admin", requireAdmin, (req, res) => {

  db.query(
    "SELECT * FROM providers WHERE status='pending'",
    (err, results) => {

      if (err) return res.send("Error loading admin panel");

      res.render("admin", {
        providers: results,
        user: req.session.user
      });
    }
  );
});


// Approve provider
app.post("/approve/:id", requireAdmin, (req, res) => {

  db.query(
    "UPDATE providers SET status='approved' WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.send("Approval failed");
      res.redirect("/admin");
    }
  );
});


// Reject provider
app.post("/reject/:id", requireAdmin, (req, res) => {

  db.query(
    "DELETE FROM providers WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.send("Reject failed");
      res.redirect("/admin");
    }
  );
});


// ==========================
// START SERVER
// ==========================

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});