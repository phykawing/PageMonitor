if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = 'C:\Users\phykawing\AppData\Local\Android\Sdk' }
if (-not $env:JAVA_HOME)    { $env:JAVA_HOME    = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot' }
if ($env:PATH -notlike '*nodejs*') { $env:PATH = 'C:\Program Files\nodejs;' + $env:PATH }
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;" + $env:PATH
$env:JAVA_TOOL_OPTIONS = '-Djdk.net.unixdomain.tmpdir=Z:\nonexistent'
Remove-Item Env:GRADLE_OPTS -ErrorAction SilentlyContinue

$projectDir = $PSScriptRoot
Set-Location $projectDir

Write-Host "[1/3] Creating JS bundle (prod mode for clean error handling)..."
& node "$projectDir\node_modules\react-native\cli.js" bundle `
    --platform android --dev false --entry-file index.js `
    --bundle-output "$projectDir\android\app\src\main\assets\index.android.bundle" `
    --assets-dest "$projectDir\android\app\src\main\res\"
if ($LASTEXITCODE -ne 0) { Write-Host "BUNDLE FAILED"; exit 1 }

Write-Host "[2/3] Building and installing APK..."
Set-Location "$projectDir\android"
& "$projectDir\android\gradlew.bat" app:installDebug "-PreactNativeDevServerPort=8081"
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED"; exit 1 }

Write-Host "[3/3] Launching app..."
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am force-stop com.pagemonitor
Start-Sleep -Seconds 1
& "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n com.pagemonitor/.MainActivity
Write-Host "DONE!"
