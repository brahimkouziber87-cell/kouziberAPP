@echo off
chcp 65001 >nul
title منظومة التدبير التربوي لمادة الرياضيات - تجهيز تطبيق الأندرويد (Android APK)
cd /d "%~dp0"

echo ====================================================================
echo   منصة الأستاذ كوزيبر: منظومة التدبير التربوي لمادة الرياضيات
echo   تجهيز ومزامنة مشروع الأندرويد (Capacitor Android Package)
echo ====================================================================
echo.

echo [1/3] جاري بناء أحدث ملفات الإنتاج (Vite Production Build)...
call npm.cmd run build

if not exist "android" (
    echo.
    echo [2/3] جاري تهيئة بيئة مشروع الأندرويد لأول مرة (Capacitor Add Android)...
    call npx.cmd cap add android
)

echo.
echo [3/3] جاري مزامنة الملفات والأصول البرمجية مع مشروع الأندرويد (Cap Sync)...
call npx.cmd cap sync android

echo.
echo ====================================================================
echo   تم تجهيز مشروع الأندرويد بنجاح في مجلد: android/
echo ====================================================================
echo.
echo   للفتح والتثبيت على الهاتف أو توليد ملف APK مباشرة:
echo   1. افتح المشروع في Android Studio عبر الأمر: npx cap open android
echo   2. أو لتوليد ملف APK عبر سطر الأوامر (إذا كان Gradle مثبتاً):
echo      cd android ^&^& gradlew assembleDebug
echo.
pause
