# build-and-install.ps1 (no -P flags, uses Gradle signing config)
$ErrorActionPreference = "Stop"

# Ensure Java 21 in this shell
if (-not (Test-Path "C:\Program Files\Microsoft\jdk-21.0.8.9-hotspot\bin\java.exe")) {
    Write-Warning "JDK 21 not found at default path. If Gradle errors, set JAVA_HOME to your JDK 21."
}
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.8.9-hotspot"
$env:ORG_GRADLE_JAVA_HOME = $env:JAVA_HOME

# 1) Build web
Write-Host "Building Vite app..." -ForegroundColor Cyan
npm run build:web
if ($LASTEXITCODE -ne 0) { throw "Vite build failed" }

# 2) Copy assets into Android project
Write-Host "Copying web assets..." -ForegroundColor Cyan
npx cap copy android
if ($LASTEXITCODE -ne 0) { throw "Capacitor copy failed" }

# 3) Assemble release (signing from build.gradle)
Write-Host "Assembling signed release APK..." -ForegroundColor Cyan
& ".\android\gradlew.bat" "-p" ".\android" assembleRelease
if ($LASTEXITCODE -ne 0) { throw "Gradle release build failed" }

# 4) Install to device
$apk = Get-ChildItem ".\android\app\build\outputs\apk\release" -Filter "*.apk" | Select-Object -First 1
if (-not $apk) { throw "No APK found in release output" }

Write-Host "Installing APK on connected device..." -ForegroundColor Cyan
# Try normal install; if signatures changed, uninstall then reinstall
& adb install -r $apk.FullName
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Initial install failed. Trying uninstall → reinstall..."
    # package name must match your appId in capacitor.config.ts; adjust if needed
    $pkg = "com.example.spacemini"
    & adb uninstall $pkg | Out-Null
    & adb install $apk.FullName
    if ($LASTEXITCODE -ne 0) { throw "ADB install failed" }
}

Write-Host "Done! Installed: $($apk.FullName)" -ForegroundColor Green
