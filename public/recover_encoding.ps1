$files = @("index.html", "configdata.html", "scoreboard.html", "map-detail.html", "login.html")
$dir = "d:\webtinhdiem\public"

foreach ($file in $files) {
    $filePath = Join-Path -Path $dir -ChildPath $file
    if (Test-Path $filePath) {
        $corruptedText = [System.IO.File]::ReadAllText($filePath, [System.Text.Encoding]::UTF8)
        $ansiEncoding = [System.Text.Encoding]::Default
        $originalBytes = $ansiEncoding.GetBytes($corruptedText)
        $utf8Encoding = [System.Text.Encoding]::UTF8
        $restoredText = $utf8Encoding.GetString($originalBytes)
        
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($filePath, $restoredText, $utf8NoBom)
        Write-Host "Restored $file"
    }
}
