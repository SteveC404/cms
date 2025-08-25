-- Audit table for Client Management System
USE ClientManagement;
GO

CREATE TABLE Audit
(
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    ActionDate DATETIME NOT NULL DEFAULT GETDATE(),
    UserId INT NOT NULL,
    TableName NVARCHAR(50) NOT NULL,
    RecordId INT NOT NULL,
    ActionType NVARCHAR(20) NOT NULL,
    -- e.g. LOGIN, LOGOUT, UPDATE
    ExistingValue NVARCHAR(MAX),
    UpdatedValue NVARCHAR(MAX)
);
GO
