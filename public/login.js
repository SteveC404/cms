// public/login.js (success redirect tuned for /home)
(function () {
  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function text(v) {
    return (v == null ? "" : String(v)).trim();
  }

  function showError(msg) {
    var box = $("#loginError") || $(".login-error") || $(".error");
    if (!box) {
      alert(msg);
      return;
    }
    box.textContent = msg || "Login failed";
    box.style.display = "";
    box.style.color = "red";
    box.style.fontWeight = "600";
    box.setAttribute("role", "alert");
    box.setAttribute("aria-live", "polite");
  }

  function clearError() {
    var box = $("#loginError") || $(".login-error") || $(".error");
    if (!box) return;
    box.textContent = "";
    box.style.display = "none";
  }

  function isLoginUrl(u) {
    try {
      var url = new URL(u, window.location.origin);
      return url.pathname.indexOf("/login") !== -1;
    } catch {
      return false;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const action = form.getAttribute("action") || "/login?redirect=1";

    const email = text(
      $("#email", form)?.value || $('input[name="email"]', form)?.value,
    );
    const password = text(
      $("#password", form)?.value || $('input[name="password"]', form)?.value,
    );

    clearError();

    if (!email || !password) {
      showError("Email and password required");
      ($("#email", form) && !email
        ? $("#email", form)
        : $("#password", form)
      )?.focus();
      return;
    }

    const body = new URLSearchParams();
    body.set("email", email);
    body.set("password", password);

    try {
      const res = await fetch(action, {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
        body,
      });

      if (res.ok) {
        // 1) If server gave JSON with redirectTo/next, use that
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const data = await res.json().catch(() => null);
          const next = (data && (data.redirectTo || data.next)) || "/home";
          window.location.assign(next);
          return;
        }

        // 2) If fetch followed a redirect, prefer the final URL
        if (res.redirected && res.url && !isLoginUrl(res.url)) {
          window.location.assign(res.url);
          return;
        }

        // 3) If final response URL isn't the login page, use it
        if (res.url && !isLoginUrl(res.url)) {
          window.location.assign(res.url);
          return;
        }

        // 4) Fallback: go to /home
        window.location.assign("/home");
        return;
      }

      // Error: show server message
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json().catch(() => null);
        const msg = (data && (data.error || data.message)) || "Login failed";
        showError(msg);
        return;
      } else {
        const txt = await res.text().catch(() => "");
        try {
          const data = JSON.parse(txt);
          const msg = (data && (data.error || data.message)) || "Login failed";
          showError(msg);
        } catch {
          showError(txt || "Login failed");
        }
        return;
      }
    } catch (err) {
      console.error("[login] submit error", err);
      showError("Network error. Please try again.");
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const form =
      $("#loginForm") || $("#login-form") || document.querySelector("form");
    if (!form) return;
    if (!form.__bound) {
      form.addEventListener("submit", handleSubmit);
      form.__bound = true;
    }
  });
})();
