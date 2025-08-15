# Paths & Variables
$KEYSTORE_PATH = "$PSScriptRoot\keystore.jks"
$STORE_PASS    = "passwort"
$KEY_ALIAS     = "spaceMiniKey"
$KEY_PASS      = "passwort"
$APK_PATH      = "$PSScriptRoot\android\app\build\outputs\apk\release\app-release.apk"

Write-Host "=== Starting build process ===" -ForegroundColor Cyan

# 1) Build Vite App
Write-Host "Building Vite app..." -ForegroundColor Yellow
npm run build:web
if ($LASTEXITCODE -ne 0) { throw "Vite build failed." }

# 2) Copy to Android project
Write-Host "Copying web assets to native project..." -ForegroundColor Yellow
npx cap copy android
if ($LASTEXITCODE -ne 0) { throw "Capacitor copy failed." }

# 3) Build signed APK
Write-Host "Building signed APK..." -ForegroundColor Yellow
.\android\gradlew.bat -p .\android assembleRelease `
  -Pandroid.injected.signing.store.file=$KEYSTORE_PATH `
  -Pandroid.injected.signing.store.password=$STORE_PASS `
  -Pandroid.injected.signing.key.alias=$KEY_ALIAS `
  -Pandroid.injected.signing.key.password=$KEY_PASS

if ($LASTEXITCODE -ne 0) { throw "Gradle release build failed." }

# 4) Install APK on connected device
if (Test-Path $APK_PATH) {
    Write-Host "Installing APK to connected device..." -ForegroundColor Yellow
    adb install -r $APK_PATH
    if ($LASTEXITCODE -ne 0) { throw "APK installation failed." }
    Write-Host "=== Done! APK installed on device. ===" -ForegroundColor Green
} else {
    throw "APK not found at $APK_PATH"
}

