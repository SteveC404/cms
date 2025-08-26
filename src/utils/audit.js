// src/utils/audit.js
"use strict";

const { getPool } = require("../config/db");
const mssql = require("mssql");
const logger = require("../config/logger");

/**
 * Persist an audit entry, resilient to schema differences:
 * - Works whether your Audit table has (TenantId, TenantUserId) OR (CompanyId, CompanyUserId) OR neither.
 * - No use of RecordId.
 * - Packs extra context into Message (JSON string).
 */
async function logAudit({
  userId,
  tableName,
  actionType,
  tenantId,
  tenantUserId,
  message,
  existingValue,
  updatedValue,
  createdDate,
  entityId,
}) {
  try {
    const pool = await getPool();

    const existingStr =
      existingValue == null
        ? null
        : typeof existingValue === "string"
          ? existingValue
          : safeStringify(existingValue);

    const updatedStr =
      updatedValue == null
        ? null
        : typeof updatedValue === "string"
          ? updatedValue
          : safeStringify(updatedValue);

    const body = {
      ...(message && typeof message === "object"
        ? message
        : { Note: message ?? null }),
      ExistingValue: existingStr,
      UpdatedValue: updatedStr,
      ...(entityId != null ? { EntityId: entityId } : {}),
    };

    const now = createdDate instanceof Date ? createdDate : new Date();

    // We support multiple schema variants by branching in T-SQL:
    // 1) CompanyId/CompanyUserId
    // 2) TenantId/TenantUserId
    // 3) Neither tenant/company columns
    const sql = `
      DECLARE @HasCompany bit = CASE WHEN COL_LENGTH('dbo.Audit','CompanyId') IS NULL THEN 0 ELSE 1 END;
      DECLARE @HasCompanyUser bit = CASE WHEN COL_LENGTH('dbo.Audit','CompanyUserId') IS NULL THEN 0 ELSE 1 END;
      DECLARE @HasTenant bit = CASE WHEN COL_LENGTH('dbo.Audit','TenantId') IS NULL THEN 0 ELSE 1 END;
      DECLARE @HasTenantUser bit = CASE WHEN COL_LENGTH('dbo.Audit','TenantUserId') IS NULL THEN 0 ELSE 1 END;

      IF (@HasCompany = 1 AND @HasCompanyUser = 1)
      BEGIN
        INSERT INTO dbo.Audit (
          UserId, TableName, ActionType,
          CompanyId, CompanyUserId,
          Message, CreatedDate
        ) VALUES (
          @UserId, @TableName, @ActionType,
          @TenantId, @TenantUserId,
          @Message, @CreatedDate
        );
        RETURN;
      END

      IF (@HasTenant = 1 AND @HasTenantUser = 1)
      BEGIN
        INSERT INTO dbo.Audit (
          UserId, TableName, ActionType,
          TenantId, TenantUserId,
          Message, CreatedDate
        ) VALUES (
          @UserId, @TableName, @ActionType,
          @TenantId, @TenantUserId,
          @Message, @CreatedDate
        );
        RETURN;
      END

      -- Fallback: no tenant/company columns available
      INSERT INTO dbo.Audit (
        UserId, TableName, ActionType,
        Message, CreatedDate
      ) VALUES (
        @UserId, @TableName, @ActionType,
        @Message, @CreatedDate
      );
    `;

    await pool
      .request()
      .input("UserId", mssql.Int, asNullableInt(userId))
      .input("TableName", mssql.NVarChar(128), tableName ?? null)
      .input("ActionType", mssql.NVarChar(64), actionType ?? null)
      .input("TenantId", mssql.NVarChar(64), nullableString(tenantId)) // tolerant to underlying type
      .input("TenantUserId", mssql.NVarChar(128), nullableString(tenantUserId))
      .input("Message", mssql.NVarChar(mssql.MAX), safeStringify(body))
      .input("CreatedDate", mssql.DateTime, now)
      .query(sql);
  } catch (err) {}
}

/** Helpers **/
function safeStringify(obj) {
  try {
    return JSON.stringify(obj);
  } catch {
    try {
      return String(obj);
    } catch {
      return null;
    }
  }
}

function asNullableInt(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function nullableString(v) {
  if (v == null) return null;
  if (typeof v === "string") return v;
  try {
    return String(v);
  } catch {
    return null;
  }
}

module.exports = { logAudit };
