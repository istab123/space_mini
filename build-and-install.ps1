# build-and-install.ps1
$ErrorActionPreference = "Stop"

# Java 21 für den Build erzwingen (anpassen falls anderer Pfad)
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.8.9-hotspot"
$env:ORG_GRADLE_JAVA_HOME = $env:JAVA_HOME

# Signing
$STORE_PASS    = "passwort"
$KEY_PASS      = $STORE_PASS
$KEY_ALIAS     = "spaceMiniKey"
$KEYSTORE_PATH = "$PSScriptRoot\keystore.jks"

Write-Host "=== Build Script gestartet ==="

# 1) Keystore erzeugen falls nicht vorhanden
if (-not (Test-Path $KEYSTORE_PATH)) {
    Write-Host "Keystore nicht gefunden - erstelle neuen..."
    & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair `
        -keystore $KEYSTORE_PATH `
        -storepass $STORE_PASS `
        -alias $KEY_ALIAS `
        -keypass $KEY_PASS `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -dname "CN=SpaceMini, OU=Dev, O=Example, L=City, S=State, C=DE" `
        -storetype pkcs12
}

# 2) Web-App bauen (Vite)
Write-Host "Baue Vite App..."
npm run build:web
if ($LASTEXITCODE -ne 0) { throw "Vite Build fehlgeschlagen" }

# 3) Web-Assets ins Android-Projekt kopieren
Write-Host "Kopiere Web-Assets..."
npx cap copy android
if ($LASTEXITCODE -ne 0) { throw "Capacitor Copy fehlgeschlagen" }

# 4) Signierte APK bauen (ohne Zeilenfortsetzung, mit Argument-Array)
Write-Host "Baue signierte APK..."
$gradleArgs = @(
  "-p", ".\android",
  "assembleRelease",
  "-Pandroid.injected.signing.store.file=$KEYSTORE_PATH",
  "-Pandroid.injected.signing.store.password=$STORE_PASS",
  "-Pandroid.injected.signing.key.alias=$KEY_ALIAS",
  "-Pandroid.injected.signing.key.password=$KEY_PASS"
)
& ".\android\gradlew.bat" @gradleArgs
if ($LASTEXITCODE -ne 0) { throw "Gradle Release Build fehlgeschlagen" }

# 5) APK bereitstellen und installieren
$apk = Get-ChildItem ".\android\app\build\outputs\apk\release" -Filter "*.apk" | Select-Object -First 1
if ($apk) {
    Copy-Item $apk.FullName ".\space_mini.apk" -Force
    Write-Host "APK gebaut: $($apk.FullName)"
    Write-Host "Installiere auf Gerät (adb install -r)..."
    & adb install -r ".\space_mini.apk"
} else {
    Write-Host "Keine APK im Release-Ordner gefunden."
}

Write-Host "=== Fertig! ==="
