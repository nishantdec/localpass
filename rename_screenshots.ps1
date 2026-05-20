# rename_screenshots.ps1
$base = "D:\Docs\Resources\Cheatsheets\v0.1D"
$src  = "$base\screenshots"
$term = "$base\assets\screenshots\terminal"
$ext  = "$base\assets\screenshots\extension"

New-Item -ItemType Directory -Force -Path $term
New-Item -ItemType Directory -Force -Path $ext

$renames = @{
  "TUI Login.png" = "$term\tui-01-unlock-screen.png"
  "TUI NEW entry.png" = "$term\tui-02-new-entry-form.png"
  "TUI Options.png" = "$term\tui-03-dashboard.png"
  "TUI PASS GEN.png" = "$term\tui-04-password-generator.png"
  "TUI SEARCH.png" = "$term\tui-05-search-screen.png"
  "TUI SETTINGS.png" = "$term\tui-06-settings-screen.png"
  "TUI SHOW LOFIN.png" = "$term\tui-07-entry-view.png"
  "Extension VAULT.png" = "$ext\ext-01-vault-entries.png"
  "Full screen extension vault.png" = "$ext\ext-02-vault-fullscreen.png"
  "Extension autofill password. Passkey setup.png" = "$ext\ext-03-autofill-passkey.png"
  "Extension demonstrating. Auto fill drop down menu.png" = "$ext\ext-04-inline-dropdown.png"
  "Extension password generator.png" = "$ext\ext-05-password-generator.png"
  "Extension settings option..png" = "$ext\ext-06-settings.png"
  "Extension about me back end server connected..png" = "$ext\ext-07-server-connected.png"
  "Extension not connected to back end server screen.png" = "$ext\ext-08-not-connected.png"
  "Extension asking to save password or overwrite any existing entry..png" = "$ext\ext-09-save-entry.png"
}

foreach ($old in $renames.Keys) {
  $oldPath = "$src\$old"
  $newPath = $renames[$old]
  if (Test-Path $oldPath) {
    Move-Item -Path $oldPath -Destination $newPath -Force
    Write-Host "Moved: $old -> $newPath"
  } else {
    Write-Host "NOT FOUND: $old"
  }
}

Write-Host "Done. Old screenshots/ folder can be deleted."
