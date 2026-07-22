$files = @("index.html", "configdata.html", "scoreboard.html", "map-detail.html", "login.html")
$dir = "d:\webtinhdiem\public"

$replacements = @(
    @{ Regex = '<div class="aurora-orb aurora-orb-[123]"><\/div>'; Replace = '' },
    @{ Regex = '\bglass-card\b'; Replace = 'admin-card' },
    @{ Regex = '\baurora-card\b'; Replace = 'admin-card' },
    @{ Regex = '\bglass-glow-(cyan|purple)\b'; Replace = '' },
    @{ Regex = '\bglass-effect\b'; Replace = 'admin-header' },
    @{ Regex = '\bracing-title\b'; Replace = 'admin-title' },
    @{ Regex = '\bracing-header\b'; Replace = 'admin-title' },
    @{ Regex = '\bgradient-text\b'; Replace = 'text-accent' },
    @{ Regex = '\b(digital-text|speed-text)\b'; Replace = 'data-value' },
    @{ Regex = '\bsidebar-modern\b'; Replace = 'sidebar-admin' },
    @{ Regex = '\bsidebar-link-modern\b'; Replace = 'sidebar-link' },
    @{ Regex = '\b(table-cyber|speed-table)\b'; Replace = 'admin-table' },
    @{ Regex = '\bbtn-cyber\b'; Replace = 'btn-admin' },
    @{ Regex = '\bspeed-button\b'; Replace = 'btn-admin' },
    @{ Regex = '\b(input-cyber|speed-input)\b'; Replace = 'input-admin' },
    @{ Regex = '\btext-cyan-400\b'; Replace = 'text-accent' },
    @{ Regex = '\btext-purple-400\b'; Replace = 'text-accent' },
    @{ Regex = '\bbg-slate-900/40\b'; Replace = 'bg-slate-800' },
    @{ Regex = '\bborder-white/5\b'; Replace = 'border-slate-700' },
    @{ Regex = '\bfrom-slate-900\b'; Replace = '' },
    @{ Regex = '\bto-slate-800\b'; Replace = '' },
    @{ Regex = '\bbg-gradient-to-br\b'; Replace = '' },
    @{ Regex = 'text-yellow-400'; Replace = 'text-warning' },
    @{ Regex = 'text-green-400'; Replace = 'text-success' },
    @{ Regex = 'text-red-400'; Replace = 'text-danger' }
)

foreach ($file in $files) {
    $filePath = Join-Path -Path $dir -ChildPath $file
    if (Test-Path $filePath) {
        $content = Get-Content $filePath -Raw
        foreach ($rule in $replacements) {
            $content = [regex]::Replace($content, $rule.Regex, $rule.Replace)
        }
        # Remove internal <style> blocks that have AURORA RACING
        $content = [regex]::Replace($content, '(?s)<style>.*?AURORA RACING OVERRIDES.*?</style>', '')

        # Remove extra spaces in class attributes
        $content = [regex]::Replace($content, 'class="([^"]+)"', { param($m) 'class="' + ($m.Groups[1].Value -replace '\s+', ' ').Trim() + '"' })
        
        # Save as UTF-8 without BOM
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($filePath, $content, $utf8NoBom)
        Write-Host "Updated $file"
    }
}
