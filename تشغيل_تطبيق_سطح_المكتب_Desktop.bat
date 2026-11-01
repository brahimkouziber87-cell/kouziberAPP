@echo off
chcp 65001 >nul
title منظومة التدبير التربوي لمادة الرياضيات - تطبيق سطح المكتب (Desktop App)
cd /d "%~dp0"

echo ====================================================================
echo   منصة الأستاذ كوزيبر: منظومة التدبير التربوي لمادة الرياضيات
echo   تشغيل المنظومة في نافذة سطح المكتب المستقلة
echo ====================================================================
echo.

where node >nul 2>nul
if %errorlevel% equ 0 (
    echo [1/2] جاري تشغيل الخادم المحلي المدمج (Standalone Server)...
    start /b "" node standalone-server.cjs
    timeout /t 2 >nul
    echo [2/2] جاري إطلاق نافذة التطبيق المستقلة...
    start msedge --app=http://localhost:3000 --start-maximized 2>nul || start chrome --app=http://localhost:3000 --start-maximized 2>nul || start http://localhost:3000
) else (
    echo لم يتم العثور على Node.js، جاري فتح التطبيق مباشرة في المتصفح...
    start "" "dist\index.html" 2>nul || start "" "index.html"
)
