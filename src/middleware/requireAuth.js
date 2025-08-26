// src/middleware/requireAuth.js
"use strict";

const { logAudit } = require("../utils/audit");

module.exports = async (req, res, next) => {
  if (req.session?.user) {
    // Compat: map legacy company* fields to tenant* if present
    const u = req.session.user;
    if (!u.tenantId && u.companyId) u.tenantId = u.companyId;
    if (!u.tenantUserId && u.companyUserId) u.tenantUserId = u.companyUserId;
    return next();
  }

  // No session -> audit unauthorized
  const payload = {
    status: 401,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    message: "Unauthorized",
  };

  logAudit({
    userId: null,
    tableName: "HTTP",
    actionType: "ERROR",
    updatedValue: payload,
    tenantId: null,
    tenantUserId: null,
  }).catch(() => {});

  if (req.accepts("html")) return res.redirect("/login.html");
  return res.status(401).json({ error: "Unauthorized" });
};
