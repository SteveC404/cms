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

function ensureNotification() {
  let notif = document.getElementById("globalNotification");
  if (!notif) {
    notif = document.createElement("div");
    notif.id = "globalNotification";
    Object.assign(notif.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#28a745",
      color: "#fff",
      padding: "8px 24px",
      borderRadius: "6px",
      zIndex: 9999,
      display: "none",
    });
    document.body.appendChild(notif);
  }
  return notif;
}

function closeModal() {
  const modal = $("#detailsModal");
  if (modal) {
    modal.style.display = "none";
    modal.innerHTML = "";
  }
}

// ---------- profile / header ----------
async function getProfile() {
  return await fetchJSON("/api/profile");
}

function renderAvatar(user) {
  if (user && user.Photo) {
    const tenantId = user.TenantId || user.tenantId;
    const photoPath = tenantId
      ? `/uploads/${tenantId}/profilePhotos/${user.Photo}`
      : `/uploads/profilePhotos/${user.Photo}`;
    return `<img src="${photoPath}" class="avatar" alt="photo">`;
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
      <div class="user-dropdown" id="userDropdown" role="menu" aria-label="Account menu" style="display:none">
        <button type="button" class="menu-item" data-action="edit-self">Edit</button>
        <button type="button" class="menu-item" data-action="logout">Logout</button>
      </div>
    </div>
  `;
    setTimeout(() => {
      const wrapper = document.getElementById("userMenu");
      const dropdown = document.getElementById("userDropdown");
      const trigger = document.getElementById("userTrigger");
      if (!wrapper || !dropdown || !trigger) return;

      function openMenu() {
        dropdown.style.display = "block";
        trigger.setAttribute("aria-expanded", "true");
      }
      function closeMenu() {
        dropdown.style.display = "none";
        trigger.setAttribute("aria-expanded", "false");
      }
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display !== "none";
        if (isOpen) closeMenu();
        else openMenu();
      });
      document.addEventListener("click", (e) => {
        if (!wrapper.contains(e.target)) closeMenu();
      });
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
    }, 0);
  } catch (err) {
    console.error("Header render failed:", err);
  }
}

// ---------- lists / tabs ----------
async function renderTab(tab) {
  try {
    let url,
      html = "";
    if (tab === "clients") {
      url = "/api/clients";
      const list = await fetchJSON(url);
      if (!Array.isArray(list)) throw new Error("Unexpected response");
      html +=
        '<button type="button" class="btn-new" data-action="new-record" data-type="clients">New Client</button>';
      html +=
        '<table class="list-table"><thead><tr><th></th><th>Id</th><th>Last Name</th><th>First Name</th><th>Email</th><th>Active</th></tr></thead><tbody>';
      for (const item of list) {
        html += `<tr data-id="${item.Id}"><td><button type="button" class="edit-icon" data-action="edit-record" data-type="clients" data-id="${item.Id}" aria-label="Edit client ${item.Id}">&#9998;</button></td><td>${item.Id}</td><td>${item.LastName ?? ""}</td><td>${item.FirstName ?? ""}</td><td>${item.Email ?? ""}</td><td>${item.Active ? "Yes" : "No"}</td></tr>`;
      }
      html += "</tbody></table>";
      $("#tabContent").innerHTML = html;
    } else if (tab === "users") {
      url = "/api/users";
      const list = await fetchJSON(url);
      if (!Array.isArray(list)) throw new Error("Unexpected response");
      html +=
        '<button type="button" class="btn-new" data-action="new-record" data-type="users">New User</button>';
      html +=
        '<table class="list-table"><thead><tr><th></th><th>Id</th><th>Last Name</th><th>First Name</th><th>Email</th><th>Active</th></tr></thead><tbody>';
      for (const item of list) {
        html += `<tr data-id="${item.Id}"><td><button type="button" class="edit-icon" data-action="edit-record" data-type="users" data-id="${item.Id}" aria-label="Edit user ${item.Id}">&#9998;</button></td><td>${item.Id}</td><td>${item.LastName ?? ""}</td><td>${item.FirstName ?? ""}</td><td>${item.Email ?? ""}</td><td>${item.Active ? "Yes" : "No"}</td></tr>`;
      }
      html += "</tbody></table>";
      $("#tabContent").innerHTML = html;
    } else if (tab === "tenants") {
      url = "/api/tenants";
      const list = await fetchJSON(url);
      if (!Array.isArray(list)) throw new Error("Unexpected response");
      html +=
        '<button type="button" class="btn-new" data-action="new-record" data-type="tenants">New Tenant</button>';
      html +=
        '<table class="list-table"><thead><tr><th></th><th>ID</th><th>Name</th></tr></thead><tbody>';
      for (const item of list) {
        html += `<tr data-id="${item.TenantId}"><td><button type="button" class="edit-icon" data-action="edit-record" data-type="tenants" data-id="${item.TenantId}" aria-label="Edit tenant ${item.TenantId}">&#9998;</button></td><td>${item.TenantId}</td><td>${item.TenantName ?? ""}</td></tr>`;
      }
      html += "</tbody></table>";
      $("#tabContent").innerHTML = html;
    }
  } catch (err) {
    console.error(`Render ${tab} failed:`, err);
    $("#tabContent").innerHTML =
      `<div class="error">Could not load ${tab}. ${err.message || ""}</div>`;
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

  let fields;
  if (type === "clients") {
    fields = [
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
    ];
  } else if (type === "users") {
    fields = [
      "FirstName",
      "LastName",
      "Email",
      "Active",
      "Comments",
      "Password",
      "Password2",
    ];
  } else if (type === "tenants") {
    fields = ["TenantId", "TenantName"];
  }

  let html = `<div class="modal-content"><h3>${isNew ? "New " : ""}${singularTitle.charAt(0).toUpperCase() + singularTitle.slice(1)} Details</h3>`;
  if (type === "tenants" || type === "clients" || type === "users") {
    if (type === "tenants") {
      html += `<form id="detailsForm">`;
      html += `<label>Tenant ID <input type="text" name="TenantId" value="${data.TenantId ?? ""}" disabled style="background:#eee;color:#888;"></label><br>`;
      html += `<label>Name <input type="text" name="TenantName" value="${data.TenantName ?? ""}" placeholder="Name"></label><br>`;
      html += `<button type="button" id="saveBtn">Save</button>
               <button type="button" id="closeBtn">Cancel</button>
               <div id="detailsError" class="error" role="alert" aria-live="polite"></div>
               </form>`;
    } else {
      let initials = "";
      if (data.FirstName && data.LastName)
        initials = (data.FirstName[0] + data.LastName[0]).toUpperCase();
      let thumbHtml = "";
      if (data.Photo) {
        const tenantId = data.TenantId || data.tenantId;
        const photoPath = tenantId
          ? `/uploads/${tenantId}/profilePhotos/${data.Photo}`
          : `/uploads/profilePhotos/${data.Photo}`;
        thumbHtml = `<div style='text-align:center;margin-bottom:12px;'>
          <img id='photoThumb' src='${photoPath}' alt='photo'
               style='width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #ccc;cursor:pointer;' title='Change photo'>
        </div>`;
      } else {
        const inner = initials
          ? `<div id='photoThumb' style='width:64px;height:64px;border-radius:50%;background:#888;color:#fff;display:flex;align-items:center;justify-content:center;font-size:2em;font-weight:bold;margin:0 auto 12px auto;cursor:pointer;' title='Change photo'>${initials}</div>`
          : `<div id='photoThumb' style='width:64px;height:64px;border-radius:50%;background:#888;cursor:pointer;margin:0 auto 12px auto;' title='Change photo'></div>`;
        thumbHtml = inner;
      }
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
        } else if (f !== "TenantId" && f !== "TenantName") {
          html += `<input type="text" name="${f}" value="${(data[f] ?? "").toString().replace(/"/g, "&quot;")}" placeholder="${f}"><br>`;
        }
      }
      html += `<button type="button" id="saveBtn">Save</button>
               <button type="button" id="closeBtn">Close</button>
               <div id="detailsError" class="error" role="alert" aria-live="polite"></div>
               </form>`;
    }
  }
  html += `</div>`;

  // Inject & show modal
  const modal = $("#detailsModal");
  if (!modal) {
    console.error("#detailsModal not found in DOM");
    return;
  }
  modal.innerHTML = html;
  modal.style.display = "block";

  const form = $("#detailsForm");
  let dirty = false;

  // Set dirty on any input change
  if (form) {
    form.addEventListener("input", () => (dirty = true));
    form.addEventListener("change", () => (dirty = true));
  }

  // Photo interactions (if present)
  const photoThumb = $("#photoThumb");
  const photoInput = $("#photoInput");
  if (photoThumb && photoInput) {
    photoThumb.addEventListener("click", () => photoInput.click());
    photoInput.addEventListener("change", () => {
      const file = photoInput.files && photoInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (photoThumb.tagName.toLowerCase() === "img") {
            photoThumb.src = e.target.result;
          } else {
            photoThumb.style.backgroundImage = `url(${e.target.result})`;
            photoThumb.style.backgroundSize = "cover";
          }
        };
        reader.readAsDataURL(file);
        dirty = true;
      }
    });
  }

  $("#saveBtn").addEventListener("click", async () => {
    const errorDiv = $("#detailsError");
    errorDiv.textContent = "";
    const notif = ensureNotification();

    if (type === "tenants") {
      const nameInput = form.TenantName;
      if (isNew) {
        // Create new tenant: generate unique TenantId
        let attempts = 0;
        let success = false;
        let lastError = "";
        let newTenantId = "";
        while (attempts < 100 && !success) {
          attempts++;
          newTenantId = Math.floor(Math.random() * 0x10000)
            .toString(16)
            .padStart(4, "0");
          try {
            const res = await fetch("/api/tenants", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                TenantId: newTenantId,
                TenantName: nameInput.value,
              }),
            });
            const result = await res.json().catch(() => ({}));
            if (!res.ok || result.error) {
              if ((result.error || "").toLowerCase().includes("unique"))
                continue;
              lastError = result.error || "Failed to save record.";
              break;
            }
            success = true;
          } catch (err) {
            lastError = err.message || "Network error. Please try again.";
            break;
          }
        }
        if (!success) {
          errorDiv.textContent = `A unique TenantId could not be found after ${attempts} tries. Please contact support for help.`;
          return;
        }
        dirty = false;
        notif.textContent = "Tenant saved successfully";
        notif.style.display = "block";
        setTimeout(() => (notif.style.display = "none"), 3000);
        closeModal();
        await renderTab(type);
      } else {
        // Update existing tenant: only update TenantName
        try {
          const res = await fetch(`/api/tenants/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              TenantName: nameInput.value,
            }),
          });
          const result = await res.json().catch(() => ({}));
          if (!res.ok || result.error)
            throw new Error(result.error || "Failed to save record.");
          dirty = false;
          notif.textContent = "Tenant updated successfully";
          notif.style.display = "block";
          setTimeout(() => (notif.style.display = "none"), 3000);
          closeModal();
          await renderTab(type);
        } catch (err) {
          errorDiv.textContent =
            err.message || "Network error. Please try again.";
        }
      }
    } else {
      const formData = new FormData(form);
      if (form.Active)
        formData.set("Active", form.Active.checked ? "true" : "false");
      const endpoint = isNew ? `/api/${type}` : `/api/${type}/${id}`;
      const method = isNew ? "POST" : "PUT";
      try {
        const res = await fetch(endpoint, { method, body: formData });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || result.error)
          throw new Error(result.error || "Failed to save record.");
        dirty = false;
        notif.textContent = "Record saved successfully";
        notif.style.display = "block";
        setTimeout(() => (notif.style.display = "none"), 3000);
        closeModal();
        await renderTab(type);
        if (type === "users" && !isNew) {
          try {
            const me = await getProfile();
            if (me && me.Id === Number(id)) await renderHeader();
          } catch {}
        }
      } catch (err) {
        errorDiv.textContent =
          err.message || "Network error. Please try again.";
      }
    }
  });

  // close
  $("#closeBtn").addEventListener("click", () => {
    if (dirty) {
      if (
        confirm(
          "There are unsaved changes. Do you want to cancel those changes?",
        )
      ) {
        closeModal();
      }
    } else {
      closeModal();
    }
  });
}

// ---------- sidebar wiring (collapse + nav) & initial render ----------
document.addEventListener("DOMContentLoaded", async function () {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("sidebarToggle");
  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  const pageTitle = document.getElementById("pageTitle");

  if (toggle) {
    toggle.addEventListener("click", () => {
      sidebar && sidebar.classList.toggle("collapsed");
    });
  }

  navItems.forEach((btn) => {
    btn.addEventListener("click", async () => {
      navItems.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab; // "clients" | "users" | "tenants"
      if (pageTitle)
        pageTitle.textContent = tab.charAt(0).toUpperCase() + tab.slice(1);
      await renderTab(tab);
    });
  });

  // Hook up "New" buttons and row edit clicks via event delegation
  document.addEventListener("click", (e) => {
    const newBtn = e.target.closest(".btn-new");
    if (newBtn) {
      const type = newBtn.dataset.type;
      showDetailsModal(type, "new");
      return;
    }
    const editBtn = e.target.closest(".edit-icon");
    if (editBtn) {
      const type = editBtn.dataset.type;
      const id = editBtn.dataset.id;
      showDetailsModal(type, id);
    }
  });

  // Default to Clients via sidebar
  const defaultBtn = document.querySelector('.nav-item[data-tab="clients"]');
  if (defaultBtn) defaultBtn.click();

  // Render header once
  await renderHeader();
});
