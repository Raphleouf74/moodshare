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

# Git commit & push
git add .
git commit -m "V$newVersion (build $newBuild)"
git push origin main

Write-Host "GitPush completed"
