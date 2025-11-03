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
Write-Host ""
Write-Host "=============================="
Write-Host "   🌀 MoodShare Push Manager"
Write-Host "=============================="
Write-Host "Current version : $currentVersion"
Write-Host "Current build   : $currentBuild"
Write-Host ""
Write-Host "Choose an option:"
Write-Host "1) New Build (default)"
Write-Host "2) New Release"
$choice = Read-Host "Enter choice (1/2)"
if ($choice -eq "2") {
    $mode = "release"
}
else {
    $mode = "build"
}
Write-Host ""
Write-Host "Mode selected: $mode"
Write-Host ""
$newVersion = $currentVersion
$newBuild = $currentBuild
if ($mode -eq "release") {
    $newVersion = Read-Host "Enter new version (e.g. 1.2.0)"
    $changelog = Read-Host "Enter a short changelog / release notes"
}
else {
    Write-Host "Old version : $currentVersion"
    $newVersion = Read-Host "New version ('', '-' or ' ' to keep $currentVersion)"
    Write-Host "Old build: $currentBuild"
    $newBuild = Read-Host "New build ('', '-' or ' ' to keep $currentBuild)"

    if ([string]::IsNullOrWhiteSpace($newVersion) -or $newVersion -eq "-") {
        $newVersion = $currentVersion
        Write-Host "Unchaged Version: $currentVersion"
    }
    if ([string]::IsNullOrWhiteSpace($newBuild) -or $newBuild -eq "-") {
        $newBuild = $currentBuild
        Write-Host "Unchaged Build: $currentBuild"
    }
    else {
        $json.version = $newVersion
        $json.build = $newBuild
        $json | ConvertTo-Json -Depth 10 | Set-Content $versionFile -Encoding UTF8
        Write-Host "version.json updated to $newVersion (build $newBuild)"
    }
    Write-Host "Pulling latest changes..."
    $pullResult = git pull origin main 2>&1
    if ($pullResult -match "Automatic merge failed") {
        Write-Host "⚠️ Merge conflicts detected! Resolving..." -ForegroundColor Yellow
    
        $mergeMessage = "Merge main branch to sync with remote changes"
        Set-Content -Path ".git/MERGE_MSG" -Value $mergeMessage
    
        git add .
        git commit -m "$mergeMessage"
    
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Merge failed! Please resolve conflicts manually" -ForegroundColor Red
            exit 1
        }
    }

}
$json.version = $newVersion
$json.build = $newBuild
$json | ConvertTo-Json -Depth 10 | Set-Content $versionFile -Encoding UTF8
Write-Host "version.json updated → v$newVersion (build $newBuild)"
Write-Host "Pulling latest changes..."
git pull origin main
git add .
git commit -m "V$newVersion (build $newBuild)" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Nothing to commit."
}
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed!"
    exit 1
}
Write-Host "Changes pushed successfully."
if ($mode -eq "release") {
    Write-Host ""
    Write-Host "Creating GitHub release..."
    $tagName = "v$newVersion"
    git tag -a $tagName -m "Release $tagName - $changelog"
    git push origin $tagName
    $releaseNotes = @"
 Release $tagName
Date: $(Get-Date -Format "yyyy-MM-dd HH:mm")
Build: $newBuild
 Changelog:
$changelog
"@
    $releaseFile = "RELEASE_NOTES_$tagName.txt"
    $releaseNotes | Out-File -Encoding UTF8 $releaseFile
    Write-Host "Release notes saved to $releaseFile"
}
Write-Host ""
Write-Host "🎉 Operation completed successfully!"
Write-Host "=============================="
Write-Host "Version: $newVersion"
Write-Host "Build: $newBuild"
Write-Host "Mode: $mode"
Write-Host "=================================="
