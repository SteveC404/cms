// public/home.js

// ---------- helpers ----------
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  let data = null;
  try {
    data = await res.json();
  } catch (_) {}
  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function $(sel, root = document) {
  return root.querySelector(sel);
}
function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

// ---------- profile / header ----------
async function getProfile() {
  return await fetchJSON("/api/profile");
}

function renderAvatar(user) {
  if (user && user.Photo) {
    return `<img src="/uploads/${user.Photo}" class="avatar" alt="photo">`;
  }
  const fn = (user?.FirstName || "").trim();
  const ln = (user?.LastName || "").trim();
  const initials = (fn[0] || "").toUpperCase() + (ln[0] || "").toUpperCase();
  return `<div class="avatar" style="background:#888;">${initials || "?"}</div>`;
}

async function doLogout() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (_) {
    /* ignore network errors—still go back to login */
  }
  window.location.href = "/";
}

async function renderHeader() {
  try {
    const user = await getProfile();

    // avatar-only trigger (no first/last name text)
    $("#userHeader").innerHTML = `
      <div class="user-menu" id="userMenu">
        <button type="button" class="user-trigger" id="userTrigger" aria-haspopup="true" aria-expanded="false" title="Account">
          ${renderAvatar(user)}
        </button>
        <div class="user-dropdown" id="userDropdown" role="menu" aria-label="Account menu">
          <button type="button" class="menu-item" data-action="edit-self">Edit</button>
          <button type="button" class="menu-item" data-action="logout">Logout</button>
        </div>
      </div>
    `;

    const wrapper = $("#userMenu");
    const trigger = $("#userTrigger");
    const dropdown = $("#userDropdown");

    let closeTimer = null;

    const openMenu = () => {
      clearTimeout(closeTimer);
      dropdown.classList.add("open");
      trigger.setAttribute("aria-expanded", "true");
    };
    const closeMenu = () => {
      dropdown.classList.remove("open");
      trigger.setAttribute("aria-expanded", "false");
    };

    // Start a delayed close when leaving
    const startCloseTimer = () => {
      clearTimeout(closeTimer);
      closeTimer = setTimeout(closeMenu, 1000); // <-- 1 second delay
    };

    // Cancel delayed close if entering again
    const cancelCloseTimer = () => {
      clearTimeout(closeTimer);
    };

    // open on hover
    wrapper.addEventListener("mouseenter", () => {
      cancelCloseTimer();
      openMenu();
    });
    wrapper.addEventListener("mouseleave", startCloseTimer);

    dropdown.addEventListener("mouseenter", cancelCloseTimer);
    dropdown.addEventListener("mouseleave", startCloseTimer);

    // toggle on click (mobile/keyboard friendly)
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      dropdown.classList.contains("open") ? closeMenu() : openMenu();
    });

    // close when clicking away
    document.addEventListener("click", (e) => {
      if (!wrapper.contains(e.target)) closeMenu();
    });

    // menu item actions
    dropdown.addEventListener("click", (e) => {
      const btn = e.target.closest(".menu-item");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "edit-self") {
        showDetailsModal("users", user.Id);
      } else if (action === "logout") {
        doLogout();
      }
      closeMenu();
    });
  } catch (err) {
    console.error("Header render failed:", err);
  }
}

// ---------- lists / tabs ----------
async function renderTab(tab) {
  try {
    const url = tab === "clients" ? "/api/clients" : "/api/users";
    const list = await fetchJSON(url); // must be an array
    if (!Array.isArray(list)) throw new Error("Unexpected response");

    const singular = tab.slice(0, -1);
    let html = `
      <button type="button"
              class="btn-new"
              data-action="new-record"
              data-type="${tab}">
        New ${singular.charAt(0).toUpperCase() + singular.slice(1)}
      </button>
      <table class="list-table">
        <thead>
          <tr><th></th><th>Id</th><th>Last Name</th><th>First Name</th><th>Email</th><th>Active</th></tr>
        </thead>
        <tbody>
    `;

    for (const item of list) {
      html += `
        <tr data-id="${item.Id}">
          <td>
            <button type="button"
                    class="edit-icon"
                    data-action="edit-record"
                    data-type="${tab}"
                    data-id="${item.Id}"
                    aria-label="Edit ${tab === "users" ? "user" : "client"} ${item.Id}">
              &#9998;
            </button>
          </td>
          <td>${item.Id}</td>
          <td>${item.LastName ?? ""}</td>
          <td>${item.FirstName ?? ""}</td>
          <td>${item.Email ?? ""}</td>
          <td>${item.Active ? "Yes" : "No"}</td>
        </tr>
      `;
    }
    html += "</tbody></table>";
    $("#tabContent").innerHTML = html;
  } catch (err) {
    console.error(`Render ${tab} failed:`, err);
    $("#tabContent").innerHTML = `
      <div class="error">Could not load ${tab}. ${err.message || ""}</div>
    `;
  }
}

// ---------- modal / edit ----------
async function showDetailsModal(type, id) {
  const isNew = id === "new";
  const singularTitle = type.slice(0, -1);
  let data = {};
  if (!isNew) {
    try {
      data = await fetchJSON(`/api/${type}/${id}`);
    } catch (err) {
      console.error("Load details failed:", err);
      return;
    }
  }

  const fields =
    type === "clients"
      ? [
          "FirstName",
          "LastName",
          "Email",
          "Active",
          "Comments",
          "Phone",
          "Address",
          "City",
          "State",
          "Zip",
          "Country",
          "DateOfBirth",
          "Gender",
          "Password",
          "Password2",
        ]
      : [
          "FirstName",
          "LastName",
          "Email",
          "Active",
          "Comments",
          "Password",
          "Password2",
        ];

  // avatar / thumb
  let initials = "";
  if (data.FirstName && data.LastName)
    initials = (data.FirstName[0] + data.LastName[0]).toUpperCase();
  let thumbHtml = "";
  if (data.Photo) {
    thumbHtml = `<div style='text-align:center;margin-bottom:12px;'>
      <img id='photoThumb' src='/uploads/${data.Photo}' alt='photo'
           style='width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #ccc;cursor:pointer;' title='Change photo'>
    </div>`;
  } else {
    const inner = initials
      ? `<div id='photoThumb' style='width:64px;height:64px;border-radius:50%;background:#888;color:#fff;display:flex;align-items:center;justify-content:center;font-size:2em;font-weight:bold;margin:0 auto 12px auto;cursor:pointer;' title='Change photo'>${initials}</div>`
      : `<div id='photoThumb' style='width:64px;height:64px;border-radius:50%;background:#888;cursor:pointer;' title='Change photo'></div>`;
    thumbHtml = inner;
  }

  let html = `<div class="modal-content"><h3>${isNew ? "New " : ""}${singularTitle.charAt(0).toUpperCase() + singularTitle.slice(1)} Details</h3>`;
  html += thumbHtml;
  html += `<form id="detailsForm" enctype="multipart/form-data">`;
  html += `<input type="file" id="photoInput" name="photo" style="display:none">`;

  for (const f of fields) {
    if (f === "Password" || f === "Password2") {
      html += `<input type="password" name="${f}" placeholder="${f === "Password" ? "New Password" : "Repeat Password"}"><br>`;
    } else if (f === "Active") {
      html += `<label>Active <input type="checkbox" name="Active" ${data.Active ? "checked" : ""}></label><br>`;
    } else if (f === "DateOfBirth") {
      let dob = data.DateOfBirth || "";
      if (dob && dob.length > 10) dob = dob.slice(0, 10);
      html += `<label>Date of Birth <input type="date" name="DateOfBirth" value="${dob}"></label><br>`;
    } else if (f === "Gender") {
      const gender = (data.Gender || "").toLowerCase();
      html += `<label>Gender <select name="Gender">
        <option value=""${!gender ? " selected" : ""}>Select</option>
        <option value="Male"${gender === "male" ? " selected" : ""}>Male</option>
        <option value="Female"${gender === "female" ? " selected" : ""}>Female</option>
        <option value="Other"${gender === "other" ? " selected" : ""}>Other</option>
      </select></label><br>`;
    } else {
      html += `<input type="text" name="${f}" value="${(data[f] ?? "").toString().replace(/"/g, "&quot;")}" placeholder="${f}"><br>`;
    }
  }

  html += `<button type="button" id="saveBtn">Save</button>
           <button type="button" id="closeBtn">Close</button>
           <div id="detailsError" class="error" role="alert" aria-live="polite"></div>
           </form></div>`;

  // global toast once
  if (!$("#globalNotification")) {
    const notif = document.createElement("div");
    notif.id = "globalNotification";
    Object.assign(notif.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#28a745",
      color: "#fff",
      padding: "12px 32px",
      borderRadius: "8px",
      fontSize: "1.1em",
      boxShadow: "0 2px 8px #aaa",
      zIndex: "9999",
      display: "none",
    });
    document.body.appendChild(notif);
  }

  $("#detailsModal").innerHTML = html;
  $("#detailsModal").style.display = "flex";

  // photo picker
  const thumb = $("#photoThumb");
  const input = $("#photoInput");
  if (thumb && input) {
    thumb.addEventListener("click", () => input.click());
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          if (thumb.tagName === "IMG") {
            thumb.src = e.target.result;
          } else {
            thumb.textContent = "";
            thumb.style.background = `url('${e.target.result}') center/cover`;
          }
        };
        reader.readAsDataURL(input.files[0]);
      }
    });
  }

  // dirty tracking
  let dirty = false;
  const form = $("#detailsForm");
  form.addEventListener("input", () => {
    dirty = true;
  });
  form.addEventListener("change", () => {
    dirty = true;
  });

  // save
  $("#saveBtn").addEventListener("click", async () => {
    const formData = new FormData(form);
    // normalize Active checkbox to boolean-ish
    formData.set("Active", form.Active?.checked ? "true" : "false");

    const endpoint = isNew ? `/api/${type}` : `/api/${type}/${id}`;
    const method = isNew ? "POST" : "PUT"; // backend supports both, but use canonical
    const errorDiv = $("#detailsError");
    errorDiv.textContent = "";

    try {
      const res = await fetch(endpoint, { method, body: formData });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.error)
        throw new Error(result.error || "Failed to save record.");

      dirty = false;
      const notif = $("#globalNotification");
      notif.textContent = "Record saved successfully";
      notif.style.display = "block";
      setTimeout(() => {
        notif.style.display = "none";
      }, 3000);

      closeModal();
      await renderTab(type);

      // if user updated own profile, refresh header
      if (type === "users" && !isNew) {
        try {
          const me = await getProfile();
          if (me && me.Id === Number(id)) await renderHeader();
        } catch {}
      }
    } catch (err) {
      errorDiv.textContent = err.message || "Network error. Please try again.";
    }
  });

  // close
  $("#closeBtn").addEventListener("click", () => {
    if (dirty && !confirm("You have unsaved changes. Close without saving?")) {
      return;
    }
    closeModal();
  });
}

function closeModal() {
  $("#detailsModal").style.display = "none";
}

// ---------- tabs ----------
$all(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    $all(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderTab(btn.dataset.tab);
  });
});

// default tab
(async () => {
  await renderHeader();
  const first = $(".tab");
  if (first) first.classList.add("active");
  await renderTab("clients");
})();

// ---------- delegated clicks (CSP-safe) ----------
document.addEventListener("click", (e) => {
  const editBtn = e.target.closest('[data-action="edit-record"]');
  if (editBtn) {
    e.preventDefault();
    const id = Number(editBtn.dataset.id);
    const type = editBtn.dataset.type;
    if (type && Number.isFinite(id)) showDetailsModal(type, id);
    return;
  }

  const newBtn = e.target.closest('[data-action="new-record"]');
  if (newBtn) {
    e.preventDefault();
    const type = newBtn.dataset.type;
    if (type) showDetailsModal(type, "new");
    return;
  }
});
