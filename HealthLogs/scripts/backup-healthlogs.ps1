param(
    [string]$Message
)

$ErrorActionPreference = "Stop"

$repoRoot = git rev-parse --show-toplevel
if (-not $repoRoot) {
    throw "Not inside a git repository."
}

$repoRoot = $repoRoot.Trim()
$projectPath = (Resolve-Path "$PSScriptRoot\..").Path
$projectName = Split-Path -Leaf $projectPath

Push-Location $repoRoot
try {
    $relativeProjectPath = Resolve-Path -Relative $projectPath
    $relativeProjectPath = $relativeProjectPath.TrimStart([char]46, [char]92, [char]47)

    $dirtyInProject = git status --porcelain -- "$relativeProjectPath"
    if (-not $dirtyInProject) {
        Write-Host "No changes found in $relativeProjectPath. Nothing to back up."
        exit 0
    }

    git add -- "$relativeProjectPath"

    $stagedInProject = git diff --cached --name-only -- "$relativeProjectPath"
    if (-not $stagedInProject) {
        Write-Host "No staged changes in $relativeProjectPath. Nothing to commit."
        exit 0
    }

    if ([string]::IsNullOrWhiteSpace($Message)) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
        $Message = "Backup $projectName - $timestamp"
    }

    git commit -m $Message
    git push origin main

    Write-Host "Backup complete: $Message"
}
finally {
    Pop-Location
}