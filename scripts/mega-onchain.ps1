# mega-onchain.ps1
# Loop multi-spam.mjs supaya habis ~50 CELO dalam ~9 jam.
# Adaptif: hitung pause antar iteration berdasarkan waktu tersisa & target iteration.
# Usage:
#   .\mega-onchain.ps1                    # default: 9 jam, 120 iterations
#   .\mega-onchain.ps1 -Hours 9 -Target 120
#   .\mega-onchain.ps1 -Hours 3           # quick burn

[CmdletBinding()]
param(
    [double]$Hours = 9,
    [int]$Target = 120,
    [int]$MinPauseSec = 5,
    [int]$MaxPauseSec = 600
)

$logFile = Join-Path $PSScriptRoot "mega-onchain.log"
$startTime = Get-Date
$endTime = $startTime.AddHours($Hours)

function Log {
    param([string]$Msg)
    $line = "[$(Get-Date -Format 'HH:mm:ss')] $Msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}

Log "================================================="
Log "MEGA ONCHAIN START"
Log "  Start  : $startTime"
Log "  End    : $endTime"
Log "  Hours  : $Hours"
Log "  Target : $Target iterations"
Log "================================================="

$i = 0
$totalTxs = 0
$totalOk = 0
$totalFail = 0

while ((Get-Date) -lt $endTime -and $i -lt $Target) {
    $i++
    $iterStart = Get-Date

    Log "=== Iteration $i / $Target ==="

    $output = & node multi-spam.mjs 2>&1
    $exitCode = $LASTEXITCODE

    # Parse last "done." line: "done. ok=N/N fail=N txs=N in Ns."
    $doneLine = $output | Select-String -Pattern "done\. ok=" | Select-Object -Last 1
    if ($doneLine) {
        if ($doneLine.Line -match "ok=(\d+)/\d+ fail=(\d+) txs=(\d+)") {
            $okCount = [int]$Matches[1]
            $failCount = [int]$Matches[2]
            $txCount = [int]$Matches[3]
            $totalOk += $okCount
            $totalFail += $failCount
            $totalTxs += $txCount
            Log "  result: ok=$okCount fail=$failCount txs=$txCount (exit=$exitCode)"
        }
    } else {
        Log "  no done line found. exit=$exitCode"
    }

    $iterSec = [int]((Get-Date) - $iterStart).TotalSeconds
    $remainingSec = [int]($endTime - (Get-Date)).TotalSeconds
    $remainingIters = $Target - $i

    Log "  iter took ${iterSec}s. total tx so far: $totalTxs"

    if ($remainingIters -gt 0 -and $remainingSec -gt 0) {
        $targetPerIter = [int]($remainingSec / $remainingIters)
        $pause = $targetPerIter - $iterSec
        if ($pause -lt $MinPauseSec) { $pause = $MinPauseSec }
        if ($pause -gt $MaxPauseSec) { $pause = $MaxPauseSec }
        Log "  pause ${pause}s (target ${targetPerIter}s/iter, ${remainingSec}s remaining)"
        Start-Sleep -Seconds $pause
    }
}

$runtimeMin = [Math]::Round(((Get-Date) - $startTime).TotalMinutes, 1)
Log "================================================="
Log "MEGA ONCHAIN DONE"
Log "  Iterations : $i / $Target"
Log "  Total OK   : $totalOk"
Log "  Total FAIL : $totalFail"
Log "  Total TXs  : $totalTxs"
Log "  Runtime    : ${runtimeMin} min"
Log "================================================="
