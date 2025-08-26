// src/controllers/usersController.js
"use strict";

const bcrypt = require("bcrypt");
const mssql = require("mssql");
const { getPool } = require("../config/db");
const { logAudit } = require("../utils/audit");

/* helpers */
function bitFrom(input) {
  if (typeof input === "boolean") return input ? 1 : 0;
  const s = String(input ?? "")
    .trim()
    .toLowerCase();
  return s === "true" || s === "on" || s === "1" || s === "yes" || s === "y"
    ? 1
    : 0;
}
function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}
function normStr(v) {
  return v == null ? null : String(v);
}

/** GET /api/users */
async function listUsers(req, res) {
  const pool = await getPool();
  const tenantId = req.session?.user?.tenantId;

  const rs = await pool.request().input("TenantId", mssql.Char, tenantId)
    .query(`
      SELECT Id, FirstName, LastName, Email, Photo, Active, Comments,
             CreatedBy, CreatedDate, UpdatedBy, UpdatedDate, TenantId, TenantUserId
        FROM Users
       WHERE TenantId = @TenantId
       ORDER BY Id DESC
    `);
  res.json(rs.recordset || []);
}

/** GET /api/users/:id */
async function getUser(req, res) {
  const pool = await getPool();
  const tenantId = req.session?.user?.tenantId;
  const id = Number(req.params.id);

  const rs = await pool
    .request()
    .input("Id", mssql.Int, id)
    .input("TenantId", mssql.Char, tenantId)
    .query(`SELECT * FROM Users WHERE Id=@Id AND TenantId=@TenantId`);

  const row = rs.recordset[0];
  if (!row) return res.status(404).json({ error: "User not found" });
  res.json(row);
}

/** POST /api/users */
async function createUser(req, res) {
  const pool = await getPool();
  const tenantId = req.session?.user?.tenantId;
  const createdBy = req.session?.user?.tenantUserId || "system";
  const now = new Date();

  const {
    FirstName,
    LastName,
    Email,
    Comments,
    Password,
    Active,
    Photo: PhotoBody,
  } = req.body || {};

  const activeBit = bitFrom(
    hasOwn(req.body, "Active")
      ? Active
      : hasOwn(req.body, "active")
        ? req.body.active
        : 0,
  );
  const photoPath = req.file
    ? `/uploads/${req.file.filename}`
    : PhotoBody || null;
  const hash = Password ? await bcrypt.hash(Password, 10) : null;

  const ins = await pool
    .request()
    .input("TenantId", mssql.Char, tenantId)
    .input("FirstName", mssql.NVarChar, FirstName || null)
    .input("LastName", mssql.NVarChar, LastName || null)
    .input("Email", mssql.NVarChar, Email || null)
    .input("Photo", mssql.NVarChar, photoPath)
    .input("Active", mssql.Bit, activeBit)
    .input("Comments", mssql.NVarChar, Comments || null)
    .input("Password", mssql.NVarChar, hash)
    .input("CreatedBy", mssql.NVarChar, createdBy)
    .input("CreatedDate", mssql.DateTime, now).query(`
      INSERT INTO Users (
        TenantId, FirstName, LastName, Email, Photo, Active, Comments, Password,
        CreatedBy, CreatedDate
      )
      OUTPUT INSERTED.Id AS NewId
      VALUES (
        @TenantId, @FirstName, @LastName, @Email, @Photo, @Active, @Comments, @Password,
        @CreatedBy, @CreatedDate
      )
    `);

  const newId = ins.recordset[0].NewId;

  // Generate TenantUserId: TenantId:8-hex (unique)
  const cu = await pool.request().input("Id", mssql.Int, newId).query(`
      UPDATE Users
         SET TenantUserId = CONCAT(TenantId, ':',
             LOWER(RIGHT(CONVERT(VARCHAR(8), CONVERT(VARBINARY(4), CRYPT_GEN_RANDOM(4)), 2), 8)))
       WHERE Id = @Id;
      SELECT TenantUserId FROM Users WHERE Id=@Id;
    `);

  const newTenantUserId = cu.recordset[0].TenantUserId;

  await logAudit({
    userId: req.session?.user?.id ?? null,
    tableName: "Users",
    actionType: "CREATE",
    updatedValue: { FirstName, LastName, Email, Active: activeBit, Comments },
    tenantId,
    tenantUserId: req.session?.user?.tenantUserId ?? null,
  });

  res.status(201).json({ id: newId, tenantUserId: newTenantUserId });
}

/** PUT/PATCH /api/users/:id */
async function updateUser(req, res) {
  const pool = await getPool();
  const tenantId = req.session?.user?.tenantId;
  const updatedBy = req.session?.user?.tenantUserId || "system";
  const now = new Date();
  const id = Number(req.params.id);

  // Load existing
  const exRs = await pool
    .request()
    .input("Id", mssql.Int, id)
    .input("TenantId", mssql.Char, tenantId)
    .query(`SELECT TOP 1 * FROM Users WHERE Id=@Id AND TenantId=@TenantId`);
  const existing = exRs.recordset[0];
  if (!existing) return res.status(404).json({ error: "User not found" });

  const {
    FirstName,
    LastName,
    Email,
    Comments,
    Password,
    Active,
    Photo: PhotoBody,
  } = req.body || {};

  const hasActive = hasOwn(req.body, "Active") || hasOwn(req.body, "active");
  const activeBit = hasActive
    ? bitFrom(req.body.Active ?? req.body.active)
    : null;
  const photoPath = req.file
    ? `/uploads/${req.file.filename}`
    : hasOwn(req.body, "Photo")
      ? PhotoBody || null
      : null;
  const hash = Password ? await bcrypt.hash(Password, 10) : null;

  // compute diffs
  const changed = {};
  if (hasOwn(req.body, "FirstName")) {
    const v = normStr(FirstName);
    if (v !== normStr(existing.FirstName)) changed.FirstName = v;
  }
  if (hasOwn(req.body, "LastName")) {
    const v = normStr(LastName);
    if (v !== normStr(existing.LastName)) changed.LastName = v;
  }
  if (hasOwn(req.body, "Email")) {
    const v = normStr(Email);
    if (v !== normStr(existing.Email)) changed.Email = v;
  }
  if (hasOwn(req.body, "Comments")) {
    const v = normStr(Comments);
    if (v !== normStr(existing.Comments)) changed.Comments = v;
  }
  if (photoPath !== null && photoPath !== undefined) {
    const v = normStr(photoPath);
    if (v !== normStr(existing.Photo)) changed.Photo = v;
  }
  if (hasActive) {
    const oldBit = existing.Active ? 1 : 0;
    if (activeBit !== oldBit) changed.Active = activeBit;
  }

  const existingPayload = {
    FirstName: existing.FirstName,
    LastName: existing.LastName,
    Email: existing.Email,
  };
  for (const k of Object.keys(changed)) {
    if (k === "FirstName" || k === "LastName" || k === "Email") continue;
    existingPayload[k] = existing[k];
  }
  const updatedPayload = {};
  for (const k of Object.keys(changed)) updatedPayload[k] = changed[k];

  // update
  const sql = `
    UPDATE Users SET
      FirstName   = COALESCE(@FirstName, FirstName),
      LastName    = COALESCE(@LastName, LastName),
      Email       = COALESCE(@Email, Email),
      Photo       = COALESCE(@Photo, Photo),
      Active      = COALESCE(@Active, Active),
      Comments    = COALESCE(@Comments, Comments),
      Password    = CASE WHEN @Password IS NULL THEN Password ELSE @Password END,
      UpdatedBy   = @UpdatedBy,
      UpdatedDate = @UpdatedDate
    WHERE Id=@Id AND TenantId=@TenantId
  `;
  await pool
    .request()
    .input("Id", mssql.Int, id)
    .input("TenantId", mssql.Char, tenantId)
    .input(
      "FirstName",
      mssql.NVarChar,
      hasOwn(req.body, "FirstName") ? (FirstName ?? null) : null,
    )
    .input(
      "LastName",
      mssql.NVarChar,
      hasOwn(req.body, "LastName") ? (LastName ?? null) : null,
    )
    .input(
      "Email",
      mssql.NVarChar,
      hasOwn(req.body, "Email") ? (Email ?? null) : null,
    )
    .input("Photo", mssql.NVarChar, photoPath ?? null)
    .input("Active", mssql.Bit, hasActive ? activeBit : null)
    .input(
      "Comments",
      mssql.NVarChar,
      hasOwn(req.body, "Comments") ? (Comments ?? null) : null,
    )
    .input("Password", mssql.NVarChar, hash ?? null)
    .input("UpdatedBy", mssql.NVarChar, updatedBy)
    .input("UpdatedDate", mssql.DateTime, now)
    .query(sql);

  await logAudit({
    userId: req.session?.user?.id ?? null,
    tableName: "Users",
    actionType: "UPDATE",
    existingValue: existingPayload,
    updatedValue: updatedPayload,
    tenantId,
    tenantUserId: req.session?.user?.tenantUserId ?? null,
  });

  res.json({ success: true });
}

/** DELETE /api/users/:id */
async function removeUser(req, res) {
  const pool = await getPool();
  const tenantId = req.session?.user?.tenantId;
  const id = Number(req.params.id);

  await pool
    .request()
    .input("Id", mssql.Int, id)
    .input("TenantId", mssql.Char, tenantId)
    .query(`DELETE FROM Users WHERE Id=@Id AND TenantId=@TenantId`);

  await logAudit({
    userId: req.session?.user?.id ?? null,
    tableName: "Users",
    actionType: "DELETE",
    updatedValue: { id },
    tenantId,
    tenantUserId: req.session?.user?.tenantUserId ?? null,
  });

  res.json({ success: true });
}

/** GET /api/users/me */
async function me(req, res) {
  const pool = await getPool();
  const id = req.session?.user?.id;
  const tenantId = req.session?.user?.tenantId;
  if (!id || !tenantId) return res.status(401).json({ error: "Unauthorized" });

  const rs = await pool
    .request()
    .input("Id", mssql.Int, id)
    .input("TenantId", mssql.Char, tenantId)
    .query(`SELECT * FROM Users WHERE Id=@Id AND TenantId=@TenantId`);

  const row = rs.recordset[0];
  if (!row) return res.status(404).json({ error: "User not found" });
  res.json(row);
}

module.exports = { listUsers, getUser, createUser, updateUser, removeUser, me };
