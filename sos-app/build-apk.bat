@echo off
setlocal
echo Building Iwatch Standalone Release APK...
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=C:\Users\USER\AppData\Local\Android\Sdk"
cd /d "%~dp0android"

call gradlew.bat assembleRelease

if %ERRORLEVEL% EQU 0 (
    copy /y "%~dp0android\app\build\outputs\apk\release\app-release.apk" "%~dp0..\Iwatch.apk"
    echo.
    echo ========================================================
    echo APK successfully built!
    echo Location: %~dp0..\Iwatch.apk
    echo ========================================================
) else (
    echo.
    echo [ERROR] Build failed. Check errors above.
)
pause
