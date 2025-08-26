const bcrypt = require("bcrypt");
const mssql = require("mssql");
const { getPool } = require("../config/db");
const { logAudit } = require("../utils/audit");

function toBit(v) {
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = String(v ?? "").toLowerCase();
  return s === "true" || s === "on" || s === "1" ? 1 : 0;
}
function normalizeBit(x) {
  if (typeof x === "boolean") return x ? 1 : 0;
  return x == null ? 0 : Number(x);
}

/** GET /api/users → array for UI */
async function listUsers(req, res) {
  const pool = await getPool();
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(req.query.pageSize || "100", 10)),
  );
  const q = (req.query.q || "").trim();

  let where = "WHERE 1=1";
  const request = pool
    .request()
    .input("offset", mssql.Int, (page - 1) * pageSize)
    .input("limit", mssql.Int, pageSize);

  if (q) {
    where += " AND (FirstName LIKE @q OR LastName LIKE @q OR Email LIKE @q)";
    request.input("q", mssql.NVarChar, `%${q}%`);
  }

  const sql = `
    SELECT Id, FirstName, LastName, Email, Active
    FROM Users
    ${where}
    ORDER BY Id DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `;
  const result = await request.query(sql);
  return res.json(result.recordset || []);
}

/** GET /api/users/:id */
async function getUser(req, res) {
  const id = Number(req.params.id);
  const pool = await getPool();
  const result = await pool.request().input("id", mssql.Int, id).query(`
      SELECT Id, FirstName, LastName, Email, Active, Comments, Photo, CreatedDate, UpdatedDate
      FROM Users
      WHERE Id = @id
    `);
  const user = result.recordset[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
}

/** POST /api/users */
/** POST /api/users */
async function createUser(req, res) {
  const body = req.body || {};
  const Email = body.Email ?? body.email;
  const Password = body.Password ?? body.password;
  const { FirstName, LastName, Active, Comments } = req.body || {};

  if (!Email || !Password)
    return res.status(400).json({ error: "Email and Password required" });

  const pool = await getPool();

  // unique email
  const exists = await pool
    .request()
    .input("email", mssql.NVarChar, Email)
    .query("SELECT TOP 1 Id FROM Users WHERE Email = @email");
  if (exists.recordset[0])
    return res.status(409).json({ error: "Email already in use" });

  const hash = await bcrypt.hash(Password, 10);
  const now = new Date();
  const createdBy = req.session?.user?.email || "system";

  const inserted = await pool
    .request()
    .input("FirstName", mssql.NVarChar, FirstName || null)
    .input("LastName", mssql.NVarChar, LastName || null)
    .input("Email", mssql.NVarChar, Email)
    .input("Password", mssql.NVarChar, hash)
    .input(
      "Active",
      mssql.Bit,
      Active === true || Active === "true" || Active === "on" ? 1 : 0,
    )
    .input("Comments", mssql.NVarChar, Comments || null)
    .input("CreatedBy", mssql.NVarChar, createdBy)
    .input("CreatedDate", mssql.DateTime, now).query(`
      INSERT INTO Users (FirstName, LastName, Email, Password, Active, Comments, CreatedBy, CreatedDate)
      OUTPUT INSERTED.Id, INSERTED.CreatedBy, INSERTED.CreatedDate
      VALUES (@FirstName, @LastName, @Email, @Password, @Active, @Comments, @CreatedBy, @CreatedDate)
    `);

  const row = inserted.recordset[0];
  const newId = row.Id;

  // Build the exact values entered to include in the audit (mask password)
  const auditPayload = {
    FirstName: FirstName || null,
    LastName: LastName || null,
    Email,
    Active: Active === true || Active === "true" || Active === "on" ? 1 : 0,
    Comments: Comments || null,
    Password: "***", // never store real password
  };

  await logAudit({
    userId: req.session?.user?.id ?? null,
    tableName: "Users",
    recordId: newId,
    actionType: "CREATE",
    updatedValue: JSON.stringify(auditPayload),
  });

  res.status(201).json({
    id: newId,
    createdBy: row.CreatedBy,
    createdDate: row.CreatedDate,
  });
}

/** PUT /api/users/:id — updates with diff auditing */
async function updateUser(req, res) {
  const id = Number(req.params.id);
  const body = req.body || {};
  const photo = req.file ? req.file.filename : null;
  const now = new Date();

  const pool = await getPool();

  // Load existing
  const prevRes = await pool.request().input("Id", mssql.Int, id).query(`
      SELECT Id, FirstName, LastName, Email, Active, Comments, Photo
      FROM Users
      WHERE Id = @Id
    `);
  const prev = prevRes.recordset[0];
  if (!prev) return res.status(404).json({ error: "User not found" });

  prev.Active = normalizeBit(prev.Active);

  // Next values (multipart FormData is now parsed by Multer on the route)
  const next = {
    FirstName: body.FirstName ?? prev.FirstName,
    LastName: body.LastName ?? prev.LastName,
    Email: body.Email ?? prev.Email,
    Active: body.Active != null ? toBit(body.Active) : prev.Active,
    Comments: body.Comments ?? prev.Comments,
    Photo: photo ? photo : prev.Photo,
  };

  // Diff
  const changedOld = {};
  const changedNew = {};
  for (const k of [
    "FirstName",
    "LastName",
    "Email",
    "Active",
    "Comments",
    "Photo",
  ]) {
    let a = prev[k];
    let b = next[k];
    if (k === "Active") {
      a = normalizeBit(a);
      b = normalizeBit(b);
    }
    if (String(a ?? "") !== String(b ?? "")) {
      changedOld[k] = k === "Active" ? normalizeBit(prev[k]) : prev[k];
      changedNew[k] = k === "Active" ? normalizeBit(next[k]) : next[k];
    }
  }

  if (Object.keys(changedNew).length === 0) {
    // nothing to do; still OK
    return res.json({ success: true, changed: 0 });
  }

  // Update DB
  const rq = pool
    .request()
    .input("Id", mssql.Int, id)
    .input("FirstName", mssql.NVarChar, next.FirstName)
    .input("LastName", mssql.NVarChar, next.LastName)
    .input("Email", mssql.NVarChar, next.Email)
    .input("Active", mssql.Bit, next.Active)
    .input("Comments", mssql.NVarChar, next.Comments)
    .input("UpdatedBy", mssql.NVarChar, req.session?.user?.email || "system")
    .input("UpdatedDate", mssql.DateTime, now);

  let setSql = `
    FirstName=@FirstName,
    LastName=@LastName,
    Email=@Email,
    Active=@Active,
    Comments=@Comments,
    UpdatedBy=@UpdatedBy,
    UpdatedDate=@UpdatedDate
  `;
  if (photo) {
    rq.input("Photo", mssql.NVarChar, next.Photo);
    setSql += `, Photo=@Photo`;
  }

  await rq.query(`UPDATE Users SET ${setSql} WHERE Id=@Id`);

  // Audit diffs
  await logAudit({
    userId: req.session?.user?.id ?? null,
    tableName: "Users",
    recordId: id,
    actionType: "UPDATE",
    existingValue: JSON.stringify(changedOld),
    updatedValue: JSON.stringify(changedNew),
  });

  res.json({ success: true, changed: Object.keys(changedNew).length });
}

/** PATCH /api/users/:id/password */
async function changePassword(req, res) {
  const id = Number(req.params.id);
  const { Password, Password2 } = req.body || {};
  if (!Password) return res.status(400).json({ error: "Password required" });
  if (Password !== Password2)
    return res.status(400).json({ error: "Passwords do not match" });

  const hash = await bcrypt.hash(Password, 10);
  const now = new Date();
  const pool = await getPool();

  await pool
    .request()
    .input("Id", mssql.Int, id)
    .input("Password", mssql.NVarChar, hash)
    .input("UpdatedBy", mssql.NVarChar, req.session?.user?.email || "system")
    .input("UpdatedDate", mssql.DateTime, now).query(`
      UPDATE Users
      SET Password=@Password, UpdatedBy=@UpdatedBy, UpdatedDate=@UpdatedDate
      WHERE Id=@Id
    `);

  await logAudit({
    userId: req.session?.user?.id,
    tableName: "Users",
    recordId: id,
    actionType: "PASSWORD_CHANGE",
    existingValue: JSON.stringify({ Password: "***" }),
    updatedValue: JSON.stringify({ Password: "***" }),
  });

  res.json({ success: true });
}

/** DELETE /api/users/:id */
async function removeUser(req, res) {
  const id = Number(req.params.id);
  const pool = await getPool();
  await pool
    .request()
    .input("Id", mssql.Int, id)
    .query("DELETE FROM Users WHERE Id=@Id");

  await logAudit({
    userId: req.session?.user?.id,
    tableName: "Users",
    recordId: id,
    actionType: "DELETE",
  });
  res.json({ success: true });
}

/** GET /api/users/me */
async function me(req, res) {
  const id = req.session?.user?.id;
  if (!id) return res.status(401).json({ error: "Unauthorized" });
  const pool = await getPool();
  const result = await pool.request().input("id", mssql.Int, id).query(`
      SELECT Id, FirstName, LastName, Email, Active, Comments, Photo, CreatedDate, UpdatedDate
      FROM Users
      WHERE Id=@id
    `);
  const user = result.recordset[0];
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
}

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  changePassword,
  removeUser,
  me,
};
