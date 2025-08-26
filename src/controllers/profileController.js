const mssql = require("mssql");
const { getPool } = require("../config/db");

function normalizeBit(x) {
  if (typeof x === "boolean") return x ? 1 : 0;
  return x == null ? 0 : Number(x); // coerces "1"/1 → 1, "0"/0 → 0
}

/** GET /api/profile – returns the current user (for header/avatar) */
async function getProfile(req, res) {
  const email = req.session?.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const pool = await getPool();
  const result = await // select fields your home.js uses; Photo is optional
  pool.request().input("email", mssql.NVarChar, email).query(`
      SELECT TOP 1 Id, FirstName, LastName, Email, Active, Photo
      FROM Users
      WHERE Email = @email
    `);

  const user = result.recordset[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
}

module.exports = { getProfile };
