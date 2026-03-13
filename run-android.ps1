if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = 'C:\Users\phykawing\AppData\Local\Android\Sdk' }
if (-not $env:JAVA_HOME)    { $env:JAVA_HOME    = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.18.8-hotspot' }
if ($env:PATH -notlike '*nodejs*') { $env:PATH = 'C:\Program Files\nodejs;' + $env:PATH }
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;" + $env:PATH

# Workaround: Windows 11 25H2 has broken AF_UNIX connect(), which JDK 17.0.13+
# uses for java.nio.channels.Pipe. Point UDS temp dir to a non-existent path so
# PipeImpl falls back to TCP loopback (which works fine).
$env:JAVA_TOOL_OPTIONS = '-Djdk.net.unixdomain.tmpdir=Z:\nonexistent'
Remove-Item Env:GRADLE_OPTS -ErrorAction SilentlyContinue

$projectDir  = $PSScriptRoot
$androidDir  = "$PSScriptRoot\android"
$gradlew     = "$PSScriptRoot\android\gradlew.bat"

# Verify files
Write-Host "[BUILD] gradlew.bat exists: $(Test-Path $gradlew)"
Write-Host "[BUILD] ANDROID_HOME: $env:ANDROID_HOME"
Write-Host "[BUILD] JAVA_HOME: $env:JAVA_HOME"
Write-Host "[BUILD] Java version:"
& "$env:JAVA_HOME\bin\java.exe" -version 2>&1 | ForEach-Object { Write-Host "  $_" }

# Step 1: Start Metro in background (hidden window)
Write-Host '[BUILD] Starting Metro bundler...'
$metro = Start-Process -FilePath 'node' `
    -ArgumentList "$projectDir\node_modules\react-native\cli.js", 'start', '--reset-cache' `
    -WorkingDirectory $projectDir -PassThru -WindowStyle Minimized
Write-Host "[BUILD] Metro PID: $($metro.Id) — waiting 10s for it to start..."
Start-Sleep -Seconds 10

# Step 2: Run Gradle (let daemon run normally — no --no-daemon)
Write-Host '[BUILD] Running Gradle installDebug...'
Set-Location $androidDir
& $gradlew app:installDebug "-PreactNativeDevServerPort=8081"
$gradleExit = $LASTEXITCODE
Write-Host "[BUILD] Gradle exit: $gradleExit"

if ($gradleExit -eq 0) {
    Write-Host '[BUILD] SUCCESS — launching app on emulator...'
    & "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -n com.pagemonitor/.MainActivity
    Write-Host '[BUILD] App launched! Check the emulator.'
} else {
    Write-Host '[BUILD] FAILED — see Gradle output above for errors.'
    Stop-Process -Id $metro.Id -Force -ErrorAction SilentlyContinue
}
