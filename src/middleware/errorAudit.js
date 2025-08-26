// src/middleware/errorAudit.js
"use strict";

const { logAudit } = require("../utils/audit");

function redact(obj) {
  try {
    const copy = { ...obj };
    const SENSITIVE = [
      "password",
      "pwd",
      "pass",
      "token",
      "authorization",
      "auth",
    ];
    for (const k of Object.keys(copy)) {
      if (SENSITIVE.includes(String(k).toLowerCase())) copy[k] = "[redacted]";
    }
    return copy;
  } catch {
    return {};
  }
}

module.exports = function errorAudit() {
  return async function (err, req, res, next) {
    try {
      const u = req.session?.user || {};
      if (!u.tenantId && u.companyId) u.tenantId = u.companyId; // compat
      if (!u.tenantUserId && u.companyUserId) u.tenantUserId = u.companyUserId;

      const payload = {
        status: err?.status || res?.statusCode || 500,
        method: req.method,
        path: req.originalUrl,
        message: err?.message || "Error",
        ip: req.ip,
        userAgent: req.get("user-agent"),
      };
      if (req.query && Object.keys(req.query).length) payload.query = req.query;
      if (req.body && Object.keys(req.body).length)
        payload.body = redact(req.body);
      if (process.env.NODE_ENV !== "production" && err?.stack)
        payload.stack = err.stack;

      await logAudit({
        userId: u.id ?? null,
        tableName: "HTTP",
        actionType: "ERROR",
        updatedValue: payload,
        tenantId: u.tenantId ?? null,
        tenantUserId: u.tenantUserId ?? null,
      });
    } catch {}
    next(err);
  };
};
