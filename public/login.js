// public/js/login.js
(function () {
  function $(sel, root = document) {
    return root.querySelector(sel);
  }
  function text(v) {
    return (v == null ? "" : String(v)).trim();
  }

  function findLoginForm() {
    return (
      $("#login-form") ||
      $("form[data-login-form]") ||
      $('form[action="/api/auth/login"]') ||
      $('form[action$="/api/auth/login"]') ||
      (/login/i.test(location.pathname) ? $("form") : null)
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;

    const action = form.getAttribute("action") || "/api/auth/login";
    const fd = new FormData(form);

    let email =
      text(fd.get("email")) ||
      text($('input[type="email"]', form)?.value) ||
      text($('input[name="Email"]', form)?.value) ||
      text($('input[name="username"]', form)?.value) ||
      text($('input[name="user"]', form)?.value);

    let password =
      fd.get("password") || $('input[type="password"]', form)?.value || "";

    const redirectTo =
      text(fd.get("redirectTo")) ||
      form.getAttribute("data-redirect-to") ||
      "/home";

    if (!email || !password) {
      showError(form, "Email and password are required.");
      return;
    }

    try {
      const res = await fetch(action, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json", // <- ensures JSON response
          "X-Requested-With": "fetch", // <- hint for the server
        },
        credentials: "include", // <- set/read session cookie
        body: JSON.stringify({ email, password, redirectTo }),
        redirect: "follow", // default; keeps res.redirected accurate
      });

      // If server issued a 30x and the browser followed it, use that final URL.
      if (res.redirected && res.url) {
        // Same-origin safety: if URL is absolute, browser will still navigate.
        window.location.replace(res.url);
        return;
      }

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Login failed (${res.status})`);
      }

      // Prefer JSON {redirectUrl}; if body isn't JSON, we'll fall back.
      let data = {};
      try {
        data = await res.json();
      } catch {}

      const target =
        (data && typeof data.redirectUrl === "string" && data.redirectUrl) ||
        redirectTo ||
        "/home";

      window.location.replace(target);

      // Last-ditch fallback in case some CSP extension blocks replace():
      setTimeout(() => {
        if (location.pathname !== target) location.href = target;
      }, 150);
    } catch (err) {
      console.error("[login] submit error:", err);
      showError(form, "Invalid email or password.");
    }
  }

  function showError(form, msg) {
    const el = $("#login-error") || $(".login-error") || $(".error");
    if (el) el.textContent = msg;
    else alert(msg);
  }

  function attach(form) {
    if (form.__loginBound) return;
    form.addEventListener("submit", handleSubmit);
    form.__loginBound = true;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = findLoginForm();
    if (!form) return; // quiet on non-login pages
    attach(form);
  });
})();
