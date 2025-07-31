#!/usr/bin/env powershell

# Database Migration Management Script
# Ensures consistent schema across all environments

Write-Host "🗄️ Database Migration Management" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Function to apply migrations to an environment
function Apply-Migrations {
    param(
        [string]$Environment,
        [string]$DatabaseName,
        [bool]$IsRemote = $false
    )
    
    Write-Host "`n📊 Applying migrations to $Environment environment..." -ForegroundColor Yellow
    
    if ($IsRemote) {
        Write-Host "🌐 Remote database: $DatabaseName" -ForegroundColor Green
        npx wrangler d1 migrations apply $DatabaseName --env $Environment --remote
    } else {
        Write-Host "💻 Local database: $DatabaseName" -ForegroundColor Green
        npx wrangler d1 migrations apply $DatabaseName --env $Environment --local
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migrations applied successfully to $Environment" -ForegroundColor Green
    } else {
        Write-Host "❌ Migration failed for $Environment" -ForegroundColor Red
        exit 1
    }
}

# Function to check migration status
function Check-MigrationStatus {
    param(
        [string]$Environment,
        [string]$DatabaseName,
        [bool]$IsRemote = $false
    )
    
    Write-Host "`n📋 Checking migration status for $Environment..." -ForegroundColor Yellow
    
    if ($IsRemote) {
        npx wrangler d1 migrations list $DatabaseName --env $Environment --remote
    } else {
        npx wrangler d1 migrations list $DatabaseName --env $Environment --local
    }
}

# Main execution
Write-Host "`nChoose an option:"
Write-Host "1. Apply migrations to LOCAL development database"
Write-Host "2. Apply migrations to STAGING database (remote)"
Write-Host "3. Apply migrations to PRODUCTION database (remote)"
Write-Host "4. Check migration status for all environments"
Write-Host "5. Create new migration file"

$choice = Read-Host "`nEnter your choice (1-5)"

switch ($choice) {
    "1" {
        Apply-Migrations -Environment "development" -DatabaseName "tamyla-auth-db-local" -IsRemote $false
    }
    "2" {
        Apply-Migrations -Environment "staging" -DatabaseName "tamyla-auth-db-staging" -IsRemote $true
    }
    "3" {
        Apply-Migrations -Environment "production" -DatabaseName "tamyla-auth-db" -IsRemote $true
    }
    "4" {
        Check-MigrationStatus -Environment "development" -DatabaseName "tamyla-auth-db-local" -IsRemote $false
        Check-MigrationStatus -Environment "staging" -DatabaseName "tamyla-auth-db-staging" -IsRemote $true
        Check-MigrationStatus -Environment "production" -DatabaseName "tamyla-auth-db" -IsRemote $true
    }
    "5" {
        $migrationName = Read-Host "Enter migration name (e.g., add_user_preferences)"
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $filename = "$timestamp" + "_$migrationName.sql"
        $filepath = "migrations/$filename"
        
        Write-Host "`n📝 Creating migration file: $filepath" -ForegroundColor Yellow
        
        $template = @"
-- Migration: $migrationName
-- Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

-- Add your SQL commands here
-- Example:
-- ALTER TABLE users ADD COLUMN new_field TEXT;
-- CREATE INDEX idx_users_new_field ON users(new_field);

"@
        Set-Content -Path $filepath -Value $template
        Write-Host "✅ Migration file created: $filepath" -ForegroundColor Green
        Write-Host "📝 Edit the file to add your SQL commands, then run this script again to apply." -ForegroundColor Cyan
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host "`n🎉 Migration management complete!" -ForegroundColor Green
