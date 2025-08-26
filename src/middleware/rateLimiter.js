const rateLimit = require("express-rate-limit");
const { logAudit } = require("../utils/audit");

module.exports = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res, _next, options) => {
    const payload = {
      status: options.statusCode, // typically 429
      message: options.message,
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    };
    try {
      await logAudit({
        userId: req.session?.user?.id ?? null,
        tableName: "HTTP",
        actionType: "ERROR",
        updatedValue: JSON.stringify(payload),
      });
    } catch {}
    return res.status(options.statusCode).json({ error: options.message });
  },
});
