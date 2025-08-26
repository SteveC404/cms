// src/middleware/httpStatusAudit.js
"use strict";

const { logAudit } = require("../utils/audit");

function redactBody(body) {
  try {
    if (!body || typeof body !== "object") return undefined;
    const out = {};
    const SENSITIVE = [
      "password",
      "pwd",
      "pass",
      "token",
      "authorization",
      "auth",
    ];
    for (const k of Object.keys(body))
      out[k] = SENSITIVE.includes(String(k).toLowerCase())
        ? "[redacted]"
        : body[k];
    return out;
  } catch {
    return undefined;
  }
}

module.exports = function httpStatusAudit({ minStatus = 500 } = {}) {
  return function (req, res, next) {
    const started = Date.now();
    res.on("finish", () => {
      try {
        const status = res.statusCode || 0;
        if (status >= minStatus) {
          const u = req.session?.user || {};
          if (!u.tenantId && u.companyId) u.tenantId = u.companyId; // compat
          if (!u.tenantUserId && u.companyUserId)
            u.tenantUserId = u.companyUserId;

          const payload = {
            status,
            method: req.method,
            path: req.originalUrl,
            durationMs: Date.now() - started,
            ip: req.ip,
            userAgent: req.get("user-agent"),
          };
          if (req.query && Object.keys(req.query).length)
            payload.query = req.query;
          const red = redactBody(req.body);
          if (red) payload.body = red;

          logAudit({
            userId: u.id ?? null,
            tableName: "HTTP",
            actionType: "ERROR",
            updatedValue: payload,
            tenantId: u.tenantId ?? null,
            tenantUserId: u.tenantUserId ?? null,
          }).catch(() => {});
        }
      } catch {}
    });
    next();
  };
};
