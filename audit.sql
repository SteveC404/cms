-- Audit table for Client Management System
USE ClientManagement;
GO

IF NOT EXISTS (
  SELECT 1
FROM sys.objects
WHERE object_id = OBJECT_ID(N'[dbo].[Audit]') AND type = N'U'
)
BEGIN
  CREATE TABLE [dbo].[Audit]
  (
    [Id] BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [UserId] INT NULL,
    [TableName] NVARCHAR(128) NULL,
    [RecordId] BIGINT NULL,
    [ActionType] NVARCHAR(64) NULL,
    [ExistingValue] NVARCHAR(MAX) NULL,
    [UpdatedValue] NVARCHAR(MAX) NULL,
    [CreatedDate] DATETIME NOT NULL DEFAULT (GETDATE())
  );
END;
