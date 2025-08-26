const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const { login, logout } = require("../controllers/authController");
const { logAudit } = require("../utils/audit");

const router = express.Router();

/** Parse JSON + urlencoded for login endpoints */
router.use(
  ["/login", "/api/auth/login"],
  express.json({ limit: "32kb" }),
  express.urlencoded({ extended: false }),
);

/** Helper: does the client prefer HTML? */
function wantsHtml(req) {
  const a = req.get("accept") || "";
  return a.includes("text/html") && !a.includes("application/json");
}

/** Helper: write an Audit row for a failed login (email included in Message) */
async function auditLoginFailure(req, reason, statusCode) {
  const b = req.body || {};
  const email = b.email || b.Email || b.username || b.user || null;

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null;

  const userAgent = req.get("user-agent") || null;

  const message = {
    type: "login_failed",
    reason: reason || "Unknown",
    email, // <-- your requirement
    ip,
    userAgent,
    statusCode: statusCode ?? null,
    path: req.originalUrl || req.url,
  };

  try {
    await logAudit({
      userId: null,
      tableName: "Auth",
      actionType: "LoginFailed",
      tenantId: req.tenant?.id ?? null,
      tenantUserId: null,
      message,
      createdDate: new Date(),
    });
  } catch {
    // ignore audit errors so login UX is not blocked
  }
}

/** GET /login: render page (for non-JS fallback) */
router.get("/login", (req, res) => {
  res.render("login", { error: null });
});

/** POST /login: HTML-friendly handler with auditing on failures */
router.post(
  "/login",
  asyncHandler(async (req, res, next) => {
    const origStatus = res.status.bind(res);
    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);
    const origRedirect = res.redirect.bind(res);

    let statusCode = 200;
    let responded = false;
    res.status = (c) => {
      statusCode = c;
      return origStatus(c);
    };

    const fail = async (payload) => {
      const msg =
        (payload && (payload.error || payload.message)) ||
        (typeof payload === "string" ? payload : "Login failed");
      await auditLoginFailure(req, msg, statusCode);
      if (wantsHtml(req)) {
        // stay on the login page and show the error
        return res.render("login", { error: msg });
      }
      // JSON fallback (e.g., your current login.js request)
      return origJson({ error: msg });
    };

    res.json = async (payload) => {
      responded = true;
      if (statusCode >= 400) return fail(payload);
      return origJson(payload);
    };
    res.send = async (payload) => {
      responded = true;
      if (statusCode >= 400)
        return fail(
          typeof payload === "object"
            ? payload
            : { error: String(payload || "Login failed") },
        );
      return origSend(payload);
    };
    res.redirect = (url, ...rest) => {
      responded = true;
      return origRedirect(url, ...rest);
    };

    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400);
      return fail({ error: "Email and password are required." });
    }

    await login(req, res, next);

    if (!responded && statusCode >= 400) return fail({ error: "Login failed" });
    if (!responded) return origRedirect(req.query.next || "/");
  }),
);

/** POST /api/auth/login: API flavor with auditing on failures */
router.post(
  "/api/auth/login",
  asyncHandler(async (req, res, next) => {
    const origStatus = res.status.bind(res);
    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);
    let statusCode = 200;

    res.status = (c) => {
      statusCode = c;
      return origStatus(c);
    };

    const fail = async (payload) => {
      const msg =
        (payload && (payload.error || payload.message)) ||
        (typeof payload === "string" ? payload : "Login failed");
      await auditLoginFailure(req, msg, statusCode);
      return origJson({ error: msg });
    };

    res.json = async (payload) => {
      if (statusCode >= 400) return fail(payload);
      return origJson(payload);
    };
    res.send = async (payload) => {
      if (statusCode >= 400)
        return fail(
          typeof payload === "object"
            ? payload
            : { error: String(payload || "Login failed") },
        );
      return origSend(payload);
    };

    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400);
      return fail({ error: "Email and password are required." });
    }

    return login(req, res, next);
  }),
);

/** Logout routes (unchanged) */
router.post("/logout", asyncHandler(logout));
router.get("/logout", asyncHandler(logout));

module.exports = router;
