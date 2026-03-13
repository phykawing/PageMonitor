@echo off
rem Prerequisites: ANDROID_HOME, JAVA_HOME, and nodejs must be set in your system environment.
cd /d "%~dp0"
echo [run-android] Starting build...
echo [run-android] adb devices:
adb devices
echo [run-android] Running npx react-native run-android...
npx.cmd react-native run-android
echo [run-android] Done. Exit code: %ERRORLEVEL%
