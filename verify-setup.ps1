# Quick verification script to check if everything is ready for migration

Write-Host ""
Write-Host "🔍 Verifying Migration Setup..." -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Check .env file
Write-Host "1. Checking environment variables..." -ForegroundColor Yellow
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "SUPABASE_URL") {
        Write-Host "   ✅ SUPABASE_URL is set" -ForegroundColor Green
    } else {
        Write-Host "   ❌ SUPABASE_URL is missing" -ForegroundColor Red
        $allGood = $false
    }
    
    if ($envContent -match "SUPABASE_SERVICE_ROLE_KEY") {
        Write-Host "   ✅ SUPABASE_SERVICE_ROLE_KEY is set" -ForegroundColor Green
    } else {
        Write-Host "   ❌ SUPABASE_SERVICE_ROLE_KEY is missing" -ForegroundColor Red
        $allGood = $false
    }
} else {
    Write-Host "   ❌ .env file not found" -ForegroundColor Red
    $allGood = $false
}

# Check migration script
Write-Host ""
Write-Host "2. Checking migration script..." -ForegroundColor Yellow
if (Test-Path "backend\src\scripts\migrate-to-supabase.ts") {
    Write-Host "   ✅ Migration script exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ Migration script not found" -ForegroundColor Red
    $allGood = $false
}

# Check schema file
Write-Host ""
Write-Host "3. Checking database schema file..." -ForegroundColor Yellow
if (Test-Path "supabase\migrations\001_initial_schema.sql") {
    Write-Host "   ✅ Schema SQL file exists" -ForegroundColor Green
} else {
    Write-Host "   ❌ Schema SQL file not found" -ForegroundColor Red
    $allGood = $false
}

# Check package.json
Write-Host ""
Write-Host "4. Checking package.json..." -ForegroundColor Yellow
if (Test-Path "backend\package.json") {
    $pkg = Get-Content "backend\package.json" | ConvertFrom-Json
    if ($pkg.scripts.'migrate:supabase') {
        Write-Host "   ✅ Migration script command exists" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Migration script command not found" -ForegroundColor Red
        $allGood = $false
    }
    
    if ($pkg.dependencies.'@supabase/supabase-js') {
        Write-Host "   ✅ @supabase/supabase-js is installed" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  @supabase/supabase-js may not be installed" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ❌ package.json not found" -ForegroundColor Red
    $allGood = $false
}

Write-Host ""
$separator = "=================================================="
Write-Host $separator -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ All checks passed! Ready to migrate." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Create database schema in Supabase SQL Editor" -ForegroundColor White
    Write-Host "   → Open: supabase\migrations\SCHEMA_READY_TO_COPY.sql" -ForegroundColor Gray
    Write-Host "   → Copy all contents" -ForegroundColor Gray
    Write-Host "   → Paste into: https://supabase.com/dashboard/project/lyxwslsckkbcpepxigdx/sql/new" -ForegroundColor Gray
    Write-Host "   → Click 'Run'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Then run migration:" -ForegroundColor White
    Write-Host "   cd backend" -ForegroundColor Cyan
    Write-Host "   npm run migrate:supabase" -ForegroundColor Cyan
} else {
    Write-Host "❌ Some checks failed. Please fix the issues above." -ForegroundColor Red
}
Write-Host $separator -ForegroundColor Cyan
Write-Host ""
