# spam-prs.ps1
# Bikin N branch baru, masing-masing 1-3 commit, push, buka PR via gh, optional auto-merge.
# Wajib: gh CLI sudah login (gh auth status).
# Usage:
#   .\scripts\spam-prs.ps1                       # 3 PR, 2 commit per PR, tidak auto-merge
#   .\scripts\spam-prs.ps1 -Count 5 -CommitsPerPr 3
#   .\scripts\spam-prs.ps1 -Count 3 -AutoMerge   # langsung merge (squash) setelah PR dibuat

[CmdletBinding()]
param(
    [int]$Count = 3,
    [int]$CommitsPerPr = 2,
    [int]$DelaySeconds = 2,
    [string]$Base = "main",
    [string]$Folder = "activity-log",
    [switch]$AutoMerge,
    [switch]$AutoStash
)

# Catatan: TIDAK pakai $ErrorActionPreference = "Stop"
# karena native exe (git/gh) di PS 5.1 sering nulis stderr yang dianggap NativeCommandError padahal exit 0.
# Pakai cek $LASTEXITCODE manual.

function Invoke-Native {
    param([string]$Cmd, [string[]]$CmdArgs, [switch]$IgnoreFail)
    & $Cmd @CmdArgs
    if (-not $IgnoreFail -and $LASTEXITCODE -ne 0) {
        throw "Command failed (exit $LASTEXITCODE): $Cmd $($CmdArgs -join ' ')"
    }
}

# Pastikan gh ada
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) {
    Write-Error "gh CLI tidak ada. Install: https://cli.github.com/"
    exit 1
}

# Pastikan login
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Error "gh belum login. Jalankan: gh auth login"
    exit 1
}

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    Write-Error "Bukan di dalam git repo."
    exit 1
}
Set-Location $repoRoot

# Handle dirty working tree
$dirty = git status --porcelain
$stashed = $false
if ($dirty) {
    if ($AutoStash) {
        Write-Host "Working tree dirty -> git stash"
        git stash push -u -m "spam-prs-autostash" | Out-Null
        $stashed = $true
    } else {
        Write-Warning "Working tree dirty. File berubah:"
        Write-Host $dirty
        Write-Host ""
        Write-Host "Pilihan:"
        Write-Host "  1) Re-run dengan -AutoStash  -> .\scripts\spam-prs.ps1 ... -AutoStash"
        Write-Host "  2) Commit/buang dulu         -> git stash  ATAU  git restore <file>"
        exit 1
    }
}

# Sync base
Invoke-Native git @("checkout", $Base)
Invoke-Native git @("pull", "--rebase", "origin", $Base)

$activityDir = Join-Path $repoRoot $Folder
if (-not (Test-Path $activityDir)) {
    New-Item -ItemType Directory -Path $activityDir | Out-Null
}

$verbs = @("update","tweak","refresh","sync","bump","polish","tidy")
$nouns = @("activity","heartbeat","ping","tick","entry","beacon","pulse")

for ($p = 1; $p -le $Count; $p++) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $verb  = $verbs | Get-Random
    $noun  = $nouns | Get-Random
    $branch = "chore/$verb-$noun-$stamp"

    Write-Host "=== PR $p/$Count -> branch $branch ==="
    Invoke-Native git @("checkout", "-b", $branch)

    for ($c = 1; $c -le $CommitsPerPr; $c++) {
        $ts = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
        $file = Join-Path $activityDir "$ts-$p-$c.md"
        $body = @"
# Activity log $ts

- PR: $p / $Count
- Commit: $c / $CommitsPerPr
- Random: $((New-Guid).Guid)
"@
        Set-Content -Path $file -Value $body -Encoding utf8
        Invoke-Native git @("add", $file)
        $msg = "chore($Folder): $verb $noun #$c [$ts]"
        Invoke-Native git @("commit", "-m", $msg)
        Write-Host "  [$c/$CommitsPerPr] $msg"
        if ($c -lt $CommitsPerPr -and $DelaySeconds -gt 0) {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    Invoke-Native git @("push", "-u", "origin", $branch)

    $title = "chore: $verb $noun ($stamp)"
    $bodyPr = "Automated $verb $noun. Generated $stamp."
    gh pr create --base $Base --head $branch --title $title --body $bodyPr
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "  PR create gagal (exit $LASTEXITCODE). Lanjut PR berikut."
    } else {
        Write-Host "  PR opened: $title"
    }

    if ($AutoMerge) {
        Start-Sleep -Seconds 2
        # Coba dengan --admin (bypass branch protection kalau user admin)
        gh pr merge $branch --squash --delete-branch --admin
        $adminExit = $LASTEXITCODE
        if ($adminExit -ne 0) {
            # Fallback tanpa --admin
            gh pr merge $branch --squash --delete-branch
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "  PR merge gagal. Cek branch protection atau merge manual di UI."
            } else {
                Write-Host "  PR merged (no-admin)."
            }
        } else {
            Write-Host "  PR merged (admin)."
        }
    }

    Invoke-Native git @("checkout", $Base)
    Invoke-Native git @("pull", "--rebase", "origin", $Base) -IgnoreFail

    if ($p -lt $Count -and $DelaySeconds -gt 0) {
        Start-Sleep -Seconds $DelaySeconds
    }
}

if ($stashed) {
    Write-Host "Restore stash..."
    git stash pop | Out-Null
}

Write-Host "Done. $Count PR diproses."
