// ==========================
// INITIAL STORAGE SETUP
// ==========================

if (!localStorage.getItem("users"))
  localStorage.setItem("users", JSON.stringify([]));

if (!localStorage.getItem("providers"))
  localStorage.setItem("providers", JSON.stringify([]));


// ==========================
// AUTH CHECK
// ==========================

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("currentUser"));
}

function checkAuth() {
  const user = getCurrentUser();
  const path = window.location.pathname;

  if (!user && !path.includes("login") && !path.includes("signup")) {
    window.location.href = "login.ejs";
  }

  if (user && (path.includes("login") || path.includes("signup"))) {
    redirectByRole(user);
  }
}

checkAuth();


// ==========================
// NAVBAR CONTROL
// ==========================

const loginLink = document.getElementById("loginLink");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");

const user = getCurrentUser();

if (user) {
  if (loginLink) loginLink.style.display = "none";
  if (logoutBtn) logoutBtn.style.display = "inline-block";
  if (userInfo) {
    userInfo.style.display = "inline-block";
    userInfo.textContent = user.email.split("@")[0];
  }
}


// ==========================
// SIGNUP
// ==========================

const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(signupForm));
    const users = JSON.parse(localStorage.getItem("users"));

    if (users.find(u => u.email === data.email)) {
      alert("User already exists");
      return;
    }

    users.push(data);
    localStorage.setItem("users", JSON.stringify(users));

    alert("Signup successful");
    window.location.href = "login.html";
  });
}


// ==========================
// LOGIN
// ==========================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(loginForm));
    const users = JSON.parse(localStorage.getItem("users"));

    const found = users.find(
      u => u.email === data.email && u.password === data.password
    );

    if (!found) {
      alert("Invalid credentials");
      return;
    }

    localStorage.setItem("currentUser", JSON.stringify(found));
    redirectByRole(found);
  });
}

function redirectByRole(user) {
  if (user.role === "admin")
    window.location.href = "admin.html";
  else if (user.role === "provider")
    window.location.href = "provider-dashboard.html";
  else
    window.location.href = "services.html";
}


// ==========================
// LOGOUT
// ==========================

function logout() {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
}

// ==========================
// PROVIDER SUBMISSION
// ==========================

const providerForm = document.getElementById("providerSubmitForm");

if (providerForm) {
  providerForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(providerForm));
    const providers = JSON.parse(localStorage.getItem("providers"));
    const user = getCurrentUser();

    data.id = Date.now();
    data.status = "pending";
    data.ownerEmail = user.email;

    providers.push(data);
    localStorage.setItem("providers", JSON.stringify(providers));

    alert("Submitted for approval");
    providerForm.reset();
  });
}


// ==========================
// ADMIN APPROVAL
// ==========================

function loadPending() {
  const list = document.getElementById("pendingList");
  if (!list) return;

  const providers = JSON.parse(localStorage.getItem("providers"))
    .filter(p => p.status === "pending");

  list.innerHTML = "";

  providers.forEach(p => {
    list.innerHTML += `
      <div>
        <h4>${p.name}</h4>
        <button onclick="approve(${p.id})">Approve</button>
      </div>
    `;
  });
}

function approve(id) {
  let providers = JSON.parse(localStorage.getItem("providers"));

  providers = providers.map(p => {
    if (p.id === id) p.status = "approved";
    return p;
  });

  localStorage.setItem("providers", JSON.stringify(providers));
  loadPending();
}

loadPending();


// ==========================
// LOAD APPROVED SERVICES
// ==========================

function loadServices() {
  const list = document.getElementById("serviceList");
  if (!list) return;

  const providers = JSON.parse(localStorage.getItem("providers"))
    .filter(p => p.status === "approved");

  list.innerHTML = "";

  providers.forEach(p => {
    list.innerHTML += `
      <div>
        <h3>${p.name}</h3>
        <p>${p.service}</p>
        <p>${p.location}</p>
        <p>${p.phone}</p>
      </div>
    `;
  });
}

loadServices();

// Expose functions to the global window so inline handlers work
// when this script is loaded with `type="module"` in some pages.
if (typeof window !== "undefined") {
  window.logout = logout;
  window.approve = approve;
  window.loadPending = loadPending;
  window.loadServices = loadServices;
}