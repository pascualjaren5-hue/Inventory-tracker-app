import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyCToRXT7Q5UG6TSMkq7nM_IlWlANiLGO7o",
  authDomain: "inventory-tracker-c3821.firebaseapp.com",
  projectId: "inventory-tracker-c3821",
  storageBucket: "inventory-tracker-c3821.firebasestorage.app",
  messagingSenderId: "844272003998",
  appId: "1:844272003998:web:1ab34cf5f483132e82c48f",
  measurementId: "G-P2943L9PJ8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = id => document.getElementById(id);

let user = null;
let records = [];
let unsubscribe = null;
let mode = "login";
let toastTimer = null;

// NOTIFICATION
function toast(message) {
  const el = $("toast");

  if (!el) {
    alert(message);
    return;
  }

  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 3000);
}

// PDF REPORT INFORMATION
// Save and load Prepared By and Section using LocalStorage
const preparedByInput = $("preparedBy");
const preparedSectionInput = $("preparedSection");
const saveReportInfoButton = $("saveReportInfo");
const reportInfoMessage = $("reportInfoMessage");

// Load saved report information
if (preparedByInput && preparedSectionInput) {
  preparedByInput.value =
    localStorage.getItem("reportPreparedBy") || "";

  preparedSectionInput.value =
    localStorage.getItem("reportPreparedSection") || "";
}

// Save report information
if (saveReportInfoButton) {
  saveReportInfoButton.addEventListener("click", () => {
    const preparedBy = preparedByInput?.value.trim() || "";
    const preparedSection =
      preparedSectionInput?.value.trim() || "";

    localStorage.setItem("reportPreparedBy", preparedBy);
    localStorage.setItem("reportPreparedSection", preparedSection);

    if (reportInfoMessage) {
      reportInfoMessage.textContent =
        "Report information saved successfully!";

      reportInfoMessage.classList.add("success");
    }

    toast("Report information saved.");
  });
}

// SYNC STATUS
function sync(message) {
  if ($("syncState")) {
    $("syncState").textContent = message;
  }
}

// AUTHENTICATION MESSAGE
function authMessage(message, success = false) {
  if (!$("authMessage")) return;

  $("authMessage").textContent = message;
  $("authMessage").classList.toggle("success", success);
}

// ESCAPE HTML
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// ERROR MESSAGES
function errorText(error) {
  const messages = {
    "auth/invalid-email":
      "Enter a valid email address.",

    "auth/user-not-found":
      "No account found for this email.",

    "auth/wrong-password":
      "Incorrect email or password.",

    "auth/invalid-credential":
      "Incorrect email or password.",

    "auth/email-already-in-use":
      "This email already has an account.",

    "auth/weak-password":
      "Use a password with at least 6 characters.",

    "auth/too-many-requests":
      "Too many attempts. Try again later.",

    "auth/network-request-failed":
      "Network error. Check your connection.",

    "permission-denied":
      "Access denied. Check your Firestore rules."
  };

  return messages[error.code] ||
    error.message ||
    "Something went wrong.";
}

// LOGIN / REGISTER MODE
function setMode(nextMode) {
  mode = nextMode;

  const registering = mode === "register";

  $("loginTab").classList.toggle("active", !registering);
  $("registerTab").classList.toggle("active", registering);

  $("nameLabel").hidden = !registering;
  $("accountName").required = registering;

  $("authSubmit").textContent =
    registering ? "Create Account" : "Login";

  $("forgotPassword").hidden = registering;

  authMessage("");
}

$("loginTab").addEventListener("click", () => {
  setMode("login");
});

$("registerTab").addEventListener("click", () => {
  setMode("register");
});

// AUTHENTICATION STATE
onAuthStateChanged(auth, currentUser => {
  user = currentUser;

  if (currentUser) {
    $("authScreen").hidden = true;
    $("appScreen").hidden = false;

    $("welcomeText").textContent =
      "Welcome" +
      (currentUser.displayName
        ? ", " + currentUser.displayName
        : "");

    listenInventory();
  } else {
    stopListen();

    records = [];

    $("appScreen").hidden = true;
    $("authScreen").hidden = false;

    render();
  }
});

// LOGIN / REGISTRATION FORM
$("authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const button = $("authSubmit");

  button.disabled = true;

  authMessage(
    mode === "register"
      ? "Creating account..."
      : "Signing in..."
  );

  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    if (mode === "register") {
      const name = $("accountName").value.trim();

      if (!name) {
        throw new Error("Enter your full name.");
      }

      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(result.user, {
        displayName: name
      });

      authMessage(
        "Account created successfully.",
        true
      );
    } else {
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      authMessage("Login successful.", true);
    }

    $("authForm").reset();

  } catch (error) {
    authMessage(errorText(error));

  } finally {
    button.disabled = false;
  }
});

// PASSWORD RESET
$("forgotPassword").addEventListener("click", async () => {
  const email = $("email").value.trim();

  if (!email) {
    authMessage("Enter your email address first.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    authMessage(
      "If the email is registered, a reset email will be sent.",
      true
    );

  } catch (error) {
    authMessage(errorText(error));
  }
});

// LOGOUT
$("logoutButton").addEventListener("click", async () => {
  if (!confirm("Log out?")) return;

  try {
    await signOut(auth);

  } catch (error) {
    toast(errorText(error));
  }
});

// FIRESTORE LISTENER
function stopListen() {
  if (unsubscribe) {
    unsubscribe();
  }

  unsubscribe = null;

  sync("Not connected");
}

function listenInventory() {
  if (!user) return;

  stopListen();

  sync("Syncing...");

  unsubscribe = onSnapshot(
    query(
      collection(db, "schoolInventory"),
      orderBy("name")
    ),

    snapshot => {
      records = snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
      }));

      sync("● Cloud synced");

      render();
    },

    error => {
      sync("Sync error");

      toast(errorText(error));

      console.error(
        "Firestore listener error:",
        error
      );
    }
  );
}

// INVENTORY FORM FIELDS
const form = $("equipmentForm");

const fields = {
  id: $("editId"),
  name: $("equipmentName"),
  qty: $("quantity"),
  condition: $("condition"),
  status: $("status"),
  location: $("location")
};

// RESET FORM
function resetForm() {
  form.reset();

  fields.id.value = "";

  $("formTitle").textContent =
    "Add School Equipment";

  $("saveButton").textContent =
    "Save Equipment";

  $("cancelEdit").hidden = true;
}

// SEARCH, FILTER AND SORT
function visibleRecords() {
  const search = $("searchInput")
    .value
    .trim()
    .toLowerCase();

  const status = $("statusFilter").value;
  const sort = $("sortBy").value;

  return records
    .filter(record => {
      const matchesSearch = [
        record.name,
        record.location,
        record.condition,
        record.status
      ].some(value =>
        String(value || "")
          .toLowerCase()
          .includes(search)
      );

      return matchesSearch &&
        (!status || record.status === status);
    })

    .sort((a, b) => {
      if (sort === "quantity") {
        return Number(b.quantity) -
          Number(a.quantity);
      }

      if (sort === "location") {
        return String(a.location || "")
          .localeCompare(
            String(b.location || "")
          );
      }

      if (sort === "status") {
        return String(a.status || "")
          .localeCompare(
            String(b.status || "")
          );
      }

      return String(a.name || "")
        .localeCompare(
          String(b.name || "")
        );
    });
}

// DASHBOARD AND INVENTORY TABLE
function render() {
  if (!$("inventoryBody")) return;

  const rows = visibleRecords();

  $("inventoryBody").innerHTML = rows.map(
    (record, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(record.name)}</td>
        <td>${esc(record.quantity)}</td>
        <td>${esc(record.location)}</td>
        <td>${esc(record.condition)}</td>
        <td>${esc(record.status)}</td>

        <td>
          <div class="action-group">
            <button
              class="action-btn edit-btn"
              data-action="edit"
              data-id="${esc(record.id)}"
              type="button">
              Edit
            </button>

            <button
              class="action-btn delete-btn"
              data-action="delete"
              data-id="${esc(record.id)}"
              type="button">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `
  ).join("");

  $("emptyState").hidden = rows.length > 0;

  $("emptyState").textContent = records.length
    ? "No matching records found."
    : "No equipment records yet. Add your first record above.";

  $("totalRecords").textContent = records.length;

  $("totalQuantity").textContent = records.reduce(
    (total, record) =>
      total + (Number(record.quantity) || 0),
    0
  );

  $("availableCount").textContent =
    records.filter(
      record => record.status === "Available"
    ).length;

  $("attentionCount").textContent =
    records.filter(record =>
      [
        "Under Repair",
        "Missing",
        "Condemned",
        "Disposed"
      ].includes(record.status) ||
      [
        "Damaged",
        "For Repair",
        "Beyond Repair"
      ].includes(record.condition)
    ).length;
}

// ADD OR UPDATE EQUIPMENT
form.addEventListener("submit", async event => {
  event.preventDefault();

  if (!user) {
    toast("Please log in first.");
    return;
  }

  const name = fields.name.value.trim();
  const quantity = Number(fields.qty.value);
  const condition = fields.condition.value;
  const status = fields.status.value;
  const location = fields.location.value.trim();

  if (
    !name ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    !condition ||
    !status ||
    !location
  ) {
    toast(
      "Complete all fields with valid values."
    );

    return;
  }

  const payload = {
    name,
    quantity,
    condition,
    status,
    location,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid
  };

  $("saveButton").disabled = true;

  try {
    if (fields.id.value) {
      await updateDoc(
        doc(
          db,
          "schoolInventory",
          fields.id.value
        ),
        payload
      );

      toast("Record updated in cloud.");

    } else {
      await addDoc(
        collection(db, "schoolInventory"),
        {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid
        }
      );

      toast("Record saved to cloud.");
    }

    resetForm();

  } catch (error) {
    toast(errorText(error));

    console.error("Save error:", error);

  } finally {
    $("saveButton").disabled = false;
  }
});

// EDIT / DELETE EQUIPMENT
$("inventoryBody").addEventListener(
  "click",
  async event => {
    const button = event.target.closest(
      "button[data-action]"
    );

    if (!button) return;

    const record = records.find(
      item => item.id === button.dataset.id
    );

    if (!record) return;

    // EDIT
    if (button.dataset.action === "edit") {
      fields.id.value = record.id;
      fields.name.value = record.name || "";
      fields.qty.value = record.quantity ?? "";
      fields.condition.value = record.condition || "";
      fields.status.value = record.status || "";
      fields.location.value = record.location || "";

      $("formTitle").textContent =
        "Edit School Equipment";

      $("saveButton").textContent =
        "Update Equipment";

      $("cancelEdit").hidden = false;

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });

      return;
    }

    // DELETE
    if (
      button.dataset.action === "delete" &&
      confirm(
        `Delete "${record.name}" from the shared inventory? This cannot be undone.`
      )
    ) {
      try {
        await deleteDoc(
          doc(db, "schoolInventory", record.id)
        );

        toast("Record deleted.");

        if (fields.id.value === record.id) {
          resetForm();
        }

      } catch (error) {
        toast(errorText(error));
      }
    }
  }
);

// CANCEL EDIT
$("cancelEdit").addEventListener(
  "click",
  resetForm
);

// CLEAR FORM
$("clearForm").addEventListener("click", () => {
  resetForm();

  toast("Form cleared.");
});

// SEARCH, FILTER AND SORT EVENTS
[
  "searchInput",
  "statusFilter",
  "sortBy"
].forEach(id => {
  $(id).addEventListener(
    id === "searchInput" ? "input" : "change",
    render
  );
});

// PDF DOWNLOAD BUTTONS
$("downloadPdf").addEventListener(
  "click",
  downloadPdf
);

$("downloadTop").addEventListener(
  "click",
  downloadPdf
);

// DOWNLOAD PDF REPORT
function downloadPdf() {
  if (!records.length) {
    toast("No records to include in the report.");
    return;
  }

  if (!window.jspdf?.jsPDF) {
    toast(
      "PDF library unavailable. Check your internet connection."
    );

    return;
  }

  // Ask for a filename
  const filename = prompt(
    "PDF filename:",
    "School_Equipment_Inventory_Report"
  );

  if (filename === null) return;

  const safeName = filename
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\.pdf$/i, "") ||
    "School_Equipment_Inventory_Report";

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();

  const date = new Date().toLocaleDateString(
    "en-PH",
    {
      year: "numeric",
      month: "long",
      day: "numeric"
    }
  );

  // REPORT TITLE
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);

  pdf.text(
    "SCHOOL EQUIPMENT INVENTORY REPORT",
    width / 2,
    17,
    { align: "center" }
  );

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  pdf.text(
    "School Property and Equipment Inventory",
    width / 2,
    23,
    { align: "center" }
  );

  pdf.text(
    "Date Generated: " + date,
    width / 2,
    28,
    { align: "center" }
  );

  // SORT RECORDS ALPHABETICALLY
  const sortedRecords = [...records].sort(
    (a, b) =>
      String(a.name || "").localeCompare(
        String(b.name || "")
      )
  );

  // CHECK AUTOTABLE
  if (typeof pdf.autoTable !== "function") {
    toast(
      "PDF table library is missing. Check the jsPDF AutoTable script in index.html."
    );

    return;
  }

  // INVENTORY TABLE
  pdf.autoTable({
    startY: 35,

    head: [[
      "#",
      "Equipment Name",
      "Quantity",
      "Condition",
      "Status",
      "Location"
    ]],

    body: sortedRecords.map(
      (record, index) => [
        String(index + 1),
        record.name || "",
        String(record.quantity ?? ""),
        record.condition || "",
        record.status || "",
        record.location || ""
      ]
    ),

    theme: "grid",

    margin: {
      left: 10,
      right: 10,
      top: 12,
      bottom: 16
    },

    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak",
      lineColor: [210, 216, 225],
      lineWidth: 0.2
    },

    headStyles: {
      fillColor: [22, 184, 154],
      textColor: [255, 255, 255]
    },

    alternateRowStyles: {
      fillColor: [246, 249, 252]
    },

    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 60 },
      2: { cellWidth: 20 },
      3: { cellWidth: 45 },
      4: { cellWidth: 45 },
      5: { cellWidth: 75 }
    },

    // PAGE FOOTER
    didDrawPage: () => {
      pdf.setFontSize(7);
      pdf.setTextColor(80, 88, 100);

      pdf.text(
        "School Inventory Tracker",
        10,
        height - 7
      );

      pdf.text(
        "Page " + pdf.internal.getNumberOfPages(),
        width - 10,
        height - 7,
        { align: "right" }
      );
    }
  });

  // PREPARED BY AND SECTION
  // These details appear BELOW the inventory table.
  const preparedBy =
    localStorage.getItem("reportPreparedBy") ||
    user?.displayName ||
    user?.email ||
    "________________";

  const preparedSection =
    localStorage.getItem("reportPreparedSection") ||
    "________________";

  const finalY =
    (pdf.lastAutoTable?.finalY || 35) + 12;

  let signatureY = finalY;

  // ADD A PAGE IF THERE IS NOT ENOUGH SPACE
  if (signatureY + 15 > height - 12) {
    pdf.addPage();

    signatureY = 25;

    pdf.setFontSize(7);
    pdf.setTextColor(80, 88, 100);

    pdf.text(
      "School Inventory Tracker",
      10,
      height - 7
    );

    pdf.text(
      "Page " + pdf.internal.getNumberOfPages(),
      width - 10,
      height - 7,
      { align: "right" }
    );
  }

  // PRINT PREPARED BY
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(40, 45, 55);

  pdf.text(
    "Prepared by: " + preparedBy,
    12,
    signatureY
  );

  pdf.text(
    "Section: " + preparedSection,
    12,
    signatureY + 7
  );

  // SAVE PDF
  pdf.save(safeName + ".pdf");
}