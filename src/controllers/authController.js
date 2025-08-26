const bcrypt = require("bcrypt");
const mssql = require("mssql");
const { query, getPool } = require("../config/db");
const { logAudit } = require("../utils/audit");

function normalizeBit(x) {
  if (typeof x === "boolean") return x ? 1 : 0;
  return x == null ? 0 : Number(x); // coerces "1"/1 → 1, "0"/0 → 0
}

async function login(req, res) {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const result = await query`SELECT TOP 1 * FROM Users WHERE Email = ${email}`;
  const user = result.recordset[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const stored = user.Password;
  let ok = false;
  try {
    ok = await bcrypt.compare(password, stored);
  } catch {}
  if (!ok) {
    // Fallback: allow plaintext match to support legacy DBs
    if (password === stored) ok = true;
  }
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  req.session.user = { id: user.Id, email: user.Email, name: user.FirstName };
  await logAudit({
    userId: user.Id,
    tableName: "Users",
    recordId: user.Id,
    actionType: "LOGIN",
    updatedValue: user.Email,
  });
  return res.json({ ok: true });
}

async function logout(req, res) {
  const id = req.session?.user?.id;

  if (!id) return res.json({ ok: true });

  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", mssql.Int, id)
    .query("SELECT FirstName, LastName, Email FROM Users WHERE Id = @id");
  const u = result.recordset[0];

  const updatedValue = u
    ? `FirstName=${u.FirstName}, LastName=${u.LastName}, Email=${u.Email}`
    : "";

  req.session.destroy(async () => {
    await logAudit({
      userId: id,
      tableName: "Users",
      recordId: id,
      actionType: "LOGOUT",
      updatedValue,
    });
    // If it's a regular page navigation (HTML), redirect to login.
    // Otherwise (API/AJAX), return JSON.
    if (
      req.accepts("html") ||
      req.method === "GET" ||
      req.query.redirect === "1"
    ) {
      return res.redirect("/");
    }
    res.json({ ok: true, id });
  });
}

module.exports = { login, logout };
