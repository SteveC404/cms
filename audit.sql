-- Audit table for Client Management System (updated)
USE ClientManagement;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.objects
  WHERE object_id = OBJECT_ID(N'[dbo].[Audit]') AND type = N'U'
)
BEGIN
  CREATE TABLE ClientManagement.dbo.Audit
  (
    Id BIGINT IDENTITY(1,1) NOT NULL,
    UserId INT NULL,
    TableName NVARCHAR(128) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    ActionType NVARCHAR(64) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    CreatedDate DATETIME DEFAULT getdate() NOT NULL,
    CompanyId CHAR(4) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    CompanyUserId NVARCHAR(64) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    Message NVARCHAR(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    CONSTRAINT PK_Audit PRIMARY KEY CLUSTERED (Id)
  );
  CREATE NONCLUSTERED INDEX IX_Audit_CompanyId ON ClientManagement.dbo.Audit (CompanyId);
  CREATE NONCLUSTERED INDEX IX_Audit_CompanyUserId ON ClientManagement.dbo.Audit (CompanyUserId);
END;
