const logger = require("../config/logger");
const { logAudit } = require("../utils/audit");

// 404 handler
function notFound(req, res, _next) {
  const status = 404;

  // skip noisy Chrome/DevTools probes
  if (req.originalUrl.startsWith("/.well-known")) {
    return res.status(status).json({ error: "Not Found" });
  }

  const payload = {
    status,
    message: "Not Found",
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  };

  // fire-and-forget; do not block the response if auditing fails
  logAudit({
    userId: req.session?.user?.id ?? null,
    tableName: "HTTP",
    // If your audit util uses "entityId" pass null here
    actionType: "ERROR",
    updatedValue: JSON.stringify(payload),
  }).catch(() => {});

  return res.status(status).json({ error: payload.message });
}

// 4xx/5xx handler
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  logger.error(err);

  const payload = {
    status,
    message: err.message || "Internal Server Error",
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    // include stack in non-prod only; remove if you never want stacks in audit
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  };

  logAudit({
    userId: req.session?.user?.id ?? null,
    tableName: "HTTP",
    actionType: "ERROR",
    updatedValue: JSON.stringify(payload),
  }).catch(() => {});

  return res.status(status).json({ error: payload.message });
}

module.exports = { notFound, errorHandler };
