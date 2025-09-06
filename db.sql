-- SQL script for Client Management System
-- Create database
CREATE DATABASE ClientManagement;
GO
USE ClientManagement;
GO

-- Create Users table
CREATE TABLE ClientManagement.dbo.Users
(
    Id int IDENTITY(1,1) NOT NULL,
    FirstName nvarchar(50) NOT NULL,
    LastName nvarchar(50) NOT NULL,
    Email nvarchar(100) NOT NULL,
    Photo nvarchar(255) NULL,
    Active bit DEFAULT 1 NOT NULL,
    Comments nvarchar(MAX) NULL,
    Password nvarchar(255) NULL,
    CreatedBy nvarchar(100) NULL,
    CreatedDate datetime DEFAULT getdate() NOT NULL,
    UpdatedBy nvarchar(100) NULL,
    UpdatedDate datetime NULL,
    Roles nvarchar(100) DEFAULT 'Clients' NOT NULL,
    TenantId char(4) NOT NULL,
    TenantUserId nvarchar(64) NULL,
    CONSTRAINT PK__Users__3214EC0757CDAB25 PRIMARY KEY (Id),
    CONSTRAINT UQ__Users__A9D10534EFC0ECC9 UNIQUE (Email)
);
CREATE NONCLUSTERED INDEX IX_Users_TenantId ON ClientManagement.dbo.Users (  TenantId ASC  )  
	 WITH (  PAD_INDEX = OFF ,FILLFACTOR = 100  ,SORT_IN_TEMPDB = OFF , IGNORE_DUP_KEY = OFF , STATISTICS_NORECOMPUTE = OFF , ONLINE = OFF , ALLOW_ROW_LOCKS = ON , ALLOW_PAGE_LOCKS = ON  )
	 ON [PRIMARY ]
;
CREATE UNIQUE NONCLUSTERED INDEX UX_Users_TenantUserId ON ClientManagement.dbo.Users (  TenantUserId ASC  )  
	 WITH (  PAD_INDEX = OFF ,FILLFACTOR = 100  ,SORT_IN_TEMPDB = OFF , IGNORE_DUP_KEY = OFF , STATISTICS_NORECOMPUTE = OFF , ONLINE = OFF , ALLOW_ROW_LOCKS = ON , ALLOW_PAGE_LOCKS = ON  )
	 ON [PRIMARY ]
;


-- Create Clients table
CREATE TABLE ClientManagement.dbo.Clients
(
    Id int IDENTITY(1,1) NOT NULL,
    FirstName nvarchar(50)NOT NULL,
    LastName nvarchar(50)NOT NULL,
    Email nvarchar(100)NOT NULL,
    Photo nvarchar(255)NULL,
    Active bit DEFAULT 1 NOT NULL,
    Comments nvarchar(MAX)NULL,
    Password nvarchar(255)NULL,
    CreatedBy nvarchar(100)NULL,
    CreatedDate datetime DEFAULT getdate() NOT NULL,
    UpdatedBy nvarchar(100)NULL,
    UpdatedDate datetime NULL,
    Phone nvarchar(20)NULL,
    Address nvarchar(255)NULL,
    City nvarchar(100)NULL,
    State nvarchar(100)NULL,
    Zip nvarchar(20)NULL,
    Country nvarchar(100)NULL,
    DateOfBirth date NULL,
    Gender nvarchar(20)NULL,
    TenantId char(4)NOT NULL,
    CONSTRAINT PK__Clients__3214EC0764611EF9 PRIMARY KEY (Id),
    CONSTRAINT UQ__Clients__A9D10534230859B1 UNIQUE (Email)
);
CREATE NONCLUSTERED INDEX IX_Clients_TenantId ON ClientManagement.dbo.Clients (  TenantId ASC  )  
	 WITH (  PAD_INDEX = OFF ,FILLFACTOR = 100  ,SORT_IN_TEMPDB = OFF , IGNORE_DUP_KEY = OFF , STATISTICS_NORECOMPUTE = OFF , ONLINE = OFF , ALLOW_ROW_LOCKS = ON , ALLOW_PAGE_LOCKS = ON  )
	 ON [PRIMARY ]
;


-- Create Tenants table
CREATE TABLE ClientManagement.dbo.Tenants
(
    TenantId char(4) NOT NULL,
    TenantName nvarchar(255) NOT NULL,
    CONSTRAINT PK__SystemSe__2D971CAC71F8AFDB PRIMARY KEY (TenantId)
);



--Create Audit table
CREATE TABLE ClientManagement.dbo.Audit
(
    Id int IDENTITY(1,1) NOT NULL,
    UserId int NULL,
    TableName nvarchar(128)NULL,
    ActionType nvarchar(64)NULL,
    CreatedDate datetime DEFAULT getdate() NOT NULL,
    TenantId char(4)NULL,
    TenantUserId nvarchar(64)NULL,
    Message nvarchar(MAX)NULL,
    CONSTRAINT PK__Audit__3214EC07AF57E021 PRIMARY KEY (Id)
);
CREATE NONCLUSTERED INDEX IX_Audit_TenantId ON ClientManagement.dbo.Audit (  TenantId ASC  )  
	 WITH (  PAD_INDEX = OFF ,FILLFACTOR = 100  ,SORT_IN_TEMPDB = OFF , IGNORE_DUP_KEY = OFF , STATISTICS_NORECOMPUTE = OFF , ONLINE = OFF , ALLOW_ROW_LOCKS = ON , ALLOW_PAGE_LOCKS = ON  )
	 ON [PRIMARY ]
;
CREATE NONCLUSTERED INDEX IX_Audit_TenantUserId ON ClientManagement.dbo.Audit (  TenantUserId ASC  )  
	 WITH (  PAD_INDEX = OFF ,FILLFACTOR = 100  ,SORT_IN_TEMPDB = OFF , IGNORE_DUP_KEY = OFF , STATISTICS_NORECOMPUTE = OFF , ONLINE = OFF , ALLOW_ROW_LOCKS = ON , ALLOW_PAGE_LOCKS = ON  )
	 ON [PRIMARY ]
;

-- Insert initial admin user (password will be hashed in app, set blank here)
INSERT INTO Users
    (FirstName, LastName, Email, Active, Comments, Password, CreatedBy, CreatedDate)
VALUES
    ('admin', 'admin', 'admin@home', 1, 'Initial user', '', 'admin@home', GETDATE());
GO
