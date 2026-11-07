@echo off
title Building Iwatch Android Release APK
echo ======================================================
echo           Building Iwatch Release APK
echo ======================================================
echo.

set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\USER\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%

cd /d "%~dp0sos-app\android"

echo [1/3] Compiling Android Release APK...
call gradlew.bat assembleRelease
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed! Check the error messages above.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Copying APK to project root...
copy /Y "%~dp0sos-app\android\app\build\outputs\apk\release\app-release.apk" "%~dp0Iwatch.apk"

echo.
echo [3/3] Done! Your updated APK is ready at:
echo       %~dp0Iwatch.apk
echo.
echo ======================================================
pause
