async function getProfile() {
  const res = await fetch("/api/profile");
  return await res.json();
}

function renderAvatar(user) {
  if (user.Photo) {
    return `<img src="/uploads/${user.Photo}" class="avatar" alt="photo">`;
  } else {
    const initials = (user.FirstName[0] + user.LastName[0]).toUpperCase();
    return `<div class="avatar" style="background:#888;">${initials}</div>`;
  }
}

async function renderHeader() {
  const user = await getProfile();
  document.getElementById(
    "userHeader"
  ).innerHTML = `<a href="#" id="profileLink">${renderAvatar(user)} ${
    user.FirstName
  } ${user.LastName}</a>`;
  document.getElementById("profileLink").onclick = () =>
    showDetailsModal("users", user.Id);
}

async function renderTab(tab) {
  let url = tab === "clients" ? "/api/clients" : "/api/users";
  const res = await fetch(url);
  const list = await res.json();
  let html = `<button onclick="showDetailsModal('${tab}','new')">New ${
    tab.slice(0, -1).charAt(0).toUpperCase() + tab.slice(1, -1)
  }</button>`;
  html += `<table class="list-table"><thead><tr><th></th><th>Id</th><th>Last Name</th><th>First Name</th><th>Email</th><th>Active</th></tr></thead><tbody>`;
  for (const item of list) {
    html += `<tr><td><span class="edit-icon" onclick="showDetailsModal('${tab}',${
      item.Id
    })">&#9998;</span></td><td>${item.Id}</td><td>${item.LastName}</td><td>${
      item.FirstName
    }</td><td>${item.Email}</td><td>${item.Active ? "Yes" : "No"}</td></tr>`;
  }
  html += "</tbody></table>";
  document.getElementById("tabContent").innerHTML = html;
}

async function showDetailsModal(type, id) {
  let isNew = id === "new";
  let url = isNew ? null : `/api/${type}/${id}`;
  let data = isNew ? {} : await (await fetch(url)).json();
  let fields =
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
  let initials = "";
  if (data.FirstName && data.LastName) {
    initials = (data.FirstName[0] + data.LastName[0]).toUpperCase();
  }
  let thumbHtml = "";
  if (data.Photo) {
    thumbHtml = `<div style='text-align:center;margin-bottom:12px;'><img id='photoThumb' src='/uploads/${data.Photo}' alt='photo' style='width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid #ccc;cursor:pointer;' title='Change photo'></div>`;
  } else if (initials) {
    thumbHtml = `<div id='photoThumb' style='width:64px;height:64px;border-radius:50%;background:#888;color:#fff;display:flex;align-items:center;justify-content:center;font-size:2em;font-weight:bold;margin:0 auto 12px auto;cursor:pointer;' title='Change photo'>${initials}</div>`;
  } else {
    thumbHtml = `<div id='photoThumb' style='width:64px;height:64px;border-radius:50%;background:#888;cursor:pointer;' title='Change photo'></div>`;
  }
  let html = `<div class="modal-content"><h3>${isNew ? "New" : ""} ${
    type.slice(0, -1).charAt(0).toUpperCase() + type.slice(1, -1)
  } Details</h3>`;
  html += thumbHtml;
  html += `<form id="detailsForm">`;
  html += `<input type="file" id="photoInput" name="photo" style="display:none">`;
  for (const f of fields) {
    if (f === "Password" || f === "Password2") {
      html += `<input type="password" name="${f}" placeholder="${
        f === "Password" ? "New Password" : "Repeat Password"
      }"><br>`;
    } else if (f === "Active") {
      html += `<label>Active <input type="checkbox" name="Active" ${
        data.Active ? "checked" : ""
      }></label><br>`;
    } else if (f === "DateOfBirth") {
      let dob = data.DateOfBirth || "";
      if (dob && dob.length > 10) dob = dob.slice(0, 10); // format YYYY-MM-DD
      html += `<label>Date of Birth <input type="date" name="DateOfBirth" value="${dob}"></label><br>`;
    } else if (f === "Gender") {
      const gender = (data.Gender || "").toLowerCase();
      html += `<label>Gender <select name="Gender">
        <option value=""${!gender ? " selected" : ""}>Select</option>
        <option value="Male"${
          gender === "male" ? " selected" : ""
        }>Male</option>
        <option value="Female"${
          gender === "female" ? " selected" : ""
        }>Female</option>
        <option value="Other"${
          gender === "other" ? " selected" : ""
        }>Other</option>
      </select></label><br>`;
    } else {
      html += `<input type="text" name="${f}" value="${
        data[f] || ""
      }" placeholder="${f}"><br>`;
    }
  }
  // Remove default photo input
  // Add click event to thumbnail to trigger file input
  setTimeout(() => {
    const thumb = document.getElementById("photoThumb");
    const input = document.getElementById("photoInput");
    if (thumb && input) {
      thumb.addEventListener("click", () => input.click());
      input.addEventListener("change", function () {
        if (input.files && input.files[0]) {
          const reader = new FileReader();
          reader.onload = function (e) {
            if (thumb.tagName === "IMG") {
              thumb.src = e.target.result;
            } else {
              thumb.innerHTML = "";
              thumb.style.background = `url('${e.target.result}') center/cover`;
            }
          };
          reader.readAsDataURL(input.files[0]);
        }
      });
    }
  }, 0);
  html += `<button type="button" id="saveBtn">Save</button> <button type="button" id="closeBtn">Close</button>`;
  html += `<div id="detailsError" class="error"></div>`;
  html += `</form></div>`;
  // Add global notification container if not present
  if (!document.getElementById("globalNotification")) {
    const notif = document.createElement("div");
    notif.id = "globalNotification";
    notif.style.position = "fixed";
    notif.style.top = "20px";
    notif.style.left = "50%";
    notif.style.transform = "translateX(-50%)";
    notif.style.background = "#28a745";
    notif.style.color = "#fff";
    notif.style.padding = "12px 32px";
    notif.style.borderRadius = "8px";
    notif.style.fontSize = "1.1em";
    notif.style.boxShadow = "0 2px 8px #aaa";
    notif.style.zIndex = "9999";
    notif.style.display = "none";
    document.body.appendChild(notif);
  }
  document.getElementById("detailsModal").innerHTML = html;
  document.getElementById("detailsModal").style.display = "flex";

  // Track dirty state
  let dirty = false;
  const form = document.getElementById("detailsForm");
  form.addEventListener("input", () => {
    dirty = true;
  });
  form.addEventListener("change", () => {
    dirty = true;
  });

  // Save button logic
  document.getElementById("saveBtn").onclick = async function () {
    const formData = new FormData(form);
    // If a new photo is selected, ensure it is included in FormData
    const photoInput = document.getElementById("photoInput");
    if (photoInput && photoInput.files && photoInput.files[0]) {
      formData.set("photo", photoInput.files[0]);
    }
    let endpoint = isNew ? `/api/${type}` : `/api/${type}/${id}`;
    let errorDiv = document.getElementById("detailsError");
    errorDiv.innerText = "";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        errorDiv.innerText = result.error || "Failed to save record.";
        return;
      }
      dirty = false;
      // Show notification
      const notif = document.getElementById("globalNotification");
      notif.innerText = "Record saved successfully";
      notif.style.display = "block";
      setTimeout(() => {
        notif.style.display = "none";
      }, 3000);
      closeModal();
      renderTab(type);
      // If user updated their own profile, refresh header
      if (type === "users" && !isNew) {
        const user = await getProfile();
        if (user.Id === id) {
          renderHeader();
        }
      }
    } catch (err) {
      errorDiv.innerText = "Network error. Please try again.";
    }
  };

  // Close button logic with prompt
  document.getElementById("closeBtn").onclick = function () {
    if (dirty) {
      if (
        confirm("You have unsaved changes. Do you want to save before closing?")
      ) {
        document.getElementById("saveBtn").onclick();
      } else {
        closeModal();
      }
    } else {
      closeModal();
    }
  };
}

function closeModal() {
  document.getElementById("detailsModal").style.display = "none";
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.onclick = function () {
    document
      .querySelectorAll(".tab")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    renderTab(btn.dataset.tab);
  };
});

renderHeader();
document.querySelector(".tab").classList.add("active");
renderTab("clients");
