// src/utils/audit.js
"use strict";

const { getPool } = require("../config/db");
const mssql = require("mssql");
const logger = require("../config/logger");

/**
 * Persist an audit entry.
 * - existingValue / updatedValue can be strings or objects; we stringify objects.
 * - We DO NOT write Audit.ExistingValue or Audit.UpdatedValue columns anymore.
 * - Message is stored as:
 *      {
 *        "ExistingValue": [ "<existingStr>" ] | null,
 *        "UpdatedValue":  [ "<updatedStr>" ]  | null
 *      }
 */
async function logAudit({
  userId,
  tableName,
  actionType,
  existingValue,
  updatedValue,
  tenantId,
  tenantUserId,
  createdDate,
  recordId,
  entityId,
}) {
  try {
    const pool = await getPool();

    // Normalize to strings (or null)
    const existingStr =
      existingValue == null
        ? null
        : typeof existingValue === "string"
          ? existingValue
          : JSON.stringify(existingValue);

    const updatedStr =
      updatedValue == null
        ? null
        : typeof updatedValue === "string"
          ? updatedValue
          : JSON.stringify(updatedValue);

    // Nested message payload
    const messageJson = JSON.stringify({
      ExistingValue: existingStr == null ? null : [existingStr],
      UpdatedValue: updatedStr == null ? null : [updatedStr],
    });

    // Note: We intentionally OMIT ExistingValue/UpdatedValue columns here.
    await pool
      .request()
      .input("UserId", mssql.Int, userId ?? null)
      .input("TableName", mssql.NVarChar, tableName ?? null)
      .input("RecordId", mssql.BigInt, recordId ?? entityId ?? null)
      .input("ActionType", mssql.NVarChar, actionType ?? null)
      .input("TenantId", mssql.Char, tenantId ?? null)
      .input("TenantUserId", mssql.NVarChar, tenantUserId ?? null)
      .input("Message", mssql.NVarChar(mssql.MAX), messageJson)
      .input("CreatedDate", mssql.DateTime, createdDate ?? new Date()).query(`
        INSERT INTO Audit (
          UserId, TableName, RecordId, ActionType,
          TenantId, TenantUserId,
          Message,
          CreatedDate
        )
        VALUES (
          @UserId, @TableName, @RecordId, @ActionType,
          @TenantId, @TenantUserId,
          @Message,
          @CreatedDate
        )
      `);
  } catch (err) {
    try {
      logger.error("Audit log failure", err);
    } catch {}
  }
}

module.exports = { logAudit };
