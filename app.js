// ============================================================
// app.js
// Firebase Authentication + Firestore for Teacher Portal
// ============================================================

// ── 1. Import only the Firebase pieces we need ──────────────
import { initializeApp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// ── 2. Your Firebase project config ─────────────────────────
//    Replace all values with your own from Firebase Console
//    → Project Settings → Your apps → SDK setup
const firebaseConfig = {
  apiKey: "AIzaSyAYYWDvA6oW1koM2UAWEP6LvwmjOdFCGv0",
  authDomain: "school-teacher-app-f40e1.firebaseapp.com",
  projectId: "school-teacher-app-f40e1",
  storageBucket: "school-teacher-app-f40e1.firebasestorage.app",
  messagingSenderId: "848550061471",
  appId: "1:848550061471:web:2ad245cc486e9c50bec9aa"
};
};

// ── 3. Initialize Firebase services ─────────────────────────
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);


// ============================================================
// DOM REFERENCES
// ============================================================

// Pages
const loginPage     = document.getElementById("loginPage");
const dashboardPage = document.getElementById("dashboardPage");

// Login form elements
const loginForm     = document.getElementById("loginForm");
const emailInput    = document.getElementById("email");
const passInput     = document.getElementById("password");
const loginMessage  = document.getElementById("loginMessage");
const loginBtn      = document.getElementById("loginBtn");
const btnText       = document.getElementById("btnText");
const btnSpinner    = document.getElementById("btnSpinner");

// Dashboard elements
const teacherEmailSpan = document.getElementById("teacherEmail");
const logoutBtn        = document.getElementById("logoutBtn");

// Add-student elements
const studentNameInput = document.getElementById("studentName");
const addStudentBtn    = document.getElementById("addStudentBtn");
const studentMessage   = document.getElementById("studentMessage");

// Add-score elements
const studentSelect  = document.getElementById("studentSelect");
const scoreInput     = document.getElementById("scoreInput");
const subjectInput   = document.getElementById("subjectInput");
const addScoreBtn    = document.getElementById("addScoreBtn");
const scoreMessage   = document.getElementById("scoreMessage");

// Student list display
const studentListDiv = document.getElementById("studentList");


// ============================================================
// UTILITY HELPERS
// ============================================================

// Show a message inside a message box element
// type: "success" | "error" | "info"
function showMsg(element, text, type) {
  element.textContent = text;
  element.className   = `message ${type}`;
  element.classList.remove("hidden");
  // Auto-hide after 4 seconds
  setTimeout(() => element.classList.add("hidden"), 4000);
}

// Show/hide the login button spinner
function setLoading(isLoading) {
  loginBtn.disabled       = isLoading;
  btnText.textContent     = isLoading ? "Signing in…" : "Sign In";
  btnSpinner.classList.toggle("hidden", !isLoading);
}

// Friendly error messages for Firebase auth error codes
function friendlyAuthError(code) {
  const map = {
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/user-not-found":         "No teacher account found with this email.",
    "auth/wrong-password":         "Incorrect password. Please try again.",
    "auth/invalid-credential":     "Invalid email or password.",
    "auth/too-many-requests":      "Too many attempts. Please wait and try again.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/user-disabled":          "This account has been disabled."
  };
  return map[code] || "Login failed. Please try again.";
}

// Show or hide a full page
function showPage(pageEl) {
  loginPage.classList.add("hidden");
  dashboardPage.classList.add("hidden");
  pageEl.classList.remove("hidden");
}


// ============================================================
// AUTH: WATCH LOGIN STATE
// Runs automatically whenever the user logs in or out.
// This is the main "router" — it decides which page to show.
// ============================================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    // ✅ User is logged in — show dashboard
    teacherEmailSpan.textContent = user.email;
    showPage(dashboardPage);
    loadStudents();   // start listening to Firestore
  } else {
    // ❌ No user — show login page
    showPage(loginPage);
  }
});


// ============================================================
// AUTH: LOGIN
// ============================================================
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();   // prevent page reload

  const email    = emailInput.value.trim();
  const password = passInput.value;

  if (!email || !password) {
    showMsg(loginMessage, "Please fill in both fields.", "error");
    return;
  }

  setLoading(true);
  loginMessage.classList.add("hidden");

  try {
    // Try to sign in with Firebase Authentication
    await signInWithEmailAndPassword(auth, email, password);
    // onAuthStateChanged above will handle the redirect automatically
  } catch (err) {
    console.error("Login error:", err.code);
    showMsg(loginMessage, friendlyAuthError(err.code), "error");
    setLoading(false);
  }
});


// ============================================================
// AUTH: LOGOUT
// ============================================================
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  // onAuthStateChanged will show login page automatically
});


// ============================================================
// FIRESTORE: ADD A STUDENT
// Stores: { name, scores: [], createdAt }
// ============================================================
addStudentBtn.addEventListener("click", async () => {
  const name = studentNameInput.value.trim();

  if (!name) {
    showMsg(studentMessage, "Please enter a student name.", "error");
    return;
  }

  try {
    // Add a new document to the "students" collection
    await addDoc(collection(db, "students"), {
      name:      name,
      scores:    [],          // empty array; scores added later
      createdAt: new Date()
    });

    showMsg(studentMessage, `✅ "${name}" added successfully!`, "success");
    studentNameInput.value = "";   // clear input

  } catch (err) {
    console.error("Add student error:", err);
    showMsg(studentMessage, "Failed to add student. Try again.", "error");
  }
});


// ============================================================
// FIRESTORE: ADD A SCORE TO A STUDENT
// Appends { subject, score, date } to the student's scores array
// ============================================================
addScoreBtn.addEventListener("click", async () => {
  const studentId = studentSelect.value;
  const score     = parseInt(scoreInput.value);
  const subject   = subjectInput.value.trim();

  // Validate inputs
  if (!studentId) {
    showMsg(scoreMessage, "Please select a student.", "error");
    return;
  }
  if (isNaN(score) || score < 0 || score > 100) {
    showMsg(scoreMessage, "Please enter a valid score between 0 and 100.", "error");
    return;
  }
  if (!subject) {
    showMsg(scoreMessage, "Please enter a subject.", "error");
    return;
  }

  try {
    // Update the student's document: push a new score into the scores array
    const studentRef = doc(db, "students", studentId);
    await updateDoc(studentRef, {
      scores: arrayUnion({
        subject: subject,
        score:   score,
        date:    new Date().toLocaleDateString()
      })
    });

    showMsg(scoreMessage, `✅ Score added for ${subject}!`, "success");
    scoreInput.value   = "";
    subjectInput.value = "";

  } catch (err) {
    console.error("Add score error:", err);
    showMsg(scoreMessage, "Failed to add score. Try again.", "error");
  }
});


// ============================================================
// FIRESTORE: LOAD & DISPLAY STUDENTS (REAL-TIME)
// onSnapshot listens for live updates — page refreshes itself
// ============================================================
function loadStudents() {
  // Query students ordered by creation date
  const q = query(collection(db, "students"), orderBy("createdAt", "asc"));

  // onSnapshot fires immediately and again on every change
  onSnapshot(q, (snapshot) => {
    // Clear previous content
    studentListDiv.innerHTML = "";
    studentSelect.innerHTML  = `<option value="">-- Select a student --</option>`;

    if (snapshot.empty) {
      studentListDiv.innerHTML = `<p class="empty-note">No students added yet.</p>`;
      return;
    }

    // Loop through each student document
    snapshot.forEach((docSnap) => {
      const id      = docSnap.id;
      const student = docSnap.data();

      // ── Add to dropdown ──────────────────────────────────
      const option = document.createElement("option");
      option.value       = id;
      option.textContent = student.name;
      studentSelect.appendChild(option);

      // ── Calculate average score ──────────────────────────
      const scores = student.scores || [];
      let avgText  = "No scores yet";

      if (scores.length > 0) {
        const total = scores.reduce((sum, s) => sum + s.score, 0);
        const avg   = (total / scores.length).toFixed(1);
        avgText     = `Avg: ${avg}%`;
      }

      // ── Build score pills ────────────────────────────────
      const scorePills = scores.map(s =>
        `<li class="score-pill">${s.subject}: ${s.score}%</li>`
      ).join("");

      // ── Build student card HTML ──────────────────────────
      const card = document.createElement("div");
      card.className = "student-card";
      card.innerHTML = `
        <div class="student-card-header">
          <span class="student-card-name">👤 ${student.name}</span>
          <span class="student-card-avg">${avgText}</span>
        </div>
        <ul class="score-list">
          ${scorePills || "<li style='color:#9ca3af;font-size:0.85rem'>No scores recorded</li>"}
        </ul>
      `;

      studentListDiv.appendChild(card);
    });
  });
}
```

---

### Quick Setup Checklist

**Firebase Console steps (do these first):**

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project
2. **Authentication** → Sign-in method → Enable **Email/Password**
3. **Firestore Database** → Create database → Start in **test mode**
4. **Project Settings** → Your apps → Register a Web app → copy the `firebaseConfig` values into `app.js`
5. **Authentication** → Users → Add user → enter your teacher email + password (only people you add here can log in)

**Firestore Security Rules (paste this in Firestore → Rules tab):**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /students/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```
This ensures only logged-in teachers can read or write student data.

**File structure in your GitHub repo:**
```
index.html
style.css
app.js
