# mega-spam.ps1
# Sekali jalan: bikin N PR (default 50) × M commit (default 2) = total 100 commit + 50 PR merged.
# Pakai jitter delay biar tidak flat-line. Continue on error.
# Usage:
#   .\scripts\mega-spam.ps1                          # default: 50 PR × 2 commit
#   .\scripts\mega-spam.ps1 -Prs 50 -CommitsPerPr 2  # eksplisit
#   .\scripts\mega-spam.ps1 -Prs 100 -CommitsPerPr 1 # 100 PR × 1 commit
#   .\scripts\mega-spam.ps1 -Force                   # skip konfirmasi

[CmdletBinding()]
param(
    [int]$Prs = 50,
    [int]$CommitsPerPr = 2,
    [int]$MinDelay = 1,
    [int]$MaxDelay = 6,
    [string]$Base = "main",
    [string]$Folder = "activity-log",
    [switch]$Force,
    [switch]$NoMerge,
    [switch]$NoStash
)

function Invoke-Native {
    param([string]$Cmd, [string[]]$CmdArgs, [switch]$IgnoreFail)
    & $Cmd @CmdArgs
    if (-not $IgnoreFail -and $LASTEXITCODE -ne 0) {
        throw "Command failed (exit $LASTEXITCODE): $Cmd $($CmdArgs -join ' ')"
    }
}

function Get-Jitter { Get-Random -Minimum $MinDelay -Maximum ($MaxDelay + 1) }

# Sanity checks
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) { Write-Error "gh CLI tidak ada."; exit 1 }

gh auth status *> $null
if ($LASTEXITCODE -ne 0) { Write-Error "gh belum login. Run: gh auth login"; exit 1 }

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { Write-Error "Bukan di dalam git repo."; exit 1 }
Set-Location $repoRoot

$totalCommits = $Prs * $CommitsPerPr
$estSec = $Prs * 8 + ($totalCommits * (($MinDelay + $MaxDelay) / 2))
$estMin = [math]::Round($estSec / 60, 1)

Write-Host ""
Write-Host "=== MEGA SPAM PLAN ==="
Write-Host "  PRs              : $Prs"
Write-Host "  Commits per PR   : $CommitsPerPr"
Write-Host "  Total commits    : $totalCommits"
Write-Host "  Auto-merge       : $(-not $NoMerge)"
Write-Host "  Auto-stash dirty : $(-not $NoStash)"
Write-Host "  Jitter           : ${MinDelay}-${MaxDelay}s"
Write-Host "  Estimated time   : ~$estMin min"
Write-Host "======================"
Write-Host ""

if (-not $Force) {
    $ans = Read-Host "Lanjut? (y/N)"
    if ($ans -notmatch "^[yY]") { Write-Host "Cancelled."; exit 0 }
}

# Handle dirty tree
$dirty = git status --porcelain
$stashed = $false
if ($dirty) {
    if ($NoStash) {
        Write-Error "Working tree dirty. Commit/buang dulu atau jangan pakai -NoStash."
        exit 1
    }
    Write-Host "Working tree dirty -> git stash"
    git stash push -u -m "mega-spam-autostash" | Out-Null
    $stashed = $true
}

# Sync base
Invoke-Native git @("checkout", $Base)
Invoke-Native git @("pull", "--rebase", "origin", $Base)

$activityDir = Join-Path $repoRoot $Folder
if (-not (Test-Path $activityDir)) {
    New-Item -ItemType Directory -Path $activityDir | Out-Null
}

$verbs = @("update","tweak","refresh","sync","bump","polish","tidy","log","note","cleanup","prune","trim","amend","touch","mark")
$nouns = @("activity","heartbeat","ping","tick","entry","beacon","pulse","trace","log","signal","ledger","crumb","blip","spark","note")

$successPrs = 0
$failPrs = 0
$start = Get-Date

for ($p = 1; $p -le $Prs; $p++) {
    try {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
        $verb  = $verbs | Get-Random
        $noun  = $nouns | Get-Random
        $branch = "chore/$verb-$noun-$stamp"

        $elapsed = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)
        Write-Host ""
        Write-Host "=== [$p/$Prs] (${elapsed}min elapsed) -> $branch ==="
        Invoke-Native git @("checkout", "-b", $branch)

        for ($c = 1; $c -le $CommitsPerPr; $c++) {
            $ts = Get-Date -Format "yyyy-MM-dd_HH-mm-ss-fff"
            $file = Join-Path $activityDir "$ts-$p-$c.md"
            $body = @"
# Activity log $ts

- PR: $p / $Prs
- Commit: $c / $CommitsPerPr
- Verb: $verb
- Noun: $noun
- Random: $((New-Guid).Guid)
"@
            Set-Content -Path $file -Value $body -Encoding utf8
            Invoke-Native git @("add", $file)
            $msg = "chore($Folder): $verb $noun #$c [$ts]"
            Invoke-Native git @("commit", "-m", $msg)
            Write-Host "  [$c/$CommitsPerPr] $msg"
            if ($c -lt $CommitsPerPr) { Start-Sleep -Seconds (Get-Jitter) }
        }

        Invoke-Native git @("push", "-u", "origin", $branch)

        $title = "chore: $verb $noun ($stamp)"
        $bodyPr = "Automated $verb $noun. PR $p of $Prs."
        gh pr create --base $Base --head $branch --title $title --body $bodyPr
        if ($LASTEXITCODE -ne 0) { throw "gh pr create failed" }
        Write-Host "  PR opened: $title"

        if (-not $NoMerge) {
            Start-Sleep -Seconds 1
            gh pr merge $branch --squash --delete-branch --admin
            if ($LASTEXITCODE -ne 0) {
                gh pr merge $branch --squash --delete-branch
                if ($LASTEXITCODE -ne 0) { throw "gh pr merge failed" }
                Write-Host "  PR merged (no-admin)."
            } else {
                Write-Host "  PR merged (admin)."
            }
        }

        Invoke-Native git @("checkout", $Base)
        Invoke-Native git @("pull", "--rebase", "origin", $Base) -IgnoreFail

        $successPrs++
    } catch {
        $failPrs++
        Write-Warning "  PR $p gagal: $_"
        # Recovery: balik ke base, hapus branch lokal kalau ada
        git checkout $Base 2>&1 | Out-Null
        if ($branch) {
            git branch -D $branch 2>&1 | Out-Null
        }
        Start-Sleep -Seconds 3
    }

    if ($p -lt $Prs) { Start-Sleep -Seconds (Get-Jitter) }
}

if ($stashed) {
    Write-Host ""
    Write-Host "Restore stash..."
    git stash pop 2>&1 | Out-Null
}

$totalMin = [math]::Round(((Get-Date) - $start).TotalMinutes, 1)
Write-Host ""
Write-Host "=== DONE ==="
Write-Host "  Success : $successPrs PR"
Write-Host "  Failed  : $failPrs PR"
Write-Host "  Elapsed : ${totalMin} min"
Write-Host "============"
