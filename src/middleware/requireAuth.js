const { logAudit } = require("../utils/audit");

module.exports = async (req, res, next) => {
  if (req.session && req.session.user) return next();

  // audit 401
  const payload = {
    status: 401,
    message: "Unauthorized",
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  };
  try {
    await logAudit({
      userId: null, // no session
      tableName: "HTTP",
      actionType: "ERROR",
      updatedValue: JSON.stringify(payload),
    });
  } catch {}

  return res.status(401).redirect("/");
};
