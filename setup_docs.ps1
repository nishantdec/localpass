# setup_docs.ps1
# Run from project root

Write-Host "=== localpass Docs Setup ===" -ForegroundColor Cyan

# Step 1: Rename screenshots
Write-Host "`nStep 1: Moving screenshots..." -ForegroundColor Yellow
& ".\rename_screenshots.ps1"

# Step 2: Verify screenshots
Write-Host "`nStep 2: Verifying screenshots..." -ForegroundColor Yellow
$expected = @(
  "assets\screenshots\terminal\tui-01-unlock-screen.png",
  "assets\screenshots\terminal\tui-02-new-entry-form.png",
  "assets\screenshots\terminal\tui-03-dashboard.png",
  "assets\screenshots\terminal\tui-04-password-generator.png",
  "assets\screenshots\terminal\tui-05-search-screen.png",
  "assets\screenshots\terminal\tui-06-settings-screen.png",
  "assets\screenshots\terminal\tui-07-entry-view.png",
  "assets\screenshots\extension\ext-01-vault-entries.png",
  "assets\screenshots\extension\ext-02-vault-fullscreen.png",
  "assets\screenshots\extension\ext-03-autofill-passkey.png",
  "assets\screenshots\extension\ext-04-inline-dropdown.png",
  "assets\screenshots\extension\ext-05-password-generator.png",
  "assets\screenshots\extension\ext-06-settings.png",
  "assets\screenshots\extension\ext-07-server-connected.png",
  "assets\screenshots\extension\ext-08-not-connected.png",
  "assets\screenshots\extension\ext-09-save-entry.png"
)

$found = 0
foreach ($f in $expected) {
  if (Test-Path $f) {
    $found++
  } else {
    Write-Host "  MISSING: $f" -ForegroundColor Red
  }
}
Write-Host "  Screenshots: $found of $($expected.Count) found" `
  -ForegroundColor $(if ($found -eq $expected.Count) {"Green"} else {"Red"})

# Step 3: Check for broken markdown links
Write-Host "`nStep 3: Checking markdown links..." -ForegroundColor Yellow
$mdFiles = Get-ChildItem -Recurse -Filter "*.md" | Where-Object {
  $_.FullName -notlike "*node_modules*"
}
$brokenCount = 0
$checkedCount = 0

foreach ($file in $mdFiles) {
  $content = Get-Content $file.FullName -Raw
  $links = [regex]::Matches($content, '\[.*?\]\((.*?\.md.*?)\)')
  foreach ($link in $links) {
    $href = $link.Groups[1].Value -split '#' | Select-Object -First 1
    if ($href -and -not $href.StartsWith('http')) {
      $resolved = Join-Path (Split-Path $file.FullName) $href
      $resolved = [System.IO.Path]::GetFullPath($resolved)
      $checkedCount++
      if (-not (Test-Path $resolved)) {
        Write-Host "  BROKEN: $($file.Name) -> $href" -ForegroundColor Red
        $brokenCount++
      }
    }
  }
}

Write-Host "  Links checked: $checkedCount" -ForegroundColor White
Write-Host "  Broken links: $brokenCount" `
  -ForegroundColor $(if ($brokenCount -eq 0) {"Green"} else {"Red"})

Write-Host "`n=== Setup Complete ===" -ForegroundColor Cyan
