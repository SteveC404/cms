// public/login.js

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const changePwForm = document.getElementById("changePasswordForm");
  const changePwError = document.getElementById("changePasswordError");
  const changePwModal = document.getElementById("changePasswordModal");

  if (!loginForm) return;

  let submitting = false;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault(); // stop native /login post (fallback is still in HTML)
    e.stopPropagation();
    if (submitting) return;
    submitting = true;

    loginError.textContent = "";
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const email = (loginForm.email?.value || "").trim();
    const password = loginForm.password?.value || "";

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // Tolerate different server response shapes ({ok:true} or {success:true} or {changePassword:true})
      let data = {};
      try {
        data = await res.json();
      } catch {}

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      if (data.changePassword) {
        // Show modal & stash userId for the password change request
        changePwModal.style.display = "flex";
        const userIdInput = changePwForm.querySelector("[name=userId]");
        if (userIdInput) userIdInput.value = data.userId ?? "";
        return;
      }

      if (data.ok || data.success) {
        window.location.href = "/home"; // or "/home.html" depending on your route
        return;
      }

      throw new Error(data.error || "Login failed");
    } catch (err) {
      const now = new Date().toLocaleString();
      loginError.style.color = "red";
      loginError.textContent = `${now}: ${err.message || "Login failed"}`;
    } finally {
      submitting = false;
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  // Change Password flow (uses refactored route: PATCH /api/users/:id/password)
  if (changePwForm) {
    changePwForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      changePwError.textContent = "";

      const userId = changePwForm.userId?.value;
      const password = changePwForm.password?.value || "";
      const password2 = changePwForm.password2?.value || "";

      if (!userId) {
        changePwError.textContent = "Missing user id.";
        return;
      }
      if (!password || !password2) {
        changePwError.textContent =
          "Please enter and confirm the new password.";
        return;
      }

      try {
        const res = await fetch(
          `/api/users/${encodeURIComponent(userId)}/password`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ Password: password, Password2: password2 }),
          },
        );

        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Password change failed");
        }

        // On success, hide modal and go to home
        changePwModal.style.display = "none";
        window.location.href = "/home";
      } catch (err) {
        changePwError.textContent = err.message || "Password change failed.";
      }
    });
  }
});
