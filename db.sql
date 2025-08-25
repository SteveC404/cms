-- SQL script for Client Management System
-- Create database
CREATE DATABASE ClientManagement;
GO
USE ClientManagement;
GO

-- Create Users table
CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    FirstName NVARCHAR(50) NOT NULL,
    LastName NVARCHAR(50) NOT NULL,
    Email NVARCHAR(100) NOT NULL UNIQUE,
    Photo NVARCHAR(255),
    Active BIT NOT NULL DEFAULT 1,
    Comments NVARCHAR(MAX),
    Password NVARCHAR(255),
    CreatedBy NVARCHAR(100),
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedBy NVARCHAR(100),
    UpdatedDate DATETIME
);

-- Create Clients table
CREATE TABLE Clients (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    FirstName NVARCHAR(50) NOT NULL,
    LastName NVARCHAR(50) NOT NULL,
    Email NVARCHAR(100) NOT NULL UNIQUE,
    Photo NVARCHAR(255),
    Active BIT NOT NULL DEFAULT 1,
    Comments NVARCHAR(MAX),
    Password NVARCHAR(255),
    CreatedBy NVARCHAR(100),
    CreatedDate DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedBy NVARCHAR(100),
    UpdatedDate DATETIME,
    -- Typical demographic details
    Phone NVARCHAR(20),
    Address NVARCHAR(255),
    City NVARCHAR(100),
    State NVARCHAR(100),
    Zip NVARCHAR(20),
    Country NVARCHAR(100),
    DateOfBirth DATE,
    Gender NVARCHAR(20)
);

-- Insert initial admin user (password will be hashed in app, set blank here)
INSERT INTO Users (FirstName, LastName, Email, Active, Comments, Password, CreatedBy, CreatedDate)
VALUES ('admin', 'admin', 'admin@home', 1, 'Initial user', '', 'admin@home', GETDATE());
GO
