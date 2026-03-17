if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = 'C:\Users\phykawing\AppData\Local\Android\Sdk' }
if (-not $env:JAVA_HOME)    { $env:JAVA_HOME    = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot' }
if ($env:PATH -notlike '*nodejs*') { $env:PATH = 'C:\Program Files\nodejs;' + $env:PATH }
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;" + $env:PATH
$env:JAVA_TOOL_OPTIONS = '-Djdk.net.unixdomain.tmpdir=Z:\nonexistent'
Remove-Item Env:GRADLE_OPTS -ErrorAction SilentlyContinue

$projectDir = $PSScriptRoot
Set-Location $projectDir

Write-Host "[1/2] Creating JS bundle (prod mode)..."
& node "$projectDir\node_modules\react-native\cli.js" bundle `
    --platform android --dev false --entry-file index.js `
    --bundle-output "$projectDir\android\app\src\main\assets\index.android.bundle" `
    --assets-dest "$projectDir\android\app\src\main\res\"
if ($LASTEXITCODE -ne 0) { Write-Host "BUNDLE FAILED"; exit 1 }

Write-Host "[2/2] Building debug APK..."
Set-Location "$projectDir\android"
& "$projectDir\android\gradlew.bat" app:assembleDebug
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED"; exit 1 }

$apkPath = "$projectDir\android\app\build\outputs\apk\debug\app-debug.apk"
Write-Host ""
Write-Host "DONE! APK is ready at:"
Write-Host "  $apkPath"
Write-Host ""
Write-Host "To install on a device, either:"
Write-Host "  - Copy the APK file to the device and open it (enable 'Install unknown apps' in settings)"
Write-Host "  - Or run: adb install `"$apkPath`""
