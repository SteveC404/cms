// src/controllers/clientsController.js
"use strict";

const mssql = require("mssql");
const bcrypt = require("bcrypt");
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
function dateOrNull(v) {
  if (v == null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined")
    return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function toYmd(d) {
  return d instanceof Date && !isNaN(d.getTime())
    ? d.toISOString().slice(0, 10)
    : null;
}
function normStr(v) {
  return v == null ? null : String(v);
}

/** GET /api/clients */
async function listClients(req, res) {
  const pool = await getPool();
  const tenantId = req.session?.user?.tenantId;
  const rs = await pool.request().input("TenantId", mssql.Char, tenantId)
    .query(`SELECT Id, FirstName, LastName, Email, Photo, Active, Comments,
                   CreatedBy, CreatedDate, UpdatedBy, UpdatedDate, TenantId
              FROM Clients
             WHERE TenantId=@TenantId
             ORDER BY Id DESC`);
  res.json(rs.recordset || []);
}

/** GET /api/clients/:id */
async function getClient(req, res) {
  const pool = await getPool();
  const tenantId = req.session?.user?.tenantId;
  const id = Number(req.params.id);
  const rs = await pool
    .request()
    .input("Id", mssql.Int, id)
    .input("TenantId", mssql.Char, tenantId)
    .query(`SELECT * FROM Clients WHERE Id=@Id AND TenantId=@TenantId`);
  const row = rs.recordset[0];
  if (!row) return res.status(404).json({ error: "Client not found" });
  // Ensure TenantId is present in response
  if (!row.TenantId && row.tenantId) row.TenantId = row.tenantId;
  res.json(row);
}

/** POST /api/clients */
async function createClient(req, res) {
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
    Phone,
    Address,
    City,
    State,
    Zip,
    Country,
    DateOfBirth,
    Gender,
  } = req.body || {};

  const activeBit = bitFrom(req.body?.Active ?? req.body?.active ?? null);
  const dob = dateOrNull(DateOfBirth);
  // Use existing tenantId variable if already declared above
  const photoPath = req.file && tenantId ? req.file.filename : null;
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
    .input("Phone", mssql.NVarChar, Phone || null)
    .input("Address", mssql.NVarChar, Address || null)
    .input("City", mssql.NVarChar, City || null)
    .input("State", mssql.NVarChar, State || null)
    .input("Zip", mssql.NVarChar, Zip || null)
    .input("Country", mssql.NVarChar, Country || null)
    .input("DateOfBirth", mssql.Date, dob)
    .input("Gender", mssql.NVarChar, Gender || null)
    .input("CreatedBy", mssql.NVarChar, createdBy)
    .input("CreatedDate", mssql.DateTime, now).query(`
      INSERT INTO Clients (
        TenantId, FirstName, LastName, Email, Photo, Active, Comments, Password,
        Phone, Address, City, State, Zip, Country, DateOfBirth, Gender,
        CreatedBy, CreatedDate
      )
      OUTPUT INSERTED.Id AS NewId
      VALUES (
        @TenantId, @FirstName, @LastName, @Email, @Photo, @Active, @Comments, @Password,
        @Phone, @Address, @City, @State, @Zip, @Country, @DateOfBirth, @Gender,
        @CreatedBy, @CreatedDate
      )
    `);

  const newId = ins.recordset[0].NewId;

  await logAudit({
    userId: req.session?.user?.id ?? null,
    tableName: "Clients",
    actionType: "CREATE",
    updatedValue: {
      FirstName,
      LastName,
      Email,
      Active: activeBit,
      Comments,
      DateOfBirth: dob ? toYmd(dob) : null,
    },
    tenantId,
    tenantUserId: req.session?.user?.tenantUserId ?? null,
  });

  res.status(201).json({ id: newId });
}

/** PUT/PATCH /api/clients/:id */
async function updateClient(req, res) {
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
    .query(`SELECT TOP 1 * FROM Clients WHERE Id=@Id AND TenantId=@TenantId`);
  const existing = exRs.recordset[0];
  if (!existing) return res.status(404).json({ error: "Client not found" });

  const {
    FirstName,
    LastName,
    Email,
    Comments,
    Password,
    Phone,
    Address,
    City,
    State,
    Zip,
    Country,
    DateOfBirth,
    Gender,
  } = req.body || {};

  const hasActive = hasOwn(req.body, "Active") || hasOwn(req.body, "active");
  const activeBit = hasActive
    ? bitFrom(req.body.Active ?? req.body.active)
    : null;

  const hasDOB =
    hasOwn(req.body, "DateOfBirth") || hasOwn(req.body, "dateOfBirth");
  const dob = hasDOB
    ? dateOrNull(req.body.DateOfBirth ?? req.body.dateOfBirth)
    : null;

  // Use existing tenantId variable if already declared above
  const photoPath = req.file && tenantId ? req.file.filename : null;
  const hash = Password ? await bcrypt.hash(Password, 10) : null;

  // diffs
  const changed = {};
  const ns = (k, vOld, vNew) => {
    const nv = normStr(vNew);
    if (nv !== normStr(vOld)) changed[k] = nv;
  };
  if (hasOwn(req.body, "FirstName"))
    ns("FirstName", existing.FirstName, FirstName);
  if (hasOwn(req.body, "LastName")) ns("LastName", existing.LastName, LastName);
  if (hasOwn(req.body, "Email")) ns("Email", existing.Email, Email);
  if (hasOwn(req.body, "Comments")) ns("Comments", existing.Comments, Comments);
  if (photoPath !== null) ns("Photo", existing.Photo, photoPath);
  if (hasActive) {
    const oldBit = existing.Active ? 1 : 0;
    if (activeBit !== oldBit) changed.Active = activeBit;
  }
  if (hasOwn(req.body, "Phone")) ns("Phone", existing.Phone, Phone);
  if (hasOwn(req.body, "Address")) ns("Address", existing.Address, Address);
  if (hasOwn(req.body, "City")) ns("City", existing.City, City);
  if (hasOwn(req.body, "State")) ns("State", existing.State, State);
  if (hasOwn(req.body, "Zip")) ns("Zip", existing.Zip, Zip);
  if (hasOwn(req.body, "Country")) ns("Country", existing.Country, Country);
  if (hasOwn(req.body, "Gender")) ns("Gender", existing.Gender, Gender);
  if (hasDOB) {
    const oldY = existing.DateOfBirth ? toYmd(existing.DateOfBirth) : null;
    const newY = dob ? toYmd(dob) : null;
    if (newY !== oldY) changed.DateOfBirth = newY;
  }

  const existingPayload = {
    FirstName: existing.FirstName,
    LastName: existing.LastName,
    Email: existing.Email,
  };
  for (const k of Object.keys(changed)) {
    if (k === "FirstName" || k === "LastName" || k === "Email") continue;
    existingPayload[k] =
      k === "DateOfBirth"
        ? existing.DateOfBirth
          ? toYmd(existing.DateOfBirth)
          : null
        : existing[k];
  }
  const updatedPayload = {};
  for (const k of Object.keys(changed)) updatedPayload[k] = changed[k];

  // update
  const sql = `
    UPDATE Clients SET
      FirstName   = COALESCE(@FirstName, FirstName),
      LastName    = COALESCE(@LastName, LastName),
      Email       = COALESCE(@Email, Email),
      Photo       = COALESCE(@Photo, Photo),
      Active      = COALESCE(@Active, Active),
      Comments    = COALESCE(@Comments, Comments),
      Password    = CASE WHEN @Password IS NULL THEN Password ELSE @Password END,
      Phone       = COALESCE(@Phone, Phone),
      Address     = COALESCE(@Address, Address),
      City        = COALESCE(@City, City),
      State       = COALESCE(@State, State),
      Zip         = COALESCE(@Zip, Zip),
      Country     = COALESCE(@Country, Country),
      Gender      = COALESCE(@Gender, Gender),
      DateOfBirth = CASE WHEN @HasDOB = 1 THEN @DateOfBirth ELSE DateOfBirth END,
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
    .input(
      "Phone",
      mssql.NVarChar,
      hasOwn(req.body, "Phone") ? (Phone ?? null) : null,
    )
    .input(
      "Address",
      mssql.NVarChar,
      hasOwn(req.body, "Address") ? (Address ?? null) : null,
    )
    .input(
      "City",
      mssql.NVarChar,
      hasOwn(req.body, "City") ? (City ?? null) : null,
    )
    .input(
      "State",
      mssql.NVarChar,
      hasOwn(req.body, "State") ? (State ?? null) : null,
    )
    .input(
      "Zip",
      mssql.NVarChar,
      hasOwn(req.body, "Zip") ? (Zip ?? null) : null,
    )
    .input(
      "Country",
      mssql.NVarChar,
      hasOwn(req.body, "Country") ? (Country ?? null) : null,
    )
    .input(
      "Gender",
      mssql.NVarChar,
      hasOwn(req.body, "Gender") ? (Gender ?? null) : null,
    )
    .input("HasDOB", mssql.Bit, hasDOB ? 1 : 0)
    .input("DateOfBirth", mssql.Date, dob)
    .input("UpdatedBy", mssql.NVarChar, updatedBy)
    .input("UpdatedDate", mssql.DateTime, now)
    .query(sql);

  await logAudit({
    userId: req.session?.user?.id ?? null,
    tableName: "Clients",
    actionType: "UPDATE",
    existingValue: existingPayload,
    updatedValue: updatedPayload,
    tenantId,
    tenantUserId: req.session?.user?.tenantUserId ?? null,
  });

  res.json({ success: true });
}

module.exports = { listClients, getClient, createClient, updateClient };
