// =============================
// FIREBASE IMPORTS
// =============================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// =============================
// FIREBASE CONFIG
// =============================

const firebaseConfig = {
  apiKey: "AIzaSyCinPRgsZhbOuURYGapkCLJTzXxoFu1dok",
  authDomain: "servease-63bbb.firebaseapp.com",
  projectId: "servease-63bbb",
  storageBucket: "servease-63bbb.firebasestorage.app",
  messagingSenderId: "516296923777",
  appId: "1:516296923777:web:cc16bf6a3acb2a49cb8b80",
  measurementId: "G-CJSQKQY88Y"
};


// =============================
// INITIALIZE
// =============================

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// =============================
// SIGNUP
// =============================

const signupForm = document.getElementById("signupForm");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = Object.fromEntries(new FormData(signupForm));

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      await setDoc(doc(db, "users", userCredential.user.uid), {
        email: formData.email,
        role: formData.role
      });

      alert("Signup successful");
      window.location.href = "login.html";

    } catch (error) {
      alert(error.message);
    }
  });
}


// =============================
// LOGIN
// =============================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const formData = Object.fromEntries(new FormData(loginForm));

    try {
      await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      // No redirect here

    } catch (error) {
      alert(error.message);
    }
  });
}


// =============================
// LOGOUT
// =============================

window.logout = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};


/// =============================
// AUTH STATE LISTENER
// =============================

onAuthStateChanged(auth, async (user) => {

  const path = window.location.pathname;

  const loginLink = document.getElementById("loginLink");
  const logoutBtn = document.getElementById("logoutBtn");
  const userInfo = document.getElementById("userInfo");

  // NOT LOGGED IN
  if (!user) {

    loginLink?.classList.remove("hidden");
    logoutBtn?.classList.add("hidden");
    userInfo?.classList.add("hidden");

    if (!path.includes("login") && !path.includes("signup")) {
      window.location.href = "login.html";
    }

    return;
  }

  // LOGGED IN — Show Navbar Info
  loginLink?.classList.add("hidden");
  logoutBtn?.classList.remove("hidden");
  userInfo?.classList.remove("hidden");
  userInfo.textContent = user.email.split("@")[0];

  // If on login/signup page → redirect by role
  if (path.includes("login") || path.includes("signup")) {

    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (!docSnap.exists()) return;

    const role = docSnap.data().role;

    if (role === "admin") {
        window.location.href = "admin.html";
    } else if (role === "provider") {
        window.location.href = "provider-dashboard.html";
    } else {
        window.location.href = "services.html";
    }

    return;
  }

  // Protect pages
  const docSnap = await getDoc(doc(db, "users", user.uid));
  if (!docSnap.exists()) return;

  const role = docSnap.data().role;

  if (path.includes("admin") && role !== "admin") {
    window.location.href = "services.html";
  }

  if (path.includes("provider-dashboard") && role !== "provider") {
    window.location.href = "services.html";
  }

});
function setupProviderSubmit(user) {

  const form = document.getElementById("providerSubmitForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = Object.fromEntries(new FormData(form));

    try {
      await addDoc(collection(db, "providers"), {
        ...data,
        ownerId: user.uid,
        status: "pending",
        createdAt: serverTimestamp()
      });

      alert("Submitted for admin approval!");
      form.reset();

    } catch (error) {
      alert(error.message);
    }
  });
}