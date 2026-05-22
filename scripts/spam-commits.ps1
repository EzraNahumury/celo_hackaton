# spam-commits.ps1
# Bikin N commit kecil di folder activity-log/ lalu push ke remote.
# Usage:
#   .\scripts\spam-commits.ps1                  # default: 5 commit, delay 2s, push
#   .\scripts\spam-commits.ps1 -Count 20        # 20 commit
#   .\scripts\spam-commits.ps1 -Count 10 -NoPush
#   .\scripts\spam-commits.ps1 -DelaySeconds 5

[CmdletBinding()]
param(
    [int]$Count = 5,
    [int]$DelaySeconds = 2,
    [string]$Branch = "main",
    [string]$Folder = "activity-log",
    [switch]$NoPush
)

$ErrorActionPreference = "Stop"

# Pastikan dijalankan dari root repo
$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) {
    Write-Error "Bukan di dalam git repo."
    exit 1
}
Set-Location $repoRoot

# Pastikan branch benar
$current = git rev-parse --abbrev-ref HEAD
if ($current -ne $Branch) {
    Write-Host "Switch ke branch $Branch (sekarang: $current)"
    git checkout $Branch
}

# Pastikan up-to-date
git pull --rebase origin $Branch

# Bikin folder kalau belum ada
$activityDir = Join-Path $repoRoot $Folder
if (-not (Test-Path $activityDir)) {
    New-Item -ItemType Directory -Path $activityDir | Out-Null
}

$verbs = @("update","tweak","refresh","sync","bump","polish","tidy","log","note","cleanup")
$nouns = @("activity","heartbeat","ping","tick","entry","mark","log","trace","beacon","pulse")

for ($i = 1; $i -le $Count; $i++) {
    $ts = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $verb = $verbs | Get-Random
    $noun = $nouns | Get-Random
    $file = Join-Path $activityDir "$ts.md"

    $body = @"
# Activity log $ts

- Iteration: $i / $Count
- Verb: $verb
- Noun: $noun
- Random: $((New-Guid).Guid)
"@
    Set-Content -Path $file -Value $body -Encoding utf8

    git add $file | Out-Null
    $msg = "chore($Folder): $verb $noun [$ts]"
    git commit -m $msg | Out-Null
    Write-Host "[$i/$Count] $msg"

    if ($i -lt $Count -and $DelaySeconds -gt 0) {
        Start-Sleep -Seconds $DelaySeconds
    }
}

if (-not $NoPush) {
    Write-Host "Push ke origin/$Branch ..."
    git push origin $Branch
    Write-Host "Done."
} else {
    Write-Host "Skip push (--NoPush). Push manual: git push origin $Branch"
}
