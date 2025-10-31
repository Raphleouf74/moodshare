# Check version.json and compare versions
$versionFile = "version.json"
if (Test-Path $versionFile) {
    $json = Get-Content $versionFile | ConvertFrom-Json
    $currentVersion = $json.version
    $currentBuild = $json.build
}
else {
    Write-Host "version.json not found !"
    exit
}

# Show to user the old version and ask for the new one
Write-Host "Old version : $currentVersion"
$newVersion = Read-Host "New version ('', '-' or ' ' to keep $currentVersion)"
Write-Host "Old build: $currentBuild"
$newBuild = Read-Host "New build ('', '-' or ' ' to keep $currentBuild)"

#If no user input, or if the user put a space or a "-", the old version number is pushed
if ([string]::IsNullOrWhiteSpace($newVersion) -or $newVersion -eq "-") {
    $newVersion = $currentVersion
    Write-Host "Unchaged Version: $currentVersion"
}
if ([string]::IsNullOrWhiteSpace($newBuild) -or $newBuild -eq "-") {
    $newBuild = $currentBuild
    Write-Host "Unchaged Build: $currentBuild"
}
else {
    # Update the JSON
    $json.version = $newVersion
    $json.build = $newBuild
    $json | ConvertTo-Json -Depth 10 | Set-Content $versionFile -Encoding UTF8
    Write-Host "version.json updated to $newVersion (build $newBuild)"
}


# Git operations with pull first
Write-Host "Pulling latest changes..."
git pull origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Pull failed! Please resolve conflicts manually" -ForegroundColor Red
    exit 1
}

git add .
$commitStatus = git commit -m "V$newVersion (build $newBuild)"
if ($commitStatus -match "nothing to commit") {
    Write-Host "No changes to commit" -ForegroundColor Yellow
} else {
    Write-Host "Changes committed" -ForegroundColor Green
}

Write-Host "Pushing changes..."
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Push failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ GitPush completed successfully" -ForegroundColor Green