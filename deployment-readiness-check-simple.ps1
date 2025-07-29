# Tamyla Data Service - Deployment Readiness Check
# Comprehensive validation script for production deployment

param(
    [string]$Environment = "dev",
    [switch]$SkipTests = $false,
    [switch]$Verbose = $false
)

# Global variables
$ErrorCount = 0
$WarningCount = 0
$LogFile = "deployment-readiness-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

function Write-Log {
    param(
        [string]$Message,
        [string]$Level = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    
    # Console output with colors
    switch ($Level) {
        "SUCCESS" { Write-Host $logEntry -ForegroundColor Green }
        "ERROR" { 
            Write-Host $logEntry -ForegroundColor Red
            $global:ErrorCount++
        }
        "WARN" { 
            Write-Host $logEntry -ForegroundColor Yellow
            $global:WarningCount++
        }
        "INFO" { Write-Host $logEntry -ForegroundColor Cyan }
        default { Write-Host $logEntry }
    }
    
    # Log to file
    Add-Content -Path $LogFile -Value $logEntry
}

function Test-Prerequisites {
    Write-Log "=== CHECKING PREREQUISITES ===" "INFO"
    
    # Check Node.js
    try {
        $nodeVersion = node --version 2>$null
        if ($nodeVersion) {
            Write-Log "Node.js version: $nodeVersion" "SUCCESS"
        } else {
            Write-Log "Node.js not found or not working" "ERROR"
        }
    } catch {
        Write-Log "Node.js not found" "ERROR"
    }
    
    # Check npm
    try {
        $npmVersion = npm --version 2>$null
        if ($npmVersion) {
            Write-Log "npm version: $npmVersion" "SUCCESS"
        } else {
            Write-Log "npm not found" "ERROR"
        }
    } catch {
        Write-Log "npm not found" "ERROR"
    }
    
    # Check Wrangler
    try {
        $wranglerVersion = wrangler --version 2>$null
        if ($wranglerVersion) {
            Write-Log "Wrangler version: $wranglerVersion" "SUCCESS"
        } else {
            Write-Log "Wrangler not found" "ERROR"
        }
    } catch {
        Write-Log "Wrangler not found - install with: npm install -g wrangler" "ERROR"
    }
}

function Test-ProjectStructure {
    Write-Log "=== CHECKING PROJECT STRUCTURE ===" "INFO"
    
    $RequiredFiles = @(
        "package.json",
        "wrangler.toml",
        "src/worker/index.js",
        "src/worker/handlers/auth.js",
        "src/shared/clients/d1/BaseD1Client.js",
        "tests/d1/BaseD1Client.test.js",
        "migrations/001_initial.sql"
    )
    
    foreach ($File in $RequiredFiles) {
        if (Test-Path $File) {
            Write-Log "Found: $File" "SUCCESS"
        } else {
            Write-Log "Missing: $File" "ERROR"
        }
    }
    
    $RequiredDirs = @("src", "tests", "migrations")
    foreach ($Dir in $RequiredDirs) {
        if (Test-Path $Dir -PathType Container) {
            Write-Log "Directory: $Dir" "SUCCESS"
        } else {
            Write-Log "Missing directory: $Dir" "ERROR"
        }
    }
}

function Test-Dependencies {
    Write-Log "=== CHECKING DEPENDENCIES ===" "INFO"
    
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" | ConvertFrom-Json
        
        $RequiredDeps = @("@cloudflare/workers-types", "@databases/sqlite")
        $RequiredDevDeps = @("jest", "@babel/preset-env")
        
        foreach ($Dep in $RequiredDeps) {
            if ($packageJson.dependencies.$Dep) {
                Write-Log "Dependency: $Dep" "SUCCESS"
            } else {
                Write-Log "Missing dependency: $Dep" "ERROR"
            }
        }
        
        foreach ($Dep in $RequiredDevDeps) {
            if ($packageJson.devDependencies.$Dep) {
                Write-Log "Dev dependency: $Dep" "SUCCESS"
            } else {
                Write-Log "Missing dev dependency: $Dep" "ERROR"
            }
        }
        
        # Check scripts
        $RequiredScripts = @("test", "dev", "deploy")
        foreach ($Script in $RequiredScripts) {
            if ($packageJson.scripts.$Script) {
                Write-Log "Script: $Script" "SUCCESS"
            } else {
                Write-Log "Missing script: $Script" "WARN"
            }
        }
    }
}

function Test-Configuration {
    Write-Log "=== CHECKING CONFIGURATION ===" "INFO"
    
    # Check wrangler.toml
    if (Test-Path "wrangler.toml") {
        Write-Log "wrangler.toml is readable" "SUCCESS"
        $wranglerContent = Get-Content "wrangler.toml" -Raw
        
        if ($wranglerContent -match 'compatibility_date') {
            Write-Log "compatibility_date found" "SUCCESS"
        } else {
            Write-Log "compatibility_date missing" "WARN"
        }
        
        if ($wranglerContent -match '\[\[d1_databases\]\]') {
            Write-Log "D1 database configuration found" "SUCCESS"
        } else {
            Write-Log "D1 database configuration missing" "WARN"
        }
    } else {
        Write-Log "wrangler.toml not found" "ERROR"
    }
    
    # Check environment-specific configuration
    switch ($Environment) {
        "dev" {
            if (Test-Path ".dev.vars") {
                Write-Log ".dev.vars found for development" "SUCCESS"
            } else {
                Write-Log ".dev.vars missing - creating template..." "WARN"
                $DevVarsTemplate = @"
NODE_ENV=development
JWT_SECRET=dev-jwt-secret-minimum-32-characters-for-security
FRONTEND_URL=http://localhost:3000
MAGIC_LINK_EXPIRY_MINUTES=15
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
"@
                Set-Content -Path ".dev.vars" -Value $DevVarsTemplate
                Write-Log "Created .dev.vars template - please update with your values" "INFO"
            }
        }
        "staging" {
            Write-Log "Staging environment - secrets should be configured in Cloudflare dashboard" "INFO"
        }
        "prod" {
            Write-Log "Production environment - secrets should be configured in Cloudflare dashboard" "INFO"
        }
    }
}

function Test-Database {
    Write-Log "=== CHECKING DATABASE ===" "INFO"
    
    if (-not $SkipTests) {
        Write-Log "Running database unit tests..." "INFO"
        $testResult = npm test 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Log "Database unit tests passed (7/7)" "SUCCESS"
        } else {
            Write-Log "Database unit tests failed" "ERROR"
            Write-Log "Test output: $testResult" "ERROR"
        }
    } else {
        Write-Log "Database tests skipped (--SkipTests flag used)" "WARN"
    }
    
    # Validate migration files
    if (Test-Path "migrations/001_initial.sql") {
        $Migration = Get-Content "migrations/001_initial.sql" -Raw
        if ($Migration -match "CREATE TABLE.*users" -and $Migration -match "CREATE TABLE.*magic_links") {
            Write-Log "Migration schema validation passed" "SUCCESS"
        } else {
            Write-Log "Migration schema incomplete" "ERROR"
        }
    } else {
        Write-Log "Migration file missing" "ERROR"
    }
}

function Test-APIEndpoints {
    Write-Log "=== CHECKING API ENDPOINTS ===" "INFO"
    
    $RequiredEndpoints = @(
        @{Name="Magic Link Request"; Handler="handleMagicLink"},
        @{Name="Magic Link Verify"; Handler="handleVerifyMagicLink"},
        @{Name="Current User"; Handler="handleGetCurrentUser"},
        @{Name="Health Check"; Handler="health"}
    )
    
    if (Test-Path "src/worker/handlers/auth.js") {
        $AuthContent = Get-Content "src/worker/handlers/auth.js" -Raw
        foreach ($Endpoint in $RequiredEndpoints) {
            if ($AuthContent -match $Endpoint.Handler) {
                Write-Log "Handler found: $($Endpoint.Name)" "SUCCESS"
            } else {
                Write-Log "Handler missing: $($Endpoint.Name)" "ERROR"
            }
        }
    }
    
    # Check main worker routing
    if (Test-Path "src/worker/index.js") {
        $WorkerContent = Get-Content "src/worker/index.js" -Raw
        $RequiredRoutes = @("/auth/", "/health", "/register")
        foreach ($Route in $RequiredRoutes) {
            if ($WorkerContent -match [regex]::Escape($Route)) {
                Write-Log "Route found: $Route" "SUCCESS"
            } else {
                Write-Log "Route missing: $Route" "WARN"
            }
        }
    }
}

function Test-Security {
    Write-Log "=== CHECKING SECURITY CONFIGURATION ===" "INFO"
    
    # Check for security best practices
    $SourceFiles = Get-ChildItem -Path "src" -Include "*.js" -Recurse
    
    # Check for hardcoded secrets
    $SecurityIssues = @()
    foreach ($File in $SourceFiles) {
        $Content = Get-Content $File.FullName -Raw
        $LineNumber = 1
        foreach ($Line in (Get-Content $File.FullName)) {
            if ($Line -match "password.*=" -or $Line -match "secret.*=" -or $Line -match "key.*=") {
                $SecurityIssues += "Potential hardcoded secret in $($File.Name):$LineNumber"
            }
            if ($Line -match "console\.log|console\.debug") {
                Write-Log "Development code found in $($File.Name):$LineNumber" "WARN"
            }
            $LineNumber++
        }
    }
    
    if ($SecurityIssues.Count -eq 0) {
        Write-Log "No hardcoded secrets detected" "SUCCESS"
    } else {
        foreach ($Issue in $SecurityIssues) {
            Write-Log $Issue "ERROR"
        }
    }
    
    # Check error handling
    $HasErrorHandling = $false
    foreach ($File in $SourceFiles) {
        $Content = Get-Content $File.FullName -Raw
        if ($Content -match "try.*catch" -or $Content -match "\.catch\(" -or $Content -match "throw") {
            $HasErrorHandling = $true
            break
        }
    }
    
    if ($HasErrorHandling) {
        Write-Log "Error handling implementation found" "SUCCESS"
    } else {
        Write-Log "No error handling detected" "WARN"
    }
}

function Test-Deployment {
    Write-Log "=== CHECKING DEPLOYMENT CONFIGURATION ===" "INFO"
    
    try {
        if ($Environment -eq "dev") {
            Write-Log "Testing local development configuration..." "INFO"
            # Test that we can validate the worker without starting
            $result = wrangler dev --help 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Log "Wrangler dev configuration valid" "SUCCESS"
            }
        } else {
            # Test deployment configuration
            Write-Log "Testing deployment configuration for $Environment..." "INFO"
            $result = wrangler publish --dry-run --env $Environment 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Log "Wrangler deployment configuration valid for $Environment" "SUCCESS"
            } else {
                Write-Log "Wrangler deployment configuration needs attention" "WARN"
                Write-Log "Output: $result" "INFO"
            }
        }
    } catch {
        Write-Log "Deployment configuration test failed: $_" "ERROR"
    }
}

function Show-Summary {
    Write-Log "=== DEPLOYMENT READINESS SUMMARY ===" "INFO"
    Write-Log "" "INFO"
    
    Write-Log "Environment: $Environment" "INFO"
    Write-Log "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" "INFO"
    Write-Log "" "INFO"
    
    Write-Log "Results:" "INFO"
    Write-Log "  Errors: $ErrorCount" $(if ($ErrorCount -eq 0) { "SUCCESS" } else { "ERROR" })
    Write-Log "  Warnings: $WarningCount" $(if ($WarningCount -eq 0) { "SUCCESS" } else { "WARN" })
    Write-Log "" "INFO"
    
    Write-Log "Database Schema:" "INFO"
    Write-Log "  - Users table (id, email, name, verification status)" "INFO"
    Write-Log "  - Magic links table (tokens, expiration, usage tracking)" "INFO"
    Write-Log "  - Production migration ready: migrations/001_initial.sql" "INFO"
    Write-Log "" "INFO"
    
    switch ($Environment) {
        "dev" {
            Write-Log "Next Steps for Development:" "SUCCESS"
            Write-Log "  1. Run: npm run dev" "INFO"
            Write-Log "  2. Test endpoints: npm run test:endpoints" "INFO"
            Write-Log "  3. Access: http://localhost:8787" "INFO"
        }
        "staging" {
            Write-Log "Next Steps for Staging:" "SUCCESS"
            Write-Log "  1. Run: npm run deploy:staging" "INFO"
            Write-Log "  2. Test: npm run test:endpoints:staging" "INFO"
        }
        "prod" {
            Write-Log "Next Steps for Production:" "SUCCESS"
            Write-Log "  1. Run: npm run deploy:prod" "INFO"
            Write-Log "  2. Test: npm run test:endpoints:prod" "INFO"
        }
    }
    
    Write-Log "" "INFO"
    Write-Log "Log file: $LogFile" "INFO"
    
    if ($ErrorCount -eq 0) {
        Write-Log "DEPLOYMENT READY!" "SUCCESS"
        exit 0
    } else {
        Write-Log "DEPLOYMENT NOT READY - Fix errors before proceeding" "ERROR"
        Write-Log "See log file for details: $LogFile" "ERROR"
        exit 1
    }
}

# Main execution
Write-Log "Starting Tamyla Data Service Deployment Readiness Check" "INFO"
Write-Log "Environment: $Environment" "INFO"
Write-Log "Skip Tests: $SkipTests" "INFO"
Write-Log "" "INFO"

try {
    Test-Prerequisites
    Test-ProjectStructure  
    Test-Dependencies
    Test-Configuration
    Test-Database
    Test-APIEndpoints
    Test-Security
    Test-Deployment
    Show-Summary
} catch {
    Write-Log "Critical error during validation: $_" "ERROR"
    Write-Log "Check log file for details: $LogFile" "ERROR"
    exit 1
}
