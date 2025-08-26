// src/utils/audit.js
const { getPool } = require("../config/db");
const mssql = require("mssql");
const logger = require("../config/logger");

/**
 * Persist an audit entry.
 * - Accepts either `recordId` or `entityId` (prefers recordId if both present).
 * - ExistingValue / UpdatedValue can be strings or plain objects (objects are JSON-stringified).
 * - RecordId is bound as BIGINT (pass number, string, or JS BigInt).
 */
async function logAudit({
  userId,
  tableName,
  actionType,
  // id aliases:
  recordId = null,
  entityId = null,
  // payloads:
  existingValue = "",
  updatedValue = "",
  // optional explicit created date
  createdDate = null,
}) {
  // Prefer recordId; fall back to entityId
  const targetId = recordId ?? entityId ?? null;

  // Normalize ID for mssql.BigInt binding (string is safest for large values)
  const recordIdParam =
    targetId == null
      ? null
      : typeof targetId === "bigint"
        ? targetId.toString()
        : typeof targetId === "number"
          ? String(targetId)
          : String(targetId); // any other type -> toString

  // Ensure values are strings (auto-JSONify objects)
  const toStr = (v) =>
    v == null
      ? ""
      : typeof v === "string"
        ? v
        : (() => {
            try {
              return JSON.stringify(v);
            } catch {
              return String(v);
            }
          })();

  const existingStr = toStr(existingValue);
  const updatedStr = toStr(updatedValue);

  try {
    const pool = await getPool();
    await pool
      .request()
      .input("RecordId", mssql.BigInt, recordIdParam) // BIGINT column
      .input("UserId", mssql.Int, userId ?? null) // adjust to BigInt if your Users.Id is BIGINT
      .input("TableName", mssql.NVarChar(128), tableName ?? null)
      .input("ActionType", mssql.NVarChar(64), actionType ?? null)
      .input("ExistingValue", mssql.NVarChar(mssql.MAX), existingStr)
      .input("UpdatedValue", mssql.NVarChar(mssql.MAX), updatedStr)
      .input("CreatedDate", mssql.DateTime, createdDate || new Date()).query(`
        INSERT INTO Audit (
          UserId, TableName, RecordId, ActionType, ExistingValue, UpdatedValue, CreatedDate
        )
        VALUES (
          @UserId, @TableName, @RecordId, @ActionType, @ExistingValue, @UpdatedValue, @CreatedDate
        )
      `);
  } catch (err) {
    // Don't break the user flow if audit fails—just log it.
    logger.error("Audit log failure", err);
  }
}

module.exports = { logAudit };
