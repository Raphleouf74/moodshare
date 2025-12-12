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
Write-Host "    MoodShare Push Manager    "
Write-Host "=============================="
Write-Host "Version actuelle: $currentVersion"
Write-Host "Build actuel:       $currentBuild"
Write-Host ""
Write-Host "Choisissez une option:"
Write-Host "1) Nouveau build (Par defaut)"
Write-Host "2) Nouvelle Release "
Write-Host "3) Upload NEtlify   "
$choice = Read-Host "Entrer le choix (1/2/3)"
if ($choice -eq "1") {
    $mode = "build"
}if ($choice -eq "2") {
    $mode = "release"
}if ($choice -eq "3") {
    $mode = "netlify"
}

Write-Host ""
Write-Host "Mode selectionne: $mode"
Write-Host ""
$newVersion = $currentVersion
$newBuild = $currentBuild
if ($mode -eq "release") {
    $newVersion = Read-Host "Entrez la nouvelle version (ex: 1.2.0)"
    $changelog = Read-Host "Ecrivez un court changelog"
}
if ($mode -eq "netlify") {
    netlify deploy -p
    exit 1
}
else {
    Write-Host "Ancienne version : $currentVersion"
    $newVersion = Read-Host "Nouvelle version ('', '-' ou ' ' pour garder $currentVersion)"
    Write-Host "Ancien build: $currentBuild"
    $newBuild = Read-Host "Nouveau build ('', '-' ou ' ' pour garder $currentBuild)"

    if ([string]::IsNullOrWhiteSpace($newVersion) -or $newVersion -eq "-") {
        $newVersion = $currentVersion
        Write-Host "Version inchangee: $currentVersion"
    }
    if ([string]::IsNullOrWhiteSpace($newBuild) -or $newBuild -eq "-") {
        $newBuild = $currentBuild
        Write-Host "Build inchange: $currentBuild"
    }
    else {
        $json.version = $newVersion
        $json.build = $newBuild
        $json | ConvertTo-Json -Depth 10 | Set-Content $versionFile -Encoding UTF8
        Write-Host "version.json mis a jour a la version $newVersion (build $newBuild)"
    }
    Write-Host "Git pull en gours..."
    $pullResult = git pull origin main 2>&1
    if ($pullResult -match "Merge automatique n'a pas abouti") {
        Write-Host "Des conflits de merge ont ete detectes ! Resolution en cours..." -ForegroundColor Yellow
    
        $mergeMessage = "Merge la branche main pour synchroniser avec les changements a distance"
        Set-Content -Path ".git/MERGE_MSG" -Value $mergeMessage
    
        git add .
        git commit -m "$mergeMessage"
    
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Merge echoue! Merci de resoudre les conflits manuellement" -ForegroundColor Red
            exit 1
        }
    }

}


$json.version = $newVersion
$json.build = $newBuild
$json | ConvertTo-Json -Depth 10 | Set-Content $versionFile -Encoding UTF8
Write-Host "version.json mis a jour → v$newVersion (build $newBuild)"
Write-Host "Git Pull les dernieres modifications..."
git pull origin main
git add .
git commit -m "V$newVersion (build $newBuild)" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Rien a commit."
}
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push echoue!"
    exit 1
}
Write-Host "Changements pousses avec succes !."
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
    Write-Host "Release notes enregistre a $releaseFile"
}
Write-Host ""
Write-Host "Operation effectuee avec succes !"
Write-Host "=============================="
Write-Host "Version: $newVersion"
Write-Host "Build: $newBuild"
Write-Host "Mode: $mode"
Write-Host "=================================="
