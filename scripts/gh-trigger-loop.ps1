# gh-trigger-loop.ps1
# Trigger GitHub Actions workflow setiap N menit selama X jam.
# Backup kalau GH cron delay/skip. Lebih ringan dari local multi-spam (cuma API call).
# Usage:
#   .\gh-trigger-loop.ps1                    # default: 9 jam, tiap 8 menit
#   .\gh-trigger-loop.ps1 -Hours 9 -IntervalMin 7

[CmdletBinding()]
param(
    [double]$Hours = 9,
    [int]$IntervalMin = 8,
    [string]$Workflow = "onchain-multi-spam"
)

$logFile = Join-Path $PSScriptRoot "gh-trigger-loop.log"
$start = Get-Date
$end = $start.AddHours($Hours)
$intervalSec = $IntervalMin * 60

function Log {
    param([string]$Msg)
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $Msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}

Log "============================================="
Log "GH TRIGGER LOOP START"
Log "  Workflow : $Workflow"
Log "  Start    : $start"
Log "  End      : $end"
Log "  Interval : $IntervalMin min"
Log "============================================="

# Verify gh login + workflow exist
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    Log "ERROR: gh not authenticated. Run: gh auth login"
    exit 1
}

$count = 0
$ok = 0
$fail = 0

while ((Get-Date) -lt $end) {
    $count++
    Log "=== Trigger $count ==="

    # Check if previous run still running (avoid queueing too many)
    $inProgress = gh run list --workflow=$Workflow --limit 1 --json status,databaseId | ConvertFrom-Json
    if ($inProgress -and $inProgress[0].status -eq "in_progress") {
        Log "  prev run ($($inProgress[0].databaseId)) still in_progress, skip trigger"
        $fail++
    } else {
        gh workflow run $Workflow
        if ($LASTEXITCODE -eq 0) {
            Log "  trigger sent OK"
            $ok++
        } else {
            Log "  trigger FAIL (exit=$LASTEXITCODE)"
            $fail++
        }
    }

    $remainingMin = [Math]::Round(($end - (Get-Date)).TotalMinutes, 1)
    Log "  remaining: ${remainingMin} min · total ok=$ok fail=$fail"

    if ((Get-Date).AddSeconds($intervalSec) -lt $end) {
        Start-Sleep -Seconds $intervalSec
    } else {
        break
    }
}

$runtimeMin = [Math]::Round(((Get-Date) - $start).TotalMinutes, 1)
Log "============================================="
Log "GH TRIGGER LOOP DONE"
Log "  Triggers : $count"
Log "  OK       : $ok"
Log "  FAIL     : $fail"
Log "  Runtime  : ${runtimeMin} min"
Log "============================================="
