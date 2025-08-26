const mssql = require("mssql");
const bcrypt = require("bcrypt");
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

async function listClients(_req, res) {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT Id, FirstName, LastName, Email, Active
    FROM Clients
    ORDER BY Id DESC
  `);
  res.json(result.recordset);
}

async function getClient(req, res) {
  const id = Number(req.params.id);
  const pool = await getPool();
  const result = await pool.request().input("Id", mssql.Int, id).query(`
    SELECT
      Id, FirstName, LastName, Email, Active,
      Comments, Phone, Address, City, State, Zip, Country,
      DateOfBirth, Gender, Photo,
      CreatedBy, CreatedDate, UpdatedBy, UpdatedDate
    FROM Clients
    WHERE Id = @Id
  `);
  const row = result.recordset[0];
  if (!row) return res.status(404).json({ error: "Not Found" });
  return res.json(row);
}

/** POST /api/clients */
/** POST /api/clients */
async function createClient(req, res) {
  const {
    FirstName,
    LastName,
    Email,
    Comments,
    Active,
    Phone,
    Address,
    City,
    State,
    Zip,
    Country,
    DateOfBirth,
    Gender,
    Password,
  } = req.body || {};
  const photo = req.file ? req.file.filename : null;

  const pool = await getPool();
  const now = new Date();
  const createdBy = req.session?.user?.email || "system";

  const hash = Password ? await bcrypt.hash(Password, 10) : null;

  const inserted = await pool
    .request()
    .input("FirstName", mssql.NVarChar, FirstName || null)
    .input("LastName", mssql.NVarChar, LastName || null)
    .input("Email", mssql.NVarChar, Email || null)
    .input("Comments", mssql.NVarChar, Comments || null)
    .input(
      "Active",
      mssql.Bit,
      typeof Active === "boolean"
        ? Active
          ? 1
          : 0
        : String(Active).toLowerCase() === "true" ||
            Active === "on" ||
            Active === "1"
          ? 1
          : 0,
    )
    .input("Phone", mssql.NVarChar, Phone || null)
    .input("Address", mssql.NVarChar, Address || null)
    .input("City", mssql.NVarChar, City || null)
    .input("State", mssql.NVarChar, State || null)
    .input("Zip", mssql.NVarChar, Zip || null)
    .input("Country", mssql.NVarChar, Country || null)
    .input(
      "DateOfBirth",
      mssql.Date,
      DateOfBirth ? new Date(DateOfBirth) : null,
    ) // strict DATE
    .input("Gender", mssql.NVarChar, Gender || null)
    .input("Photo", mssql.NVarChar, photo || null)
    .input("Password", mssql.NVarChar, hash)
    .input("CreatedBy", mssql.NVarChar, createdBy)
    .input("CreatedDate", mssql.DateTime, now).query(`
      INSERT INTO Clients (
        FirstName, LastName, Email, Comments, Active,
        Phone, Address, City, State, Zip, Country,
        DateOfBirth, Gender, Photo, Password,
        CreatedBy, CreatedDate
      )
      OUTPUT INSERTED.Id, INSERTED.CreatedBy, INSERTED.CreatedDate
      VALUES (
        @FirstName, @LastName, @Email, @Comments, @Active,
        @Phone, @Address, @City, @State, @Zip, @Country,
        @DateOfBirth, @Gender, @Photo, @Password,
        @CreatedBy, @CreatedDate
      )
    `);

  const row = inserted.recordset[0];

  // Build the exact values entered to include in the audit (mask password)
  const auditPayload = {
    FirstName: FirstName || null,
    LastName: LastName || null,
    Email: Email || null,
    Comments: Comments || null,
    Active:
      typeof Active === "boolean"
        ? Active
          ? 1
          : 0
        : String(Active).toLowerCase() === "true" ||
            Active === "on" ||
            Active === "1"
          ? 1
          : 0,
    Phone: Phone || null,
    Address: Address || null,
    City: City || null,
    State: State || null,
    Zip: Zip || null,
    Country: Country || null,
    DateOfBirth: DateOfBirth || null, // original string value submitted
    Gender: Gender || null,
    Photo: photo || null,
    Password: Password ? "***" : null, // mask if present
  };

  await logAudit({
    userId: req.session?.user?.id ?? null,
    tableName: "Clients",
    recordId: row.Id,
    actionType: "CREATE",
    updatedValue: JSON.stringify(auditPayload),
  });

  return res.status(201).json({
    id: row.Id,
    createdBy: row.CreatedBy,
    createdDate: row.CreatedDate,
  });
}

/** PUT /api/clients/:id */
async function updateClient(req, res) {
  const id = Number(req.params.id);
  const {
    FirstName,
    LastName,
    Comments,
    Active,
    Phone,
    Address,
    City,
    State,
    Zip,
    Country,
    DateOfBirth,
    Gender,
    Password,
    Password2,
  } = req.body;
  const photo = req.file ? req.file.filename : null;

  const pool = await getPool();

  // Load existing row
  const prevRes = await pool.request().input("Id", mssql.Int, id).query(`
    SELECT *
    FROM Clients
    WHERE Id = @Id
  `);
  const prev = prevRes.recordset[0];
  if (!prev) return res.status(404).json({ error: "Client not found" });

  // normalize bit field
  if (prev) prev.Active = normalizeBit(prev.Active);

  // Normalize DateOfBirth
  let dobVal = null;
  if (DateOfBirth) {
    const parsed = new Date(DateOfBirth);
    if (!isNaN(parsed)) dobVal = parsed;
  }

  const next = {
    FirstName: FirstName ?? prev.FirstName,
    LastName: LastName ?? prev.LastName,
    Comments: Comments ?? prev.Comments,
    Active: Active != null ? toBit(Active) : prev.Active,
    Phone: Phone ?? prev.Phone,
    Address: Address ?? prev.Address,
    City: City ?? prev.City,
    State: State ?? prev.State,
    Zip: Zip ?? prev.Zip,
    Country: Country ?? prev.Country,
    DateOfBirth: dobVal ?? prev.DateOfBirth,
    Gender: Gender ?? prev.Gender,
    Photo: photo ? photo : prev.Photo,
  };

  // Compute diffs
  const changedOld = {};
  const changedNew = {};
  for (const k of [
    "FirstName",
    "LastName",
    "Comments",
    "Active",
    "Phone",
    "Address",
    "City",
    "State",
    "Zip",
    "Country",
    "DateOfBirth",
    "Gender",
    "Photo",
  ]) {
    let a = prev[k];
    let b = next[k];

    // normalize Active for comparison & audit values
    if (k === "Active") {
      a = normalizeBit(a);
      b = normalizeBit(b);
    }

    // dates compared as YYYY-MM-DD strings (you already had this pattern)
    const cmpA =
      a instanceof Date ? a.toISOString().slice(0, 10) : String(a ?? "");
    const cmpB =
      b instanceof Date ? b.toISOString().slice(0, 10) : String(b ?? "");

    if (cmpA !== cmpB) {
      // store the numeric 0/1 for Active in audit JSON
      changedOld[k] = k === "Active" ? normalizeBit(prev[k]) : prev[k];
      changedNew[k] = k === "Active" ? normalizeBit(next[k]) : next[k];
    }
  }

  let passwordChanged = false;
  if (Password) {
    if (Password !== Password2) {
      return res.status(400).json({ error: "Passwords do not match" });
    }
    passwordChanged = true;
    changedOld.Password = "***";
    changedNew.Password = "***";
  }

  if (Object.keys(changedNew).length === 0) {
    return res.json({ success: true, changed: 0 });
  }

  const now = new Date();
  const updatedBy = req.session?.user?.email || "system";

  const request = pool
    .request()
    .input("Id", mssql.Int, id)
    .input("FirstName", mssql.NVarChar, next.FirstName)
    .input("LastName", mssql.NVarChar, next.LastName)
    .input("Comments", mssql.NVarChar, next.Comments)
    .input("Active", mssql.Bit, next.Active)
    .input("Phone", mssql.NVarChar, next.Phone)
    .input("Address", mssql.NVarChar, next.Address)
    .input("City", mssql.NVarChar, next.City)
    .input("State", mssql.NVarChar, next.State)
    .input("Zip", mssql.NVarChar, next.Zip)
    .input("Country", mssql.NVarChar, next.Country)
    .input("DateOfBirth", mssql.Date, next.DateOfBirth || null)
    .input("Gender", mssql.NVarChar, next.Gender)
    .input("UpdatedBy", mssql.NVarChar, updatedBy)
    .input("UpdatedDate", mssql.DateTime, now);

  let setSql = `
    FirstName=@FirstName, LastName=@LastName, Comments=@Comments, Active=@Active,
    Phone=@Phone, Address=@Address, City=@City, State=@State, Zip=@Zip, Country=@Country,
    DateOfBirth=@DateOfBirth, Gender=@Gender,
    UpdatedBy=@UpdatedBy, UpdatedDate=@UpdatedDate
  `;

  if (photo) {
    request.input("Photo", mssql.NVarChar, next.Photo);
    setSql += `, Photo=@Photo`;
  }

  if (passwordChanged) {
    const hash = await bcrypt.hash(Password, 10);
    request.input("Password", mssql.NVarChar, hash);
    setSql += `, Password=@Password`;
  }

  await request.query(`UPDATE Clients SET ${setSql} WHERE Id=@Id`);

  await logAudit({
    userId: req.session?.user?.id ?? null,
    tableName: "Clients",
    recordId: id,
    actionType: "UPDATE",
    existingValue: JSON.stringify(changedOld),
    updatedValue: JSON.stringify(changedNew),
  });

  return res.json({
    success: true,
    changed: Object.keys(changedNew).length,
    updatedBy,
    updatedDate: now,
  });
}

module.exports = {
  listClients,
  getClient,
  createClient,
  updateClient,
};
