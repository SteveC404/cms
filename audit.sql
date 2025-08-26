-- Audit table for Client Management System
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
    Id int IDENTITY(1,1) NOT NULL,
    UserId int NULL,
    TableName nvarchar(128) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    RecordId bigint NULL,
    ActionType nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    CreatedDate datetime DEFAULT getdate() NOT NULL,
    CompanyId char(4) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    CompanyUserId nvarchar(64) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    Message nvarchar(MAX) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
    CONSTRAINT PK__Audit__3214EC07AF57E021 PRIMARY KEY (Id)
  );
  CREATE NONCLUSTERED INDEX IX_Audit_CompanyId ON ClientManagement.dbo.Audit (CompanyId);
  CREATE NONCLUSTERED INDEX IX_Audit_CompanyUserId ON ClientManagement.dbo.Audit (CompanyUserId);
END;
