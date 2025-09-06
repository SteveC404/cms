const mssql = require("mssql");
const { getPool } = require("../config/db");
const { logAudit } = require("../utils/audit");

// List all tenants
async function listTenants(req, res) {
  const pool = await getPool();
  const rs = await pool
    .request()
    .query(`SELECT TenantId, TenantName FROM Tenants ORDER BY TenantName ASC`);
  res.json(rs.recordset || []);
}

// Get a single tenant
async function getTenant(req, res) {
  const pool = await getPool();
  const { id } = req.params;
  const rs = await pool
    .request()
    .input("TenantId", mssql.Char, id)
    .query(`SELECT TenantId, TenantName FROM Tenants WHERE TenantId=@TenantId`);
  const row = rs.recordset[0];
  if (!row) return res.status(404).json({ error: "Tenant not found" });
  res.json(row);
}

// Create a new tenant
async function createTenant(req, res) {
  const pool = await getPool();
  const { TenantName } = req.body;
  const userId = req.session?.user?.id || null;
  const tenantId = req.session?.user?.tenantId || null;
  const tenantUserId = req.session?.user?.tenantUserId || null;
  let newTenantId;
  let attempts = 0;
  let success = false;
  let errorMsg = "";
  while (attempts < 100 && !success) {
    attempts++;
    newTenantId = Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
    try {
      await pool
        .request()
        .input("TenantId", mssql.Char, newTenantId)
        .input("TenantName", mssql.NVarChar, TenantName)
        .query(
          `INSERT INTO Tenants (TenantId, TenantName) VALUES (@TenantId, @TenantName)`,
        );
      success = true;
    } catch (err) {
      if (err.message && err.message.includes("duplicate")) {
        continue;
      }
      errorMsg = err.message;
      break;
    }
  }
  if (!success) {
    const message = `A unique TenantId could not be found after ${attempts} tries. Please contact support for help.`;
    await logAudit({
      userId,
      tableName: "Tenants",
      actionType: "INSERT",
      createdDate: new Date(),
      tenantId,
      tenantUserId,
      message,
    });
    return res.status(500).json({ error: message });
  }
  // Success audit
  await logAudit({
    userId,
    tableName: "Tenants",
    actionType: "INSERT",
    createdDate: new Date(),
    tenantId,
    tenantUserId,
    message: JSON.stringify({ TenantId: newTenantId, TenantName }),
  });
  res.status(201).json({ TenantId: newTenantId, TenantName });
}

// Update a tenant
async function updateTenant(req, res) {
  const pool = await getPool();
  const { id } = req.params;
  const { TenantName } = req.body;
  const userId = req.session?.user?.id || null;
  const tenantId = req.session?.user?.tenantId || null;
  const tenantUserId = req.session?.user?.tenantUserId || null;
  await pool
    .request()
    .input("TenantId", mssql.Char, id)
    .input("TenantName", mssql.NVarChar, TenantName)
    .query(
      `UPDATE Tenants SET TenantName=@TenantName WHERE TenantId=@TenantId`,
    );
  await logAudit({
    userId,
    tableName: "Tenants",
    actionType: "UPDATE",
    createdDate: new Date(),
    tenantId,
    tenantUserId,
    message: JSON.stringify({ TenantId: id, TenantName }),
  });
  res.json({ TenantId: id, TenantName });
}

module.exports = { listTenants, getTenant, createTenant, updateTenant };
