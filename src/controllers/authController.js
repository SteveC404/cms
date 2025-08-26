// src/controllers/authController.js
"use strict";

const bcrypt = require("bcrypt");
const { query } = require("../config/db");
const { logAudit } = require("../utils/audit");

function wantsJson(req) {
  const accept = (req.get("accept") || "").toLowerCase();
  const xreq = (req.get("x-requested-with") || "").toLowerCase();
  return (
    accept.includes("application/json") ||
    (req.is && req.is("application/json")) ||
    xreq === "fetch" ||
    xreq === "xmlhttprequest"
  );
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const rs = await query`SELECT TOP 1 * FROM Users WHERE Email = ${email}`;
  if (!rs?.recordset?.length)
    return res.status(401).json({ error: "Invalid credentials" });

  const user = rs.recordset[0];
  const ok =
    typeof user.Password === "string" && user.Password.length
      ? await bcrypt.compare(password, user.Password)
      : false;
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const id = user.Id;
  const redirectTo =
    (typeof req.body?.redirectTo === "string" && req.body.redirectTo) ||
    (typeof req.query?.redirectTo === "string" && req.query.redirectTo) ||
    "/home";

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Session error" });

    // Store TENANT fields
    req.session.user = {
      id,
      email: user.Email,
      firstName: user.FirstName,
      lastName: user.LastName,
      tenantId: user.TenantId || null,
      tenantUserId: user.TenantUserId || null,
    };

    logAudit({
      userId: id,
      tableName: "Auth",
      actionType: "LOGIN",
      updatedValue: { email: user.Email },
      tenantId: user.TenantId || null,
      tenantUserId: user.TenantUserId || null,
    }).catch(() => {});

    req.session.save(() => {
      if (wantsJson(req))
        return res.json({ ok: true, id, redirectUrl: redirectTo });
      return res.redirect(303, redirectTo);
    });
  });
}

async function logout(req, res) {
  const id = req.session?.user?.id ?? null;
  const tenantId = req.session?.user?.tenantId ?? null;
  const tenantUserId = req.session?.user?.tenantUserId ?? null;

  // Include email in UpdatedValue (as you asked earlier)
  let email = req.session?.user?.email ?? null;
  if (!email && id) {
    try {
      const r2 = await query`SELECT TOP 1 Email FROM Users WHERE Id = ${id}`;
      if (r2?.recordset?.length) email = r2.recordset[0].Email || null;
    } catch {}
  }

  logAudit({
    userId: id,
    tableName: "Auth",
    actionType: "LOGOUT",
    updatedValue: { email: email || null },
    tenantId,
    tenantUserId,
  }).catch(() => {});

  req.session.destroy(() => {
    if (wantsJson(req)) return res.json({ ok: true });
    return res.redirect(303, "/login.html");
  });
}

module.exports = { login, logout };
