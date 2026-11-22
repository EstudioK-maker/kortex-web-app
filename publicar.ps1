# ============================================================
# KORTEX - LANÇAR ATUALIZAÇÃO
# ============================================================
param(
    [string]$NovaVersao = ""
)

Set-Location "C:\Users\Admin\Desktop\EstudioK-Browser"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  A PREPARAR NOVA VERSAO DO KORTEX" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Pedir a nova versao (se nao vier por parametro)
if ([string]::IsNullOrWhiteSpace($NovaVersao)) {
    $NovaVersao = Read-Host "Introduz a nova versao (ex: 1.0.3)"
}
if ([string]::IsNullOrWhiteSpace($NovaVersao)) {
    Write-Host "[ERRO] Versao vazia." -ForegroundColor Red
    exit
}

# 2. Atualizar a versao no package.json (sem BOM)
$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$pkg.version = $NovaVersao
$json = $pkg | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText("$PWD\package.json", $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "[1/4] Versao atualizada para $NovaVersao." -ForegroundColor Green

# 3. Compilar o .exe
Write-Host "[2/4] A compilar (aguarda)..." -ForegroundColor Cyan
npx electron-builder --win --publish never

$newExe = Get-ChildItem "dist\*.exe" | Where-Object { $_.Name -match "Setup" } | Select-Object -First 1
if (-not $newExe) {
    Write-Host "[ERRO] Nao foi possivel compilar o .exe." -ForegroundColor Red
    exit
}
Write-Host "[3/4] Compilado: $($newExe.Name)" -ForegroundColor Green

# 4. Abrir o GitHub para fazer o Release
Write-Host "[4/4] A abrir o GitHub para publicares o Release..." -ForegroundColor Cyan
Start-Process "https://github.com/d66807617-sketch/kortex/releases/new"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "  PROXIMOS PASSOS (no GitHub):" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Yellow
Write-Host "  1. Tag: v$NovaVersao" -ForegroundColor White
Write-Host "  2. Title: Kortex v$NovaVersao" -ForegroundColor White
Write-Host "  3. Anexa o ficheiro: $($newExe.FullName)" -ForegroundColor White
Write-Host "  4. Clica em 'Publish release'" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Yellow
Read-Host "Prime ENTER quando o Release estiver publicado"